"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";

import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { InlineNotice } from "@/components/inline-notice";
import { PageHeader } from "@/components/page-header";
import { apiRequest } from "@/lib/client-api";
import { buildExpectedInvoicePdfFileName } from "@/lib/invoice-pdf";
import type { InvoiceDTO } from "@/types/crm";

export default function InvoicePreviewPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const invoiceId = params.id;
  const invoiceNumberHint = searchParams.get("invoiceNumber") ?? "";
  const [invoice, setInvoice] = useState<InvoiceDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadInvoice() {
      try {
        setIsLoading(true);
        const query = invoiceNumberHint
          ? `?invoiceNumber=${encodeURIComponent(invoiceNumberHint)}`
          : "";
        const response = await apiRequest<InvoiceDTO>(`/api/invoices/${invoiceId}${query}`);
        setInvoice(response);
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Rechnung nicht gefunden.");
      } finally {
        setIsLoading(false);
      }
    }

    if (invoiceId) {
      void loadInvoice();
    }
  }, [invoiceId, invoiceNumberHint]);

  const pdfUrl = useMemo(() => {
    const query = new URLSearchParams();
    if (invoiceNumberHint) {
      query.set("invoiceNumber", invoiceNumberHint);
    }
    if (invoice?.updatedAt) {
      query.set("v", invoice.updatedAt);
    }
    const suffix = query.toString();
    return suffix ? `/api/invoices/${invoiceId}/pdf?${suffix}` : `/api/invoices/${invoiceId}/pdf`;
  }, [invoice?.updatedAt, invoiceId, invoiceNumberHint]);

  const downloadPdfUrl = useMemo(() => {
    const query = new URLSearchParams();
    if (invoiceNumberHint) {
      query.set("invoiceNumber", invoiceNumberHint);
    }
    if (invoice?.updatedAt) {
      query.set("v", invoice.updatedAt);
    }
    query.set("download", "true");
    return `/api/invoices/${invoiceId}/pdf?${query.toString()}`;
  }, [invoice?.updatedAt, invoiceId, invoiceNumberHint]);

  const expectedPdfFileName = useMemo(() => {
    if (!invoice) {
      return "BBS-Rechnung.pdf";
    }
    return buildExpectedInvoicePdfFileName({
      invoiceNumber: invoice.invoiceNumber,
      recipientName: invoice.recipientName,
      customerName: invoice.customerName,
      issueDate: invoice.issueDate,
      serviceDate: invoice.serviceDate,
    });
  }, [invoice]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-hidden">
      <PageHeader
        title="Rechnungsvorschau"
        actions={
          <Link href="/invoices/archive" className="btn-secondary">
            <ArrowLeft className="mr-2 size-4" />
            Zurück zum Archiv
          </Link>
        }
      />

      {error ? <InlineNotice type="error" text={error} /> : null}
      {isLoading ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Vorschau wird geladen...
        </section>
      ) : null}

      {invoice ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-auto pr-1">
          <InvoiceDocument invoice={invoice} />

          <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-end gap-2 px-2">
              <div className="flex gap-2">
                <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                  <Printer className="mr-2 size-4" />
                  Drucken
                </a>
                <a
                  href={downloadPdfUrl}
                  download={expectedPdfFileName}
                  className="btn-primary"
                >
                  <Download className="mr-2 size-4" />
                  PDF exportieren
                </a>
              </div>
            </div>
            <iframe
              src={pdfUrl}
              title={`Rechnung ${invoice.invoiceNumber ?? "Entwurf"}`}
              className="h-[56vh] w-full rounded-2xl border border-slate-200 md:h-[60vh] lg:h-[68vh]"
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}
