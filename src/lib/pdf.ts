import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

import {
  buildInvoiceLayoutModel,
  INVOICE_LAYOUT_DIMENSIONS,
} from "@/lib/invoice-layout";
import type { InvoiceDTO } from "@/types/crm";

type InvoicePdfInput = {
  invoice: InvoiceDTO;
};

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) {
      lines.push(current.trim());
      current = "";
    }
  };

  const breakLongWord = (word: string): string[] => {
    const chunks: string[] = [];
    let remaining = word;
    while (remaining.length > 0) {
      let sliceLength = remaining.length;
      while (
        sliceLength > 1 &&
        font.widthOfTextAtSize(remaining.slice(0, sliceLength), size) > maxWidth
      ) {
        sliceLength -= 1;
      }
      chunks.push(remaining.slice(0, sliceLength));
      remaining = remaining.slice(sliceLength);
    }
    return chunks;
  };

  for (const word of words) {
    const testLine = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(testLine, size) <= maxWidth) {
      current = testLine;
      continue;
    }

    if (current) {
      pushCurrent();
    }

    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
      continue;
    }

    const chunks = breakLongWord(word);
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      if (index === chunks.length - 1) {
        current = chunk;
      } else {
        lines.push(chunk);
      }
    }
  }

  pushCurrent();
  return lines;
}

function drawTextLines({
  page,
  lines,
  x,
  yTop,
  lineHeight,
  size,
  font,
  color,
}: {
  page: ReturnType<PDFDocument["addPage"]>;
  lines: string[];
  x: number;
  yTop: number;
  lineHeight: number;
  size: number;
  font: PDFFont;
  color: { r: number; g: number; b: number };
}) {
  let y = yTop;
  for (const line of lines) {
    page.drawText(line, {
      x,
      y,
      size,
      font,
      color: rgb(color.r, color.g, color.b),
    });
    y -= lineHeight;
  }
}

function drawRightAligned({
  page,
  text,
  rightX,
  y,
  size,
  font,
  color,
}: {
  page: ReturnType<PDFDocument["addPage"]>;
  text: string;
  rightX: number;
  y: number;
  size: number;
  font: PDFFont;
  color: { r: number; g: number; b: number };
}) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: rightX - width,
    y,
    size,
    font,
    color: rgb(color.r, color.g, color.b),
  });
}

export async function buildInvoicePdf({ invoice }: InvoicePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([INVOICE_LAYOUT_DIMENSIONS.pageWidth, INVOICE_LAYOUT_DIMENSIONS.pageHeight]);
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const layout = buildInvoiceLayoutModel(invoice);

  const marginX = INVOICE_LAYOUT_DIMENSIONS.pagePaddingX;
  const pageWidth = INVOICE_LAYOUT_DIMENSIONS.pageWidth;
  const pageHeight = INVOICE_LAYOUT_DIMENSIONS.pageHeight;
  const contentWidth = INVOICE_LAYOUT_DIMENSIONS.contentWidth;
  const metaWidth = INVOICE_LAYOUT_DIMENSIONS.metaColumnWidth;
  const recipientWidth = INVOICE_LAYOUT_DIMENSIONS.recipientBoxWidth;
  const totalsWidth = INVOICE_LAYOUT_DIMENSIONS.totalsBoxWidth;

  const colors = {
    text: { r: 0.26, g: 0.23, b: 0.22 },
    muted: { r: 0.45, g: 0.4, b: 0.38 },
    accent: { r: 0.7, g: 0.47, b: 0.36 },
    border: { r: 0.92, g: 0.88, b: 0.86 },
    boxBg: { r: 1, g: 0.97, b: 0.96 },
    highlight: { r: 0.97, g: 0.92, b: 0.9 },
  };

  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: rgb(1, 1, 1),
  });

  const watermarkPath = path.join(
    process.cwd(),
    "public",
    "branding",
    "bella_logo_symbol_transparent.png",
  );

  try {
    const watermarkBytes = await readFile(watermarkPath);
    const watermark = await pdf.embedPng(watermarkBytes);
    const scale = 0.44;
    const width = watermark.width * scale;
    const height = watermark.height * scale;
    page.drawImage(watermark, {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2 - 46,
      width,
      height,
      opacity: 0.055,
    });
  } catch {
    // keep generation resilient
  }

  const logoPath = path.join(process.cwd(), "public", "branding", "bella-logo-transparent.png");
  const logoBytes = await readFile(logoPath);
  const logo = await pdf.embedPng(logoBytes);

  const logoScale = Math.min(
    INVOICE_LAYOUT_DIMENSIONS.logoMaxWidth / logo.width,
    INVOICE_LAYOUT_DIMENSIONS.logoMaxHeight / logo.height,
  );
  const logoWidth = logo.width * logoScale;
  const logoHeight = logo.height * logoScale;

  const topY = pageHeight - 44;
  const logoY = topY - logoHeight;

  page.drawImage(logo, {
    x: marginX,
    y: logoY,
    width: logoWidth,
    height: logoHeight,
  });

  const senderLines = layout.senderLines
    .slice(0, 8)
    .flatMap((line) => wrapText(line, 280, fontRegular, 9.5));

  drawTextLines({
    page,
    lines: senderLines,
    x: marginX,
    yTop: logoY - 14,
    lineHeight: 12,
    size: 9.5,
    font: fontRegular,
    color: colors.muted,
  });

  const recipientLines = layout.recipientLines
    .slice(0, 8)
    .flatMap((line) => wrapText(line, recipientWidth - 24, fontRegular, 10));

  const recipientBoxTop = logoY - 14 - senderLines.length * 12 - 18;
  const recipientBoxHeight = Math.max(84, recipientLines.length * 12 + 28);
  const recipientBoxY = recipientBoxTop - recipientBoxHeight;

  page.drawRectangle({
    x: marginX,
    y: recipientBoxY,
    width: recipientWidth,
    height: recipientBoxHeight,
    color: rgb(colors.boxBg.r, colors.boxBg.g, colors.boxBg.b),
    borderColor: rgb(colors.border.r, colors.border.g, colors.border.b),
    borderWidth: 1,
  });

  page.drawText("RECHNUNGSEMPFÄNGER", {
    x: marginX + 10,
    y: recipientBoxTop - 15,
    size: 8.6,
    font: fontBold,
    color: rgb(colors.accent.r, colors.accent.g, colors.accent.b),
  });

  drawTextLines({
    page,
    lines: recipientLines,
    x: marginX + 10,
    yTop: recipientBoxTop - 31,
    lineHeight: 12,
    size: 10,
    font: fontRegular,
    color: colors.text,
  });

  const metaX = pageWidth - marginX - metaWidth;
  const metaTop = topY;
  const metaHeight = 210;
  const metaY = metaTop - metaHeight;

  page.drawRectangle({
    x: metaX,
    y: metaY,
    width: metaWidth,
    height: metaHeight,
    color: rgb(colors.boxBg.r, colors.boxBg.g, colors.boxBg.b),
    borderColor: rgb(colors.border.r, colors.border.g, colors.border.b),
    borderWidth: 1,
  });

  const title = "RECHNUNG";
  const titleSize = 18;
  const titleWidth = fontBold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: metaX + (metaWidth - titleWidth) / 2,
    y: metaTop - 35,
    size: titleSize,
    font: fontBold,
    color: rgb(colors.accent.r, colors.accent.g, colors.accent.b),
  });

  const metaRows = [
    ["Rechnungsnummer", layout.invoiceLabel],
    ["Rechnungsdatum", layout.issueDate],
    ["Leistungsdatum", layout.serviceDate],
    ["Kundennummer", layout.customerNumberLabel],
    ["Zahlungsart", layout.paymentMethodLabel],
  ] as const;

  let metaRowY = metaTop - 68;
  for (const [label, value] of metaRows) {
    page.drawText(label, {
      x: metaX + 12,
      y: metaRowY,
      size: 10,
      font: fontBold,
      color: rgb(colors.text.r, colors.text.g, colors.text.b),
    });
    drawRightAligned({
      page,
      text: value,
      rightX: metaX + metaWidth - 12,
      y: metaRowY,
      size: 10,
      font: fontRegular,
      color: colors.text,
    });
    metaRowY -= 26;
  }

  const tableTop = Math.min(recipientBoxY, metaY) - 30;
  const tableHeaderY = tableTop - 16;

  page.drawLine({
    start: { x: marginX, y: tableTop },
    end: { x: marginX + contentWidth, y: tableTop },
    thickness: 1,
    color: rgb(colors.border.r, colors.border.g, colors.border.b),
  });

  const colServiceX = marginX + 8;
  const colQtyRight = marginX + contentWidth - 242;
  const colUnitRight = marginX + contentWidth - 120;
  const colTotalRight = marginX + contentWidth - 8;

  page.drawText("LEISTUNG", {
    x: colServiceX,
    y: tableHeaderY,
    size: 8.8,
    font: fontBold,
    color: rgb(colors.accent.r, colors.accent.g, colors.accent.b),
  });
  drawRightAligned({
    page,
    text: "ANZAHL",
    rightX: colQtyRight,
    y: tableHeaderY,
    size: 8.8,
    font: fontBold,
    color: colors.accent,
  });
  drawRightAligned({
    page,
    text: "EINZELPREIS",
    rightX: colUnitRight,
    y: tableHeaderY,
    size: 8.8,
    font: fontBold,
    color: colors.accent,
  });
  drawRightAligned({
    page,
    text: "BETRAG",
    rightX: colTotalRight,
    y: tableHeaderY,
    size: 8.8,
    font: fontBold,
    color: colors.accent,
  });

  page.drawLine({
    start: { x: marginX, y: tableHeaderY - 8 },
    end: { x: marginX + contentWidth, y: tableHeaderY - 8 },
    thickness: 1,
    color: rgb(colors.border.r, colors.border.g, colors.border.b),
  });

  let rowTopY = tableHeaderY - 22;
  const rowLimitY = 332;

  for (const item of layout.items.slice(0, 12)) {
    const serviceLines = wrapText(item.service, 286, fontBold, 10);
    const descriptionLines = item.description
      ? wrapText(item.description, 286, fontRegular, 8.7)
      : [];
    const rowHeight = Math.max(30, serviceLines.length * 12 + descriptionLines.length * 10 + 8);
    const rowBottom = rowTopY - rowHeight;

    if (rowBottom < rowLimitY) {
      break;
    }

    drawTextLines({
      page,
      lines: serviceLines,
      x: colServiceX,
      yTop: rowTopY - 2,
      lineHeight: 12,
      size: 10,
      font: fontBold,
      color: colors.text,
    });

    if (descriptionLines.length > 0) {
      drawTextLines({
        page,
        lines: descriptionLines,
        x: colServiceX,
        yTop: rowTopY - 2 - serviceLines.length * 12,
        lineHeight: 10,
        size: 8.7,
        font: fontRegular,
        color: { r: 0.53, g: 0.49, b: 0.47 },
      });
    }

    drawRightAligned({
      page,
      text: item.quantity,
      rightX: colQtyRight,
      y: rowTopY - 2,
      size: 10,
      font: fontRegular,
      color: colors.text,
    });
    drawRightAligned({
      page,
      text: item.unitPrice,
      rightX: colUnitRight,
      y: rowTopY - 2,
      size: 10,
      font: fontRegular,
      color: colors.text,
    });
    drawRightAligned({
      page,
      text: item.total,
      rightX: colTotalRight,
      y: rowTopY - 2,
      size: 10,
      font: fontRegular,
      color: colors.text,
    });

    page.drawLine({
      start: { x: marginX, y: rowBottom },
      end: { x: marginX + contentWidth, y: rowBottom },
      thickness: 1,
      color: rgb(0.94, 0.91, 0.9),
    });

    rowTopY = rowBottom - 10;
  }

  const infoTop = 304;

  const paymentLeftLines = layout.payment.leftLines.flatMap((line) =>
    wrapText(line, 286, fontRegular, 9.2),
  );
  const paymentRightLines = layout.payment.rightLines.flatMap((line) =>
    wrapText(line, 286, fontRegular, 9.2),
  );

  const paymentLines = [layout.payment.title, ...paymentLeftLines, ...paymentRightLines];
  const paymentHeight = Math.max(72, 22 + paymentLines.length * 11);
  const paymentY = infoTop - paymentHeight;

  page.drawRectangle({
    x: marginX,
    y: paymentY,
    width: contentWidth - totalsWidth - 20,
    height: paymentHeight,
    color: rgb(1, 0.98, 0.97),
    borderColor: rgb(colors.border.r, colors.border.g, colors.border.b),
    borderWidth: 1,
  });

  page.drawText("ZAHLUNGSINFORMATIONEN", {
    x: marginX + 12,
    y: infoTop - 16,
    size: 8.4,
    font: fontBold,
    color: rgb(colors.accent.r, colors.accent.g, colors.accent.b),
  });

  drawTextLines({
    page,
    lines: paymentLines,
    x: marginX + 12,
    yTop: infoTop - 31,
    lineHeight: 11,
    size: 9.2,
    font: fontRegular,
    color: colors.text,
  });

  let legalBottomAnchor = paymentY - 12;
  if (layout.legalNote) {
    const legalLines = wrapText(layout.legalNote, 286, fontRegular, 9.1);
    const legalHeight = Math.max(54, 22 + legalLines.length * 11);
    const legalY = legalBottomAnchor - legalHeight;
    page.drawRectangle({
      x: marginX,
      y: legalY,
      width: contentWidth - totalsWidth - 20,
      height: legalHeight,
      color: rgb(1, 0.98, 0.97),
      borderColor: rgb(colors.border.r, colors.border.g, colors.border.b),
      borderWidth: 1,
    });

    page.drawText("RECHTLICHER HINWEIS", {
      x: marginX + 12,
      y: legalBottomAnchor - 16,
      size: 8.4,
      font: fontBold,
      color: rgb(colors.accent.r, colors.accent.g, colors.accent.b),
    });

    drawTextLines({
      page,
      lines: legalLines,
      x: marginX + 12,
      yTop: legalBottomAnchor - 31,
      lineHeight: 11,
      size: 9.1,
      font: fontRegular,
      color: colors.text,
    });

    legalBottomAnchor = legalY - 8;
  }

  const totalsX = marginX + contentWidth - totalsWidth;
  const totalsTop = infoTop;
  const totalsHeight = 132;
  const totalsY = totalsTop - totalsHeight;

  page.drawRectangle({
    x: totalsX,
    y: totalsY,
    width: totalsWidth,
    height: totalsHeight,
    color: rgb(1, 0.98, 0.97),
    borderColor: rgb(colors.border.r, colors.border.g, colors.border.b),
    borderWidth: 1,
  });

  page.drawText("Zwischensumme", {
    x: totalsX + 12,
    y: totalsTop - 18,
    size: 9.8,
    font: fontRegular,
    color: rgb(colors.text.r, colors.text.g, colors.text.b),
  });
  drawRightAligned({
    page,
    text: layout.subtotalDisplay,
    rightX: totalsX + totalsWidth - 12,
    y: totalsTop - 18,
    size: 9.8,
    font: fontRegular,
    color: colors.text,
  });

  page.drawText("Rabatt", {
    x: totalsX + 12,
    y: totalsTop - 38,
    size: 9.8,
    font: fontRegular,
    color: rgb(colors.text.r, colors.text.g, colors.text.b),
  });
  drawRightAligned({
    page,
    text: layout.discountDisplay,
    rightX: totalsX + totalsWidth - 12,
    y: totalsTop - 38,
    size: 9.8,
    font: fontRegular,
    color: colors.text,
  });

  page.drawRectangle({
    x: totalsX,
    y: totalsTop - 78,
    width: totalsWidth,
    height: 34,
    color: rgb(colors.highlight.r, colors.highlight.g, colors.highlight.b),
    borderColor: rgb(0.89, 0.8, 0.76),
    borderWidth: 1,
  });

  page.drawText("Gesamtbetrag", {
    x: totalsX + 12,
    y: totalsTop - 65,
    size: 11.6,
    font: fontBold,
    color: rgb(0.33, 0.2, 0.19),
  });

  drawRightAligned({
    page,
    text: layout.totalDisplay,
    rightX: totalsX + totalsWidth - 12,
    y: totalsTop - 67,
    size: 15,
    font: fontBold,
    color: { r: 0.33, g: 0.2, b: 0.19 },
  });

  drawRightAligned({
    page,
    text: layout.payableHint,
    rightX: totalsX + totalsWidth - 12,
    y: totalsTop - 102,
    size: 9.2,
    font: fontRegular,
    color: colors.muted,
  });

  const footerLineY = 92;
  page.drawLine({
    start: { x: marginX, y: footerLineY },
    end: { x: marginX + contentWidth, y: footerLineY },
    thickness: 1,
    color: rgb(colors.border.r, colors.border.g, colors.border.b),
  });

  const footerLines = layout.senderLines.slice(0, 7);
  drawTextLines({
    page,
    lines: footerLines,
    x: marginX,
    yTop: footerLineY - 15,
    lineHeight: 10.6,
    size: 8.8,
    font: fontRegular,
    color: colors.muted,
  });

  if (layout.closingText) {
    drawRightAligned({
      page,
      text: layout.closingText,
      rightX: marginX + contentWidth,
      y: footerLineY - 24,
      size: 17,
      font: fontRegular,
      color: { r: 0.77, g: 0.56, b: 0.47 },
    });
  }

  if (layout.additionalFooterNote) {
    const footerNoteLines = wrapText(layout.additionalFooterNote, 180, fontRegular, 8.8);
    drawTextLines({
      page,
      lines: footerNoteLines,
      x: marginX + contentWidth - 180,
      yTop: footerLineY - 42,
      lineHeight: 10,
      size: 8.8,
      font: fontRegular,
      color: colors.muted,
    });
  }

  return pdf.save();
}
