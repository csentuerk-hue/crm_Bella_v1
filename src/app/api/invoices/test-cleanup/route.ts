import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serverError, validationError } from "@/lib/api";
import { requirePermission } from "@/lib/permissions";
import { ensureDatabaseInitialized, prisma } from "@/lib/prisma";
import {
  classifyTestInvoices,
  TEST_INVOICE_ACTION_LABEL,
  TEST_INVOICE_CONFIRMATION_TEXT,
  type TestInvoiceDetectionInput,
} from "@/lib/test-invoice-cleanup";

const cleanupRequestSchema = z.object({
  confirmation: z.string().optional(),
});

async function loadInvoiceCandidates(): Promise<TestInvoiceDetectionInput[]> {
  const invoices = await prisma.invoice.findMany({
    select: {
      id: true,
      invoiceNumber: true,
      totalCents: true,
      amountCents: true,
      customerId: true,
      recipientName: true,
      recipientEmail: true,
      recipientAttention: true,
      recipientLine2: true,
      recipientNotes: true,
      closingText: true,
      additionalFooterNote: true,
      items: {
        select: {
          title: true,
          description: true,
          service: true,
        },
      },
    },
  });
  const customerIds = Array.from(
    new Set(
      invoices
        .map((invoice) => invoice.customerId)
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
    ),
  );
  const customers =
    customerIds.length === 0
      ? []
      : await prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: {
            id: true,
            name: true,
            email: true,
          },
        });
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));

  return invoices.map((invoice) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amountCents: invoice.totalCents || invoice.amountCents,
    customerId: invoice.customerId,
    recipientName: invoice.recipientName,
    recipientEmail: invoice.recipientEmail,
    recipientAttention: invoice.recipientAttention,
    recipientLine2: invoice.recipientLine2,
    recipientNotes: invoice.recipientNotes,
    closingText: invoice.closingText,
    additionalFooterNote: invoice.additionalFooterNote,
    customer: invoice.customerId
      ? customerById.get(invoice.customerId) ?? null
      : null,
    items: invoice.items,
  }));
}

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, "invoices:write");
  if (auth.denied) {
    return auth.denied;
  }

  try {
    await ensureDatabaseInitialized();
    const classification = classifyTestInvoices(await loadInvoiceCandidates());

    return NextResponse.json({
      actionLabel: TEST_INVOICE_ACTION_LABEL,
      requiredConfirmation: TEST_INVOICE_CONFIRMATION_TEXT,
      candidates: classification.candidates,
      skipped: classification.skipped,
      summary: {
        candidates: classification.candidates.length,
        skipped: classification.skipped.length,
      },
    });
  } catch {
    return serverError("Testrechnungen konnten nicht geladen werden.");
  }
}

export async function POST(request: NextRequest) {
  const auth = requirePermission(request, "invoices:write");
  if (auth.denied) {
    return auth.denied;
  }

  try {
    await ensureDatabaseInitialized();

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
    }

    const parsed = cleanupRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    if ((parsed.data.confirmation ?? "") !== TEST_INVOICE_CONFIRMATION_TEXT) {
      return NextResponse.json(
        {
          error:
            "Bestätigung fehlt. Bitte exakt 'DELETE TEST INVOICES' eingeben.",
          requiredConfirmation: TEST_INVOICE_CONFIRMATION_TEXT,
        },
        { status: 400 },
      );
    }

    const classification = classifyTestInvoices(await loadInvoiceCandidates());
    const ids = classification.candidates.map((invoice) => invoice.id);

    if (ids.length === 0) {
      return NextResponse.json({
        actionLabel: TEST_INVOICE_ACTION_LABEL,
        requiredConfirmation: TEST_INVOICE_CONFIRMATION_TEXT,
        deletedInvoices: 0,
        deletedLineItems: 0,
        deletedInvoiceNumbers: [] as string[],
        skipped: classification.skipped,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const deletedLineItems = await tx.invoiceItem.deleteMany({
        where: {
          invoiceId: {
            in: ids,
          },
        },
      });

      const deletedInvoices = await tx.invoice.deleteMany({
        where: {
          id: {
            in: ids,
          },
        },
      });

      return {
        deletedLineItems: deletedLineItems.count,
        deletedInvoices: deletedInvoices.count,
      };
    });

    return NextResponse.json({
      actionLabel: TEST_INVOICE_ACTION_LABEL,
      requiredConfirmation: TEST_INVOICE_CONFIRMATION_TEXT,
      deletedInvoices: result.deletedInvoices,
      deletedLineItems: result.deletedLineItems,
      deletedInvoiceNumbers: classification.candidates.map(
        (invoice) => invoice.invoiceNumber,
      ),
      skipped: classification.skipped,
    });
  } catch {
    return serverError("Testrechnungen konnten nicht gelöscht werden.");
  }
}


