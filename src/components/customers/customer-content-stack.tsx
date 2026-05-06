import { INVOICE_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { formatEuroFromCents } from "@/lib/currency";
import type { CustomerFormState } from "@/components/customers/customer-form-state";
import type { AppointmentDTO, InvoiceDTO, TreatmentEntryDTO } from "@/types/crm";

type CustomerContentStackProps = {
  form: CustomerFormState;
  onFormChange: (next: CustomerFormState) => void;
  onSaveNote: () => void;
  savingProfile: boolean;
  noteRef: React.RefObject<HTMLDivElement | null>;
  treatmentRef: React.RefObject<HTMLDivElement | null>;
  visibleTreatments: TreatmentEntryDTO[];
  showAllTreatments: boolean;
  onToggleTreatments: () => void;
  historyTab: "appointments" | "invoices";
  onHistoryTabChange: (tab: "appointments" | "invoices") => void;
  visibleAppointments: AppointmentDTO[];
  visibleInvoices: InvoiceDTO[];
  showAllAppointments: boolean;
  showAllInvoices: boolean;
  onToggleAppointments: () => void;
  onToggleInvoices: () => void;
};

export function CustomerContentStack({
  form,
  onFormChange,
  onSaveNote,
  savingProfile,
  noteRef,
  treatmentRef,
  visibleTreatments,
  showAllTreatments,
  onToggleTreatments,
  historyTab,
  onHistoryTabChange,
  visibleAppointments,
  visibleInvoices,
  showAllAppointments,
  showAllInvoices,
  onToggleAppointments,
  onToggleInvoices,
}: CustomerContentStackProps) {
  return (
    <div className="space-y-4">
      <section ref={noteRef} className="rounded-[28px] border border-[#d5e3de] bg-white p-4 shadow-[0_10px_24px_rgba(13,80,74,0.1)]">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-serif text-2xl text-[#1a3f39]">Interne Notiz</h3>
          <button type="button" className="btn-secondary h-9 px-3" onClick={onSaveNote} disabled={savingProfile}>
            Notiz speichern
          </button>
        </div>
        <textarea
          className="textarea-base min-h-28 w-full"
          value={form.notes}
          onChange={(event) => onFormChange({ ...form, notes: event.target.value })}
        />
      </section>

      <section ref={treatmentRef} className="rounded-[28px] border border-[#d5e3de] bg-white p-4 shadow-[0_10px_24px_rgba(13,80,74,0.1)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-serif text-2xl text-[#1a3f39]">Behandlungsverlauf</h3>
          <button type="button" className="btn-secondary h-9 px-3" onClick={onToggleTreatments}>
            {showAllTreatments ? "Weniger anzeigen" : "Alle anzeigen"}
          </button>
        </div>

        {visibleTreatments.length === 0 ? (
          <p className="rounded-xl border border-[#e4ece8] bg-[#f8fcfa] px-3 py-3 text-sm text-slate-600">
            Noch keine Behandlungsdaten vorhanden.
          </p>
        ) : (
          <ul className="space-y-2">
            {visibleTreatments.map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-[#e4ece8] bg-[#f8fcfa] p-3">
                <p className="text-xs text-slate-500">{formatDateTime(entry.performedAt)}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{entry.treatment}</p>
                <p className="mt-1 text-xs text-slate-600">
                  Stil: {entry.style || "-"} - Technik: {entry.technique || "-"} - Laenge: {entry.length || "-"}
                </p>
                {entry.note ? <p className="mt-2 text-sm text-slate-700">{entry.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[28px] border border-[#d5e3de] bg-white p-4 shadow-[0_10px_24px_rgba(13,80,74,0.1)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="inline-flex rounded-xl border border-[#d7e5df] p-1">
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm ${historyTab === "appointments" ? "bg-[#0f5a55] text-white" : "text-slate-700"}`}
              onClick={() => onHistoryTabChange("appointments")}
            >
              Termine
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm ${historyTab === "invoices" ? "bg-[#0f5a55] text-white" : "text-slate-700"}`}
              onClick={() => onHistoryTabChange("invoices")}
            >
              Rechnungen
            </button>
          </div>

          {historyTab === "appointments" ? (
            <button type="button" className="btn-secondary h-9 px-3" onClick={onToggleAppointments}>
              {showAllAppointments ? "Weniger anzeigen" : "Alle anzeigen"}
            </button>
          ) : (
            <button type="button" className="btn-secondary h-9 px-3" onClick={onToggleInvoices}>
              {showAllInvoices ? "Weniger anzeigen" : "Alle anzeigen"}
            </button>
          )}
        </div>

        {historyTab === "appointments" ? (
          visibleAppointments.length === 0 ? (
            <p className="rounded-xl border border-[#e4ece8] bg-[#f8fcfa] px-3 py-3 text-sm text-slate-600">
              Keine Termine hinterlegt.
            </p>
          ) : (
            <ul className="space-y-2">
              {visibleAppointments.map((item) => (
                <li key={item.id} className="rounded-2xl border border-[#e4ece8] bg-[#f8fcfa] p-3">
                  <p className="text-sm font-semibold text-slate-800">{item.service}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(item.startsAt)} - {item.isCancelled ? "Storniert" : item.status}
                  </p>
                </li>
              ))}
            </ul>
          )
        ) : visibleInvoices.length === 0 ? (
          <p className="rounded-xl border border-[#e4ece8] bg-[#f8fcfa] px-3 py-3 text-sm text-slate-600">
            Keine Rechnungen vorhanden.
          </p>
        ) : (
          <ul className="space-y-2">
            {visibleInvoices.map((invoice) => (
              <li key={invoice.id} className="rounded-2xl border border-[#e4ece8] bg-[#f8fcfa] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{invoice.invoiceNumber}</p>
                  <p className="text-sm font-semibold text-[#8d4d5a]">{formatEuroFromCents(invoice.amountCents)}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(invoice.issueDate)} - {INVOICE_STATUS_LABELS[invoice.status]}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
