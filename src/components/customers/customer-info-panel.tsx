import { BadgeCheck, CalendarClock, Phone, ShieldCheck, Sparkles } from "lucide-react";

import { InfoRow } from "@/components/customers/info-row";
import { INVOICE_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/datetime";
import type { CustomerDTO, InvoiceStatus } from "@/types/crm";

type CustomerInfoPanelProps = {
  isCreating: boolean;
  selectedCustomer: CustomerDTO | null;
  latestAppointmentDate: string | null;
  latestInvoiceStatus: InvoiceStatus | null;
};

export function CustomerInfoPanel({
  isCreating,
  selectedCustomer,
  latestAppointmentDate,
  latestInvoiceStatus,
}: CustomerInfoPanelProps) {
  return (
    <aside
      data-testid="customers-info-column"
      className="min-h-[calc(100vh-11.5rem)] rounded-[30px] border border-[#d3e3de] bg-white/95 p-4 shadow-[0_14px_30px_rgba(13,80,74,0.12)]"
    >
      {isCreating ? (
        <div className="space-y-2.5">
          <h3 className="font-serif text-2xl text-[#1a3f39]">Hinweise</h3>
          <p className="rounded-xl border border-[#e4ece8] bg-[#f8fcfa] px-3 py-2 text-sm text-slate-700">Pflichtfeld: Name</p>
          <p className="rounded-xl border border-[#e4ece8] bg-[#f8fcfa] px-3 py-2 text-sm text-slate-700">Telefonnummer optional, aber empfohlen</p>
          <p className="rounded-xl border border-[#e4ece8] bg-[#f8fcfa] px-3 py-2 text-sm text-slate-700">Medienfreigabe steht standardmäßig auf Nein</p>
          <p className="rounded-xl border border-[#e4ece8] bg-[#f8fcfa] px-3 py-2 text-sm text-slate-700">Vorlieben: natürlicher Look, Cat Eye, dichter, weich</p>
          <p className="rounded-xl border border-[#e4ece8] bg-[#f8fcfa] px-3 py-2 text-sm text-slate-700">Allergien: Unverträglichkeiten oder sensible Hinweise notieren</p>
          <p className="rounded-xl border border-[#e4ece8] bg-[#f8fcfa] px-3 py-2 text-sm text-slate-700">Interne Notiz: nur für studiointerne Informationen</p>
        </div>
      ) : selectedCustomer ? (
        <div className="space-y-2.5">
          <h3 className="font-serif text-2xl text-[#1a3f39]">Infos</h3>
          <InfoRow icon={<Phone className="size-3.5" />} label="Telefon" value={selectedCustomer.phone || "-"} />
          <InfoRow icon={<CalendarClock className="size-3.5" />} label="Geburtstag" value={selectedCustomer.birthday ? formatDate(selectedCustomer.birthday) : "-"} />
          <InfoRow icon={<Sparkles className="size-3.5" />} label="Vorlieben" value={selectedCustomer.preferences ? selectedCustomer.preferences.slice(0, 72) : "-"} />
          <InfoRow
            icon={<ShieldCheck className="size-3.5" />}
            label="Medienfreigabe"
            value={
              <span
                className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${selectedCustomer.mediaConsent ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
              >
                {selectedCustomer.mediaConsent ? "Ja" : "Nein"}
              </span>
            }
          />
          <InfoRow icon={<CalendarClock className="size-3.5" />} label="Letzter Termin" value={latestAppointmentDate ? formatDateTime(latestAppointmentDate) : "-"} />
          <InfoRow icon={<BadgeCheck className="size-3.5" />} label="Rechnungsstatus" value={latestInvoiceStatus ? INVOICE_STATUS_LABELS[latestInvoiceStatus] : "-"} />
        </div>
      ) : (
        <div className="space-y-2.5">
          <h3 className="font-serif text-2xl text-[#1a3f39]">Datenschutz</h3>
          <p className="rounded-xl border border-[#e4ece8] bg-[#f8fcfa] px-3 py-2 text-sm text-slate-700">Keine Kundin ausgewählt, daher keine personenbezogenen Daten sichtbar.</p>
          <p className="rounded-xl border border-[#e4ece8] bg-[#f8fcfa] px-3 py-2 text-sm text-slate-700">Wähle links eine Kundin oder lege eine neue Kundin im mittleren Bereich an.</p>
        </div>
      )}
    </aside>
  );
}

