import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validationError } from "@/lib/api";
import { reconcileAppointmentInvoiceConsistency } from "@/lib/data-consistency";
import { getOrCreateInvoiceSettings } from "@/lib/invoice-settings";
import { buildExpectedInvoicePdfFileName } from "@/lib/invoice-pdf";
import { resolveInvoiceByIdentifier } from "@/lib/invoice-query";
import { applyInvoiceSettingsFallback } from "@/lib/invoice-view";
import { requirePermission } from "@/lib/permissions";
import { ensureDatabaseInitialized, prisma } from "@/lib/prisma";
import { toInvoiceDTO } from "@/lib/serializers";

const paramsSchema = z.object({ id: z.string().min(1) });
const bodySchema = z.object({
  action: z.enum(["MARK_DOWNLOADED", "MARK_SAVED", "RESET"]),
});

const invoiceInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      customerNumber: true,
      email: true,
      phone: true,
      street: true,
      houseNumber: true,
      postalCode: true,
      city: true,
      country: true,
      billingAddressEnabled: true,
      invoiceRecipientName: true,
      invoiceRecipientAttention: true,
      invoiceRecipientLine2: true,
      invoiceStreet: true,
      invoiceHouseNumber: true,
      invoicePostalCode: true,
      invoiceCity: true,
      invoiceCountry: true,
      invoiceEmail: true,
      invoicePhone: true,
      invoiceNotes: true,
    },
  },
  appointment: {
    select: {
      id: true,
      startsAt: true,
      service: true,
      customer: { select: { name: true } },
    },
  },
  items: true,
} as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requirePermission(request, "invoices:write");
  if (auth.denied) {
    return auth.denied;
  }

  try {
    await ensureDatabaseInitialized();
    await reconcileAppointmentInvoiceConsistency();

    const parsedParams = paramsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return validationError(parsedParams.error);
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
    }

    const parsedBody = bodySchema.safeParse(payload);
    if (!parsedBody.success) {
      return validationError(parsedBody.error);
    }

    const invoice = await resolveInvoiceByIdentifier(
      parsedParams.data.id,
      request.nextUrl.searchParams.get("invoiceNumber"),
    );

    if (!invoice) {
      return NextResponse.json({ error: "Rechnung nicht gefunden." }, { status: 404 });
    }

    const settings = await getOrCreateInvoiceSettings(prisma);
    const invoiceDto = applyInvoiceSettingsFallback(toInvoiceDTO(invoice), settings);
    const expectedFileName = buildExpectedInvoicePdfFileName({
      invoiceNumber: invoiceDto.invoiceNumber,
      recipientName: invoiceDto.recipientName,
      customerName: invoiceDto.customerName,
      issueDate: invoiceDto.issueDate,
      serviceDate: invoiceDto.serviceDate,
    });

    const now = new Date();
    const action = parsedBody.data.action;

    const updateData =
      action === "MARK_DOWNLOADED"
        ? {
            pdfDownloadedAt: now,
            pdfFileName: expectedFileName,
          }
        : action === "MARK_SAVED"
          ? {
              pdfDownloadedAt: invoice.pdfDownloadedAt ?? now,
              pdfMarkedSavedAt: now,
              pdfFileName: expectedFileName,
            }
          : {
              pdfDownloadedAt: null,
              pdfMarkedSavedAt: null,
              pdfFileName: expectedFileName,
            };

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: updateData,
      include: invoiceInclude,
    });

    return NextResponse.json(
      applyInvoiceSettingsFallback(toInvoiceDTO(updated), settings),
    );
  } catch {
    return NextResponse.json(
      { error: "PDF-Status konnte nicht aktualisiert werden." },
      { status: 500 },
    );
  }
}
