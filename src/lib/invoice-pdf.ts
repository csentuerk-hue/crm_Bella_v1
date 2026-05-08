export type InvoicePdfStatus = "MISSING" | "DOWNLOADED" | "SAVED";

type MaybeDate = string | Date | null | undefined;

type InvoicePdfFileNameInput = {
  invoiceNumber?: string | null;
  recipientName?: string | null;
  customerName?: string | null;
  issueDate?: MaybeDate;
  serviceDate?: MaybeDate;
};

type InvoicePdfStatusInput = {
  pdfDownloadedAt?: MaybeDate;
  pdfMarkedSavedAt?: MaybeDate;
};

const FILE_EXTENSION = ".pdf";

function transliterateGerman(value: string): string {
  return value
    .replaceAll("Ä", "Ae")
    .replaceAll("Ö", "Oe")
    .replaceAll("Ü", "Ue")
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss");
}

function sanitizeSegment(value: string): string {
  const ascii = transliterateGerman(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/[-_.]{2,}/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");

  return ascii.slice(0, 64);
}

function toDatePart(value: MaybeDate): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function todayDatePart(): string {
  return new Date().toISOString().slice(0, 10);
}

function trimExtension(fileName: string): string {
  return fileName.endsWith(FILE_EXTENSION)
    ? fileName.slice(0, -FILE_EXTENSION.length)
    : fileName;
}

export function buildExpectedInvoicePdfFileName(
  input: InvoicePdfFileNameInput,
): string {
  const invoiceNumber = sanitizeSegment((input.invoiceNumber ?? "").trim());
  const recipient = sanitizeSegment(
    (input.recipientName ?? input.customerName ?? "").trim(),
  );
  const datePart =
    toDatePart(input.issueDate) ?? toDatePart(input.serviceDate) ?? todayDatePart();

  const parts: string[] = [];

  if (invoiceNumber) {
    parts.push(invoiceNumber);
  } else {
    parts.push("BBS-Rechnung");
  }

  if (recipient) {
    parts.push(recipient);
  }

  parts.push(datePart);

  const baseName = sanitizeSegment(parts.join("_")).slice(0, 160);
  const finalBaseName = baseName || `rechnung-entwurf_${datePart}`;

  return `${trimExtension(finalBaseName)}${FILE_EXTENSION}`;
}

export function deriveInvoicePdfStatus(input: InvoicePdfStatusInput): InvoicePdfStatus {
  const hasSaved = Boolean(input.pdfMarkedSavedAt);
  if (hasSaved) {
    return "SAVED";
  }
  const hasDownloaded = Boolean(input.pdfDownloadedAt);
  if (hasDownloaded) {
    return "DOWNLOADED";
  }
  return "MISSING";
}
