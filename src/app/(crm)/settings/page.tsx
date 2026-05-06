"use client";

import { useEffect, useState } from "react";
import { Building2, CreditCard, FileText, Save } from "lucide-react";

import { InlineNotice } from "@/components/inline-notice";
import { PageHeader } from "@/components/page-header";
import { apiRequest } from "@/lib/client-api";
import type { InvoiceSettingsDTO, PaymentMethod } from "@/types/crm";

const paymentMethodOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: "BANK_TRANSFER", label: "Überweisung" },
  { value: "CASH", label: "Barzahlung" },
];

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "number";
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input-base"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="input-base min-h-[86px]"
      />
    </label>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<InvoiceSettingsDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const response = await apiRequest<InvoiceSettingsDTO>("/api/settings/invoice");
        setSettings({
          ...response,
          defaultPaymentMethod:
            response.defaultPaymentMethod === "CARD"
              ? "CASH"
              : response.defaultPaymentMethod,
        });
      } catch (error) {
        setNotice({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Rechnungseinstellungen konnten nicht geladen werden.",
        });
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const updateSetting = <K extends keyof InvoiceSettingsDTO>(
    key: K,
    value: InvoiceSettingsDTO[K],
  ) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  };

  const save = async () => {
    if (!settings) return;
    try {
      setIsSaving(true);
      const payload = {
        businessName: settings.businessName,
        ownerName: settings.ownerName,
        street: settings.street,
        houseNumber: settings.houseNumber,
        zipCode: settings.zipCode,
        city: settings.city,
        phone: settings.phone,
        email: settings.email,
        taxNumber: settings.taxNumber,
        vatId: settings.vatId,
        bankAccountHolder: settings.bankAccountHolder,
        bankIban: settings.bankIban,
        bankBic: settings.bankBic,
        bankName: settings.bankName,
        smallBusinessEnabled: settings.smallBusinessEnabled,
        defaultPaymentDeadlineBusinessDays: settings.defaultPaymentDeadlineBusinessDays,
        defaultCurrency: settings.defaultCurrency,
        defaultPaymentMethod: settings.defaultPaymentMethod,
        invoicePrefix: settings.invoicePrefix,
        recipientLabel: settings.recipientLabel,
        transferPaymentTitle: settings.transferPaymentTitle,
        transferPaymentNotice: settings.transferPaymentNotice,
        cashPaymentTitle: settings.cashPaymentTitle,
        cashPaymentNote: settings.cashPaymentNote,
        cardPaymentTitle: settings.cardPaymentTitle,
        cardPaymentNote: settings.cardPaymentNote,
        legalSmallBusinessNote: settings.legalSmallBusinessNote,
        closingText: settings.closingText,
        additionalFooterNote: settings.additionalFooterNote,
      };
      const response = await apiRequest<InvoiceSettingsDTO>("/api/settings/invoice", {
        method: "PUT",
        body: payload,
      });
      setSettings(response);
      setNotice({ type: "success", text: "Rechnungseinstellungen gespeichert." });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Rechnungseinstellungen konnten nicht gespeichert werden.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Einstellungen > Rechnung" />

      {notice ? <InlineNotice type={notice.type} text={notice.text} /> : null}

      {isLoading || !settings ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Rechnungseinstellungen werden geladen...
        </section>
      ) : (
        <>
          <section
            data-testid="invoice-settings-business-section"
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="size-5 text-[#1a3f39]" />
              <h2 className="font-serif text-2xl text-[#1a3f39]">
                Unternehmen / Absenderdaten
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Firmenname"
                value={settings.businessName}
                onChange={(v) => updateSetting("businessName", v)}
              />
              <Field
                label="Inhaber / Ansprechpartner"
                value={settings.ownerName}
                onChange={(v) => updateSetting("ownerName", v)}
              />
              <Field
                label="Straße"
                value={settings.street}
                onChange={(v) => updateSetting("street", v)}
              />
              <Field
                label="Hausnummer"
                value={settings.houseNumber}
                onChange={(v) => updateSetting("houseNumber", v)}
              />
              <Field label="PLZ" value={settings.zipCode} onChange={(v) => updateSetting("zipCode", v)} />
              <Field label="Ort" value={settings.city} onChange={(v) => updateSetting("city", v)} />
              <Field
                label="Telefon"
                value={settings.phone}
                onChange={(v) => updateSetting("phone", v)}
              />
              <Field
                label="E-Mail"
                type="email"
                value={settings.email}
                onChange={(v) => updateSetting("email", v)}
              />
              <Field
                label="Steuernummer"
                value={settings.taxNumber}
                onChange={(v) => updateSetting("taxNumber", v)}
              />
              <Field
                label="USt-IdNr. (optional)"
                value={settings.vatId}
                onChange={(v) => updateSetting("vatId", v)}
              />
            </div>
          </section>

          <section
            data-testid="invoice-settings-bank-section"
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="size-5 text-[#1a3f39]" />
              <h2 className="font-serif text-2xl text-[#1a3f39]">Bankdaten & Standardwerte</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Kontoinhaber"
                value={settings.bankAccountHolder}
                onChange={(v) => updateSetting("bankAccountHolder", v)}
              />
              <Field label="IBAN" value={settings.bankIban} onChange={(v) => updateSetting("bankIban", v)} />
              <Field label="BIC" value={settings.bankBic} onChange={(v) => updateSetting("bankBic", v)} />
              <Field
                label="Bank (optional)"
                value={settings.bankName}
                onChange={(v) => updateSetting("bankName", v)}
              />
              <Field
                label="Standard-Zahlungsfrist in Werktagen"
                type="number"
                value={String(settings.defaultPaymentDeadlineBusinessDays)}
                onChange={(v) =>
                  updateSetting(
                    "defaultPaymentDeadlineBusinessDays",
                    Number.parseInt(v || "0", 10) || 0,
                  )
                }
              />
              <Field
                label="Standardwährung"
                value={settings.defaultCurrency}
                onChange={(v) => updateSetting("defaultCurrency", v.toUpperCase())}
              />
              <Field
                label="Rechnungspräfix"
                value={settings.invoicePrefix}
                onChange={(v) => updateSetting("invoicePrefix", v.toUpperCase())}
              />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Standard-Zahlungsart</span>
                <select
                  value={settings.defaultPaymentMethod}
                  onChange={(event) =>
                    updateSetting("defaultPaymentMethod", event.target.value as PaymentMethod)
                  }
                  className="input-base"
                >
                  {paymentMethodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={settings.smallBusinessEnabled}
                  onChange={(event) => updateSetting("smallBusinessEnabled", event.target.checked)}
                />
                Kleinunternehmerregelung aktiv (§ 19 UStG)
              </label>
            </div>
          </section>

          <section
            data-testid="invoice-settings-texts-section"
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center gap-2">
              <FileText className="size-5 text-[#1a3f39]" />
              <h2 className="font-serif text-2xl text-[#1a3f39]">Editierbare Rechnungstexte</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field
                label="Empfänger-Label"
                value={settings.recipientLabel}
                onChange={(v) => updateSetting("recipientLabel", v)}
              />
              <Field
                label="Titel bei Überweisung"
                value={settings.transferPaymentTitle}
                onChange={(v) => updateSetting("transferPaymentTitle", v)}
              />
              <TextArea
                label="Hinweis bei Überweisung"
                value={settings.transferPaymentNotice}
                onChange={(v) => updateSetting("transferPaymentNotice", v)}
              />
              <Field
                label="Titel bei Barzahlung"
                value={settings.cashPaymentTitle}
                onChange={(v) => updateSetting("cashPaymentTitle", v)}
              />
              <TextArea
                label="Hinweis bei Barzahlung"
                value={settings.cashPaymentNote}
                onChange={(v) => updateSetting("cashPaymentNote", v)}
              />
              <TextArea
                label="Rechtlicher Hinweis"
                value={settings.legalSmallBusinessNote}
                onChange={(v) => updateSetting("legalSmallBusinessNote", v)}
              />
              <TextArea
                label="Abschlusstext"
                value={settings.closingText}
                onChange={(v) => updateSetting("closingText", v)}
              />
              <TextArea
                label="Zusätzliche Fußnote (optional)"
                value={settings.additionalFooterNote}
                onChange={(v) => updateSetting("additionalFooterNote", v)}
              />
            </div>

            <div className="mt-5">
              <button type="button" className="btn-primary" onClick={() => void save()} disabled={isSaving}>
                <Save className="mr-2 size-4" />
                {isSaving ? "Speichere..." : "Rechnungseinstellungen speichern"}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

