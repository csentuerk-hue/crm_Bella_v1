import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { reconcileAppointmentInvoiceConsistency } from "@/lib/data-consistency";
import { resolveInvoiceByIdentifier } from "@/lib/invoice-query";
import { getOrCreateInvoiceSettings } from "@/lib/invoice-settings";
import { buildExpectedInvoicePdfFileName } from "@/lib/invoice-pdf";
import { applyInvoiceSettingsFallback } from "@/lib/invoice-view";
import { buildInvoicePdf } from "@/lib/pdf";
import { requirePermission } from "@/lib/permissions";
import { ensureDatabaseInitialized, prisma } from "@/lib/prisma";
import { toInvoiceDTO } from "@/lib/serializers";

const paramsSchema = z.object({ id: z.string().min(1) });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requirePermission(request, "invoices:read");
  if (auth.denied) {
    return auth.denied;
  }

  try {
    await ensureDatabaseInitialized();
    await reconcileAppointmentInvoiceConsistency();
    const settings = await getOrCreateInvoiceSettings(prisma);

    const parsedParams = paramsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: "Ungültige Rechnung." }, { status: 400 });
    }

    const invoice = await resolveInvoiceByIdentifier(
      parsedParams.data.id,
      request.nextUrl.searchParams.get("invoiceNumber"),
    );

    if (!invoice) {
      return NextResponse.json({ error: "Rechnung nicht gefunden." }, { status: 404 });
    }

    const invoiceDto = applyInvoiceSettingsFallback(toInvoiceDTO(invoice), settings);

    const pdfBytes = await buildInvoicePdf({
      invoice: invoiceDto,
    });

    const shouldDownload = request.nextUrl.searchParams.get("download") === "true";
    const fileName = buildExpectedInvoicePdfFileName({
      invoiceNumber: invoiceDto.invoiceNumber,
      recipientName: invoiceDto.recipientName,
      customerName: invoiceDto.customerName,
      issueDate: invoiceDto.issueDate,
      serviceDate: invoiceDto.serviceDate,
    });

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${shouldDownload ? "attachment" : "inline"}; filename=\"${fileName}\"`,
        "Cache-Control": "no-store",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch {
    return NextResponse.json({ error: "PDF konnte nicht erzeugt werden." }, { status: 500 });
  }
}
