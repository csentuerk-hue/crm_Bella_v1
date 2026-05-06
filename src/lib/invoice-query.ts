import { prisma } from "@/lib/prisma";

export async function resolveInvoiceByIdentifier(
  identifier: string,
  fallbackInvoiceNumber?: string | null,
) {
  const invoiceInclude = {
    items: true,
    customer: true,
    appointment: {
      include: { customer: true },
    },
  } as const;

  const direct = await prisma.invoice.findUnique({
    where: { id: identifier },
    include: invoiceInclude,
  });
  if (direct) {
    return direct;
  }

  const invoiceNumber = fallbackInvoiceNumber || identifier;
  const byNumber = await prisma.invoice.findUnique({
    where: { invoiceNumber },
    include: invoiceInclude,
  });
  if (byNumber) {
    return byNumber;
  }

  if (/^\d+$/.test(identifier)) {
    const bySequence = await prisma.invoice.findFirst({
      where: { sequence: Number.parseInt(identifier, 10) },
      include: invoiceInclude,
    });
    if (bySequence) {
      return bySequence;
    }
  }

  const byAppointment = await prisma.invoice.findFirst({
    where: { appointmentId: identifier },
    include: invoiceInclude,
  });

  return byAppointment;
}
