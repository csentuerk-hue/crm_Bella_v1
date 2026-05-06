import Image from "next/image";

import type { CustomerFormState } from "@/components/customers/customer-form-state";

type CustomerCreatePanelProps = {
  form: CustomerFormState;
  saving: boolean;
  onChange: (next: CustomerFormState) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function CustomerCreatePanel({
  form,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: CustomerCreatePanelProps) {
  return (
    <section className="relative overflow-hidden rounded-[30px] border border-[#d4e3de] bg-[linear-gradient(180deg,#ffffff_0%,#f7fcfa_100%)] p-6 shadow-[0_14px_32px_rgba(13,80,74,0.12)]">
      <Image
        src="/branding/bella-watermark.png"
        alt="Bella by Sobiella Wasserzeichen"
        fill
        className="pointer-events-none object-contain opacity-10"
        sizes="(min-width: 1024px) 50vw, 100vw"
      />

      <div className="relative z-10">
        <h2 className="font-serif text-3xl leading-none text-[#1a3f39]">Neue Kundin</h2>
        <p className="mt-1 text-sm text-slate-600">
          Medienfreigabe wird intern automatisch auf Nein gesetzt und erst im Profil gepflegt.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Name (Pflichtfeld)
            <input
              className="input-base"
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Telefonnummer
            <input
              className="input-base"
              value={form.phone}
              onChange={(event) => onChange({ ...form, phone: event.target.value })}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            E-Mail
            <input
              className="input-base"
              value={form.email}
              onChange={(event) => onChange({ ...form, email: event.target.value })}
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

          <label className="flex flex-col gap-1 text-sm">
            Foto URL (optional)
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

          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Interne Notiz
            <textarea
              className="textarea-base min-h-24"
              value={form.notes}
              onChange={(event) => onChange({ ...form, notes: event.target.value })}
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Abbrechen
          </button>
          <button type="button" className="btn-primary" onClick={onSubmit} disabled={saving}>
            {saving ? "Speichern..." : "Speichern"}
          </button>
        </div>
      </div>
    </section>
  );
}
