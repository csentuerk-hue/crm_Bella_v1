import { CustomerAvatar } from "@/components/customers/customer-avatar";
import { CustomerActionDock } from "@/components/customers/customer-action-dock";
import { CustomerStatusBadge } from "@/components/customers/customer-status-badge";
import { CUSTOMER_STATUS_LABELS } from "@/lib/constants";
import type { CustomerFormState } from "@/components/customers/customer-form-state";
import type { CustomerDTO, CustomerStatus } from "@/types/crm";

type ActionItem = {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

type CustomerProfilePanelProps = {
  customer: CustomerDTO;
  form: CustomerFormState;
  saving: boolean;
  actions: ActionItem[];
  onChange: (next: CustomerFormState) => void;
  onSave: () => void;
};

export function CustomerProfilePanel({
  customer,
  form,
  saving,
  actions,
  onChange,
  onSave,
}: CustomerProfilePanelProps) {
  return (
    <section className="rounded-[30px] border border-[#d4e3de] bg-[linear-gradient(180deg,#ffffff_0%,#f7fcfa_100%)] p-5 shadow-[0_14px_32px_rgba(13,80,74,0.12)]">
      <div className="flex flex-col items-center text-center">
        <CustomerStatusBadge status={customer.status} />
        <div className="mt-3">
          <CustomerAvatar name={customer.name} photoUrl={customer.photoUrl} size="lg" />
        </div>
        <p className="mt-3 font-serif text-3xl leading-none text-[#173f39]">{customer.name}</p>
      </div>

      <CustomerActionDock actions={actions} />

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            className="input-base"
            value={form.name}
            onChange={(event) => onChange({ ...form, name: event.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Status (manuell)
          <select
            className="input-base"
            value={form.status}
            onChange={(event) => onChange({ ...form, status: event.target.value as CustomerStatus })}
          >
            <option value="NEU">{CUSTOMER_STATUS_LABELS.NEU}</option>
            <option value="AKTIV">{CUSTOMER_STATUS_LABELS.AKTIV}</option>
            <option value="INAKTIV">{CUSTOMER_STATUS_LABELS.INAKTIV}</option>
          </select>
        </label>

        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.archived}
            onChange={(event) => onChange({ ...form, archived: event.target.checked })}
          />
          Archiviert
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Telefon
          <input
            className="input-base"
            value={form.phone}
            onChange={(event) => onChange({ ...form, phone: event.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Geburtstag
          <input
            type="date"
            className="input-base"
            value={form.birthday}
            onChange={(event) => onChange({ ...form, birthday: event.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          E-Mail
          <input
            className="input-base"
            value={form.email}
            onChange={(event) => onChange({ ...form, email: event.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Foto URL
          <input
            className="input-base"
            value={form.photoUrl}
            onChange={(event) => onChange({ ...form, photoUrl: event.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Vorlieben
          <textarea
            className="textarea-base min-h-20"
            value={form.preferences}
            onChange={(event) => onChange({ ...form, preferences: event.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          Allergien
          <textarea
            className="textarea-base min-h-20"
            value={form.allergies}
            onChange={(event) => onChange({ ...form, allergies: event.target.value })}
          />
        </label>
      </div>

      <div className="mt-4 flex justify-end">
        <button type="button" className="btn-primary" onClick={onSave} disabled={saving}>
          {saving ? "Speichern..." : "Profil speichern"}
        </button>
      </div>
    </section>
  );
}
