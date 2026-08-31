"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, RefreshCcw, Search, Trash2 } from "lucide-react";

import { InvoiceAreaSwitch } from "@/components/invoices/invoice-area-switch";
import { InlineNotice } from "@/components/inline-notice";
import { PageHeader } from "@/components/page-header";
import { apiRequest } from "@/lib/client-api";
import { INVOICE_LIFECYCLE_LABELS } from "@/lib/constants";
import { formatEuroFromCents } from "@/lib/currency";
import { formatDate } from "@/lib/datetime";
import {
  buildExpectedInvoicePdfFileName,
  deriveInvoicePdfStatus,
  type InvoicePdfStatus,
} from "@/lib/invoice-pdf";
import {
  TEST_INVOICE_ACTION_LABEL,
  TEST_INVOICE_CONFIRMATION_TEXT,
} from "@/lib/test-invoice-cleanup";
import type { InvoiceDTO, InvoiceLifecycleStatus, PaymentStatus } from "@/types/crm";

type LifecycleFilter = "ALL" | InvoiceLifecycleStatus;
type PaymentFilter = "ALL" | "OPEN" | "PAID";
type PdfFilter = "ALL" | "MISSING" | "DOWNLOADED" | "SAVED";

type InvoiceCleanupCandidate = {
  id: string;
  invoiceNumber: string;
  recipientName: string;
  amountCents: number;
  reasons: string[];
};

type InvoiceCleanupSkipped = {
  id: string;
  invoiceNumber: string;
  recipientName: string;
  amountCents: number;
  reason: string;
};

type InvoiceCleanupReport = {
  actionLabel: string;
  requiredConfirmation: string;
  candidates: InvoiceCleanupCandidate[];
  skipped: InvoiceCleanupSkipped[];
  summary: {
    candidates: number;
    skipped: number;
  };
  deletedInvoices: number;
  deletedLineItems: number;
  deletedInvoiceNumbers: string[];
};

const lifecycleFilters: Array<{ value: LifecycleFilter; label: string }> = [
  { value: "ALL", label: "Alle" },
  { value: "FINALISIERT", label: "Finalisiert" },
  { value: "ENTWURF", label: "Entwurf" },
];

const paymentFilters: Array<{ value: PaymentFilter; label: string }> = [
  { value: "ALL", label: "Alle Zahlungen" },
  { value: "OPEN", label: "Offen" },
  { value: "PAID", label: "Bezahlt" },
];

const pdfFilters: Array<{ value: PdfFilter; label: string }> = [
  { value: "ALL", label: "Alle PDF-Status" },
  { value: "MISSING", label: "PDF fehlt" },
  { value: "DOWNLOADED", label: "PDF heruntergeladen" },
  { value: "SAVED", label: "PDF gespeichert" },
];

function toPaymentStatusLabel(status: PaymentStatus): string {
  return status === "PAID" ? "bezahlt" : "offen";
}

function toPdfStatusLabel(status: InvoicePdfStatus): string {
  if (status === "SAVED") {
    return "PDF gespeichert";
  }
  if (status === "DOWNLOADED") {
    return "PDF heruntergeladen";
  }
  return "PDF fehlt";
}

function toPdfStatusBadgeClasses(status: InvoicePdfStatus): string {
  if (status === "SAVED") {
    return "border-[#cde5d7] bg-[#eef9f2] text-[#2f6a49]";
  }
  if (status === "DOWNLOADED") {
    return "border-[#d8e3f5] bg-[#f2f7ff] text-[#35527a]";
  }
  return "border-[#f2d5c7] bg-[#fff4ee] text-[#8a5134]";
}

function toPdfStatus(invoice: InvoiceDTO): InvoicePdfStatus {
  return deriveInvoicePdfStatus({
    pdfDownloadedAt: invoice.pdfDownloadedAt,
    pdfMarkedSavedAt: invoice.pdfMarkedSavedAt,
  });
}

function resolveExpectedPdfFileName(invoice: InvoiceDTO): string {
  return (
    invoice.pdfFileName ??
    buildExpectedInvoicePdfFileName({
      invoiceNumber: invoice.invoiceNumber,
      recipientName: invoice.recipientName,
      customerName: invoice.customerName,
      issueDate: invoice.issueDate,
      serviceDate: invoice.serviceDate,
    })
  );
}

function previewHref(invoice: InvoiceDTO) {
  const params = new URLSearchParams();
  if (invoice.invoiceNumber) {
    params.set("invoiceNumber", invoice.invoiceNumber);
  }
  const suffix = params.toString();
  return suffix
    ? `/invoices/${invoice.id}/preview?${suffix}`
    : `/invoices/${invoice.id}/preview`;
}

function pdfHref(invoice: InvoiceDTO) {
  const params = new URLSearchParams();
  if (invoice.invoiceNumber) {
    params.set("invoiceNumber", invoice.invoiceNumber);
  }
  params.set("download", "true");
  return `/api/invoices/${invoice.id}/pdf?${params.toString()}`;
}

export default function InvoiceArchivePage() {
  const [invoices, setInvoices] = useState<InvoiceDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);
  const [updatingPdfInvoiceId, setUpdatingPdfInvoiceId] = useState<string | null>(null);
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>("FINALISIERT");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("ALL");
  const [pdfFilter, setPdfFilter] = useState<PdfFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [notice, setNotice] = useState<
    { type: "success" | "error" | "info"; text: string } | null
  >(null);
  const [cleanupReport, setCleanupReport] = useState<InvoiceCleanupReport | null>(null);
  const [cleanupConfirmText, setCleanupConfirmText] = useState("");
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (lifecycleFilter !== "ALL") {
        query.set("lifecycle", lifecycleFilter);
      }
      if (paymentFilter !== "ALL") {
        query.set("status", paymentFilter === "OPEN" ? "OFFEN" : "BEZAHLT");
      }
      if (searchQuery.trim()) {
        query.set("query", searchQuery.trim());
      }
      if (dateFrom) {
        query.set("dateFrom", dateFrom);
      }
      if (dateTo) {
        query.set("dateTo", dateTo);
      }
      const url = query.toString() ? `/api/invoices?${query.toString()}` : "/api/invoices";
      const data = await apiRequest<InvoiceDTO[]>(url);
      setInvoices(data);
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Rechnungsarchiv konnte nicht geladen werden.",
      });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, lifecycleFilter, paymentFilter, searchQuery]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  const updatePaymentStatus = async (invoiceId: string, status: PaymentStatus) => {
    try {
      setUpdatingPaymentId(invoiceId);
      const updated = await apiRequest<InvoiceDTO>(`/api/invoices/${invoiceId}`, {
        method: "PUT",
        body: { paymentStatus: status },
      });
      setInvoices((current) =>
        current.map((invoice) => (invoice.id === invoiceId ? updated : invoice)),
      );
      setNotice({
        type: "success",
        text: `Zahlungsstatus wurde auf '${toPaymentStatusLabel(updated.paymentStatus)}' gesetzt.`,
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Zahlungsstatus konnte nicht aktualisiert werden.",
      });
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const updatePdfStatus = async (
    invoice: InvoiceDTO,
    action: "MARK_DOWNLOADED" | "MARK_SAVED" | "RESET",
    successMessage: string,
  ) => {
    try {
      setUpdatingPdfInvoiceId(invoice.id);
      const updated = await apiRequest<InvoiceDTO>(
        `/api/invoices/${invoice.id}/pdf-status`,
        {
          method: "PATCH",
          body: { action },
        },
      );
      setInvoices((current) =>
        current.map((entry) => (entry.id === invoice.id ? updated : entry)),
      );
      setNotice({ type: "success", text: successMessage });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "PDF-Unterlagenstatus konnte nicht aktualisiert werden.",
      });
    } finally {
      setUpdatingPdfInvoiceId(null);
    }
  };

  const triggerPdfDownload = async (invoice: InvoiceDTO) => {
    try {
      setUpdatingPdfInvoiceId(invoice.id);
      const updated = await apiRequest<InvoiceDTO>(
        `/api/invoices/${invoice.id}/pdf-status`,
        {
          method: "PATCH",
          body: { action: "MARK_DOWNLOADED" },
        },
      );
      setInvoices((current) =>
        current.map((entry) => (entry.id === invoice.id ? updated : entry)),
      );

      const link = document.createElement("a");
      link.href = pdfHref(updated);
      link.target = "_blank";
      link.rel = "noreferrer";
      document.body.append(link);
      link.click();
      link.remove();

      setNotice({
        type: "info",
        text: "PDF-Download gestartet. Nach lokaler Ablage bitte 'Als gespeichert markieren'.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "PDF konnte nicht heruntergeladen werden.",
      });
    } finally {
      setUpdatingPdfInvoiceId(null);
    }
  };

  const loadCleanupDryRun = async () => {
    try {
      setCleanupLoading(true);
      const report = await apiRequest<InvoiceCleanupReport>("/api/invoices/test-cleanup");
      setCleanupReport(report);
      setNotice({
        type: "info",
        text: `Trockenlauf: ${report.candidates.length} Testrechnung(en) erkannt.`,
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Trockenlauf für Testrechnungen ist fehlgeschlagen.",
      });
    } finally {
      setCleanupLoading(false);
    }
  };

  const executeCleanup = async () => {
    if (!cleanupReport) {
      setNotice({
        type: "error",
        text: "Bitte zuerst einen Trockenlauf laden.",
      });
      return;
    }

    const requiredConfirmation =
      cleanupReport.requiredConfirmation ?? TEST_INVOICE_CONFIRMATION_TEXT;
    if (cleanupConfirmText !== requiredConfirmation) {
      setNotice({
        type: "error",
        text: `Bitte exakt '${requiredConfirmation}' eingeben.`,
      });
      return;
    }

    try {
      setCleanupRunning(true);
      const result = await apiRequest<InvoiceCleanupReport>("/api/invoices/test-cleanup", {
        method: "POST",
        body: {
          confirmation: cleanupConfirmText,
        },
      });
      setCleanupReport(result);
      setCleanupConfirmText("");
      await loadInvoices();
      setNotice({
        type: "success",
        text: `${result.deletedInvoices ?? 0} Testrechnung(en) wurden gelöscht.`,
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Testrechnungen konnten nicht gelöscht werden.",
      });
    } finally {
      setCleanupRunning(false);
    }
  };

  const archiveInfo = useMemo(
    () => ({
      total: invoices.length,
      open: invoices.filter((invoice) => invoice.paymentStatus === "OPEN").length,
      paid: invoices.filter((invoice) => invoice.paymentStatus === "PAID").length,
    }),
    [invoices],
  );

  const filteredInvoices = useMemo(() => {
    if (pdfFilter === "ALL") {
      return invoices;
    }
    return invoices.filter((invoice) => toPdfStatus(invoice) === pdfFilter);
  }, [invoices, pdfFilter]);

  const exportCsv = () => {
    if (invoices.length === 0) {
      setNotice({ type: "info", text: "Keine Rechnungen für den CSV-Export vorhanden." });
      return;
    }

    const escapeCell = (value: string) => `"${value.replaceAll("\"", "\"\"")}"`;
    const rows = [
      [
        "Rechnungsnummer",
        "Rechnungsdatum",
        "Empfänger",
        "Betrag",
        "Zahlungsstatus",
        "Rechnungsstatus",
        "Aktualisiert am",
      ],
      ...invoices.map((invoice) => [
        invoice.invoiceNumber ?? "Entwurf",
        formatDate(invoice.issueDate),
        invoice.customerName || invoice.recipientName || "Ohne Empfänger",
        formatEuroFromCents(invoice.totalCents),
        toPaymentStatusLabel(invoice.paymentStatus),
        INVOICE_LIFECYCLE_LABELS[invoice.lifecycleStatus],
        formatDate(invoice.updatedAt),
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => escapeCell(String(cell))).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rechnungsarchiv-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-hidden">
      <PageHeader title="Archiv" actions={<InvoiceAreaSwitch current="archive" />} />

      {notice ? <InlineNotice type={notice.type} text={notice.text} /> : null}

      <section className="flex min-h-0 flex-1 flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input-base h-9 w-full pl-8"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Suche nach Rechnungsnummer, Kundin, Initialen"
            />
          </label>
          <select
            className="input-base h-9"
            value={lifecycleFilter}
            onChange={(event) => setLifecycleFilter(event.target.value as LifecycleFilter)}
          >
            {lifecycleFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          <select
            className="input-base h-9"
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)}
          >
            {paymentFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          <select
            className="input-base h-9"
            value={pdfFilter}
            onChange={(event) => setPdfFilter(event.target.value as PdfFilter)}
          >
            {pdfFilters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-secondary h-9"
            onClick={() => void loadInvoices()}
            disabled={loading}
          >
            <RefreshCcw className="mr-2 size-4" />
            Aktualisieren
          </button>
          <button
            type="button"
            className="btn-secondary h-9"
            onClick={exportCsv}
          >
            <Download className="mr-2 size-4" />
            CSV exportieren
          </button>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            Von
            <input
              type="date"
              className="input-base h-9 min-w-[150px]"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            Bis
            <input
              type="date"
              className="input-base h-9 min-w-[150px]"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-[#d7e6e1] bg-[#f4faf7] px-2 py-0.5 text-[#2f5f56]">
            Gesamt: {archiveInfo.total}
          </span>
          <span className="rounded-full border border-[#e3e8f0] bg-[#f8faff] px-2 py-0.5 text-[#4b5a71]">
            Offen: {archiveInfo.open}
          </span>
          <span className="rounded-full border border-[#e7deef] bg-[#fbf8ff] px-2 py-0.5 text-[#59496e]">
            Bezahlt: {archiveInfo.paid}
          </span>
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-auto pr-1">
          {loading ? (
            <p className="text-sm text-slate-500">Rechnungsarchiv wird geladen ...</p>
          ) : filteredInvoices.length === 0 ? (
            <p className="text-sm text-slate-500">Keine Rechnungen für den gewählten PDF-Status gefunden.</p>
          ) : (
            filteredInvoices.map((invoice) => {
              const pdfStatus = toPdfStatus(invoice);
              const expectedPdfFileName = resolveExpectedPdfFileName(invoice);
              const pdfActionDisabled = updatingPdfInvoiceId === invoice.id;

              return (
                <article
                  key={invoice.id}
                  className="rounded-2xl border border-[#e2e9e6] bg-[#fdfefe] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800">
                        {invoice.invoiceNumber ?? "Entwurf"}
                      </p>
                      <p className="text-sm text-slate-600">
                        {invoice.customerName || invoice.recipientName || "Ohne Empfänger"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full border border-[#d7e6e1] bg-[#f4faf7] px-2 py-0.5 text-[#2f5f56]">
                          {INVOICE_LIFECYCLE_LABELS[invoice.lifecycleStatus]}
                        </span>
                        <span className="rounded-full border border-[#e5dfeb] bg-[#fbf8ff] px-2 py-0.5 text-[#5a476f]">
                          Zahlung: {toPaymentStatusLabel(invoice.paymentStatus)}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 ${toPdfStatusBadgeClasses(pdfStatus)}`}
                        >
                          {toPdfStatusLabel(pdfStatus)}
                        </span>
                        <span className="text-slate-500">{formatDate(invoice.issueDate)}</span>
                        <span className="text-slate-500">
                          Aktualisiert: {formatDate(invoice.updatedAt)}
                        </span>
                      </div>
                    </div>
                    <p className="text-base font-semibold text-[#8d4d5a]">
                      {formatEuroFromCents(invoice.totalCents)}
                    </p>
                  </div>

                  <section className="mt-3 rounded-xl border border-[#e6edea] bg-white px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5f7b73]">
                      PDF-Ablage / Unterlagenstatus
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Erwarteter Dateiname:{" "}
                      <span className="font-medium text-slate-700">{expectedPdfFileName}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="btn-secondary h-8 text-xs"
                        onClick={() => void triggerPdfDownload(invoice)}
                        disabled={pdfActionDisabled}
                      >
                        <Download className="mr-1.5 size-3.5" />
                        PDF herunterladen
                      </button>
                      <button
                        type="button"
                        className="btn-secondary h-8 text-xs"
                        onClick={() =>
                          void updatePdfStatus(
                            invoice,
                            "MARK_SAVED",
                            "PDF wurde als lokal gespeichert markiert.",
                          )
                        }
                        disabled={pdfActionDisabled}
                      >
                        Als gespeichert markieren
                      </button>
                      <button
                        type="button"
                        className="btn-secondary h-8 text-xs"
                        onClick={() =>
                          void updatePdfStatus(
                            invoice,
                            "RESET",
                            "PDF-Unterlagenstatus wurde zurückgesetzt.",
                          )
                        }
                        disabled={pdfActionDisabled}
                      >
                        Status zurücksetzen
                      </button>
                    </div>
                  </section>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link href={previewHref(invoice)} className="btn-secondary h-8 text-xs">
                      <Eye className="mr-1.5 size-3.5" />
                      Vorschau
                    </Link>
                    <Link
                      href={`/invoices?invoiceId=${invoice.id}`}
                      className="btn-secondary h-8 text-xs"
                    >
                      {invoice.lifecycleStatus === "FINALISIERT" || invoice.documentStatus !== "DRAFT"
                        ? "Ansehen"
                        : "Bearbeiten"}
                    </Link>
                    <label className="ml-auto flex items-center gap-2 text-xs text-slate-600">
                      Zahlungsstatus
                      <select
                        className="input-base h-8 min-w-[120px] text-xs"
                        value={invoice.paymentStatus}
                        onChange={(event) =>
                          void updatePaymentStatus(
                            invoice.id,
                            event.target.value as PaymentStatus,
                          )
                        }
                        disabled={updatingPaymentId === invoice.id}
                      >
                        <option value="OPEN">offen</option>
                        <option value="PAID">bezahlt</option>
                      </select>
                    </label>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className="max-h-[38vh] overflow-y-auto rounded-3xl border border-[#e7d7db] bg-[#fff9fb] p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-xl text-[#6f2f3c]">
            {cleanupReport?.actionLabel ?? TEST_INVOICE_ACTION_LABEL}
          </h2>
          <button
            type="button"
            className="btn-secondary h-9 border-[#e7cdd3] text-[#7b4450]"
            onClick={() => void loadCleanupDryRun()}
            disabled={cleanupLoading || cleanupRunning}
          >
            Trockenlauf laden
          </button>
        </div>

        {cleanupReport && (
          <div className="mt-3 space-y-3 text-sm">
            <div className="rounded-xl border border-[#eddde2] bg-white px-3 py-2 text-slate-700">
              <p>
                Erkannt: <strong>{cleanupReport.candidates.length}</strong> Testrechnung(en)
              </p>
              <p>
                Übersprungen: <strong>{cleanupReport.skipped.length}</strong>
              </p>
            </div>

            <div className="max-h-56 space-y-2 overflow-auto pr-1">
              {cleanupReport.candidates.length === 0 ? (
                <p className="rounded-xl border border-[#eddde2] bg-white px-3 py-2 text-slate-600">
                  Keine löschbaren Testrechnungen gefunden.
                </p>
              ) : (
                cleanupReport.candidates.map((candidate) => (
                  <article
                    key={candidate.id}
                    className="rounded-xl border border-[#eddde2] bg-white px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-800">{candidate.invoiceNumber}</p>
                        <p className="text-xs text-slate-500">{candidate.recipientName}</p>
                      </div>
                      <p className="text-sm font-semibold text-[#7b4450]">
                        {formatEuroFromCents(candidate.amountCents)}
                      </p>
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
                      {candidate.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </article>
                ))
              )}
            </div>

            {cleanupReport.skipped.length > 0 && (
              <details className="rounded-xl border border-[#eddde2] bg-white px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
                  Übersprungene Rechnungen anzeigen
                </summary>
                <div className="mt-2 space-y-2">
                  {cleanupReport.skipped.map((invoice) => (
                    <article
                      key={invoice.id}
                      className="rounded-lg border border-[#edf1ef] bg-[#f9fbfa] px-2.5 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{invoice.invoiceNumber}</p>
                          <p className="text-xs text-slate-500">{invoice.recipientName}</p>
                        </div>
                        <p className="text-xs font-semibold text-slate-600">
                          {formatEuroFromCents(invoice.amountCents)}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{invoice.reason}</p>
                    </article>
                  ))}
                </div>
              </details>
            )}

            {cleanupReport.deletedInvoices !== undefined && (
              <div className="rounded-xl border border-[#d9eadf] bg-[#f4fbf7] px-3 py-2 text-xs text-[#335f4b]">
                <p>
                  Gelöschte Testrechnungen: <strong>{cleanupReport.deletedInvoices}</strong>
                </p>
                {cleanupReport.deletedInvoiceNumbers.length > 0 && (
                  <p className="mt-1">
                    Nummern: {cleanupReport.deletedInvoiceNumbers.join(", ")}
                  </p>
                )}
              </div>
            )}

            <label className="flex flex-col gap-1 text-xs">
              Zur Bestätigung exakt eingeben:
              <span className="font-semibold text-[#7b4450]">
                {cleanupReport.requiredConfirmation}
              </span>
              <input
                className="input-base h-9"
                value={cleanupConfirmText}
                onChange={(event) => setCleanupConfirmText(event.target.value)}
                placeholder={cleanupReport.requiredConfirmation}
              />
            </label>

            <button
              type="button"
              className="btn-secondary h-9 w-full border-[#e7cdd3] text-[#7b4450]"
              onClick={() => void executeCleanup()}
              disabled={
                cleanupRunning ||
                cleanupReport.candidates.length === 0 ||
                cleanupConfirmText !== cleanupReport.requiredConfirmation
              }
            >
              <Trash2 className="mr-2 size-4" />
              Testrechnungen löschen
            </button>
          </div>
        )}

        {!cleanupReport && (
          <p className="mt-3 text-sm text-slate-600">
            Starte zuerst den Trockenlauf, um erkannte Testrechnungen inklusive Gründen
            anzuzeigen.
          </p>
        )}
      </section>
    </div>
  );
}


