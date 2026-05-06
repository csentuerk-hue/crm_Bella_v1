"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, FilePlus2, Plus, Trash2 } from "lucide-react";

import { InvoiceAreaSwitch } from "@/components/invoices/invoice-area-switch";
import { InlineNotice } from "@/components/inline-notice";
import { PageHeader } from "@/components/page-header";
import { apiRequest } from "@/lib/client-api";
import { INVOICE_LIFECYCLE_LABELS } from "@/lib/constants";
import { formatEuroFromCents } from "@/lib/currency";
import { formatDateTime } from "@/lib/datetime";
import { requiresFullInvoiceAddress } from "@/lib/invoice-rules";
import type {
  AppointmentDTO,
  CustomerDTO,
  InvoiceDTO,
  PaymentMethod,
  PaymentStatus,
} from "@/types/crm";

type CreateMode = "appointment" | "free";

type LineForm = {
  id: string;
  service: string;
  quantity: string;
  unitPrice: string;
  stock: string;
};

type InvoiceEditorForm = {
  customerId: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  issueDate: string;
  serviceDate: string;
  recipientName: string;
  recipientAttention: string;
  recipientLine2: string;
  recipientStreet: string;
  recipientHouseNumber: string;
  recipientZipCode: string;
  recipientCity: string;
  recipientCountry: string;
  recipientEmail: string;
  recipientPhone: string;
  recipientNotes: string;
  smallBusinessEnabled: boolean;
  legalSmallBusinessNote: string;
  closingText: string;
  additionalFooterNote: string;
  items: LineForm[];
};

const paymentMethodOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: "BANK_TRANSFER", label: "Überweisung" },
  { value: "CASH", label: "Barzahlung" },
];

const paymentStatusOptions: Array<{ value: PaymentStatus; label: string }> = [
  { value: "OPEN", label: "offen" },
  { value: "PAID", label: "bezahlt" },
];

const quickAddTemplates: Array<{ label: string; service: string; unitPrice: string; stock: string }> = [
  { label: "Lash Shampoo", service: "Lash Shampoo", unitPrice: "12,00", stock: "12" },
  { label: "Reinigung", service: "Reinigung", unitPrice: "15,00", stock: "8" },
  { label: "Auffüllen", service: "Auffüllen", unitPrice: "55,00", stock: "6" },
  { label: "Sonstiges", service: "Individuelle Position", unitPrice: "0,00", stock: "" },
];

let lineIdCounter = 0;
function createLine(overrides: Partial<Omit<LineForm, "id">> = {}): LineForm {
  lineIdCounter += 1;
  return {
    id: `line-${lineIdCounter}`,
    service: overrides.service ?? "",
    quantity: overrides.quantity ?? "1",
    unitPrice: overrides.unitPrice ?? "",
    stock: overrides.stock ?? "",
  };
}

function parseEuroToCents(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

function parseQuantity(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseStock(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function toDateInput(isoDate: string | null): string {
  if (!isoDate) {
    return "";
  }
  return isoDate.slice(0, 10);
}

function toIsoDate(dateInput: string): string | null {
  if (!dateInput.trim()) {
    return null;
  }
  return new Date(`${dateInput}T00:00:00`).toISOString();
}

function isLineEmpty(line: LineForm): boolean {
  return !line.service.trim() && !line.quantity.trim() && !line.unitPrice.trim();
}

function lineTotalCents(line: LineForm): number | null {
  const quantity = parseQuantity(line.quantity);
  const unitPrice = parseEuroToCents(line.unitPrice);
  if (quantity === null || unitPrice === null) {
    return null;
  }
  return Math.round(quantity * unitPrice);
}

function mapInvoiceToEditor(invoice: InvoiceDTO): InvoiceEditorForm {
  return {
    customerId: invoice.customerId ?? "",
    paymentMethod:
      invoice.paymentMethod === "CASH" || invoice.paymentMethod === "BANK_TRANSFER"
        ? invoice.paymentMethod
        : "BANK_TRANSFER",
    paymentStatus: invoice.paymentStatus === "PAID" ? "PAID" : "OPEN",
    issueDate: toDateInput(invoice.issueDate),
    serviceDate: toDateInput(invoice.serviceDate),
    recipientName: invoice.recipientName,
    recipientAttention: invoice.recipientAttention,
    recipientLine2: invoice.recipientLine2,
    recipientStreet: invoice.recipientStreet,
    recipientHouseNumber: invoice.recipientHouseNumber,
    recipientZipCode: invoice.recipientZipCode,
    recipientCity: invoice.recipientCity,
    recipientCountry: invoice.recipientCountry,
    recipientEmail: invoice.recipientEmail,
    recipientPhone: invoice.recipientPhone,
    recipientNotes: invoice.recipientNotes,
    smallBusinessEnabled: invoice.smallBusinessEnabled,
    legalSmallBusinessNote: invoice.legalSmallBusinessNote,
    closingText: invoice.closingText,
    additionalFooterNote: invoice.additionalFooterNote,
    items:
      invoice.items.length > 0
        ? invoice.items.map((item) => ({
            id: item.id,
            service: item.service,
            quantity: String(item.quantity),
            unitPrice: (item.unitPriceCents / 100).toFixed(2).replace(".", ","),
            stock: "",
          }))
        : [createLine()],
  };
}

function getRecipientPreview(customer: CustomerDTO | null): string[] {
  if (!customer) {
    return [];
  }

  if (customer.billingAddressEnabled) {
    return [
      customer.invoiceRecipientName,
      customer.invoiceRecipientAttention,
      customer.invoiceRecipientLine2,
      [customer.invoiceStreet, customer.invoiceHouseNumber].filter(Boolean).join(" ").trim(),
      [customer.invoicePostalCode, customer.invoiceCity].filter(Boolean).join(" ").trim(),
      customer.invoiceCountry,
      customer.invoiceEmail,
    ].filter((line): line is string => Boolean(line && line.trim()));
  }

  return [
    customer.name,
    [customer.street, customer.houseNumber].filter(Boolean).join(" ").trim(),
    [customer.postalCode, customer.city].filter(Boolean).join(" ").trim(),
    customer.country,
    customer.email,
  ].filter((line): line is string => Boolean(line && line.trim()));
}

function formatDraftLabel(invoice: InvoiceDTO) {
  return `${invoice.invoiceNumber ?? "Entwurf"} · ${invoice.customerName}`;
}

export default function InvoicesCreatePage() {
  const [requestedInvoiceId, setRequestedInvoiceId] = useState<string | null>(null);

  const [draftInvoices, setDraftInvoices] = useState<InvoiceDTO[]>([]);
  const [externalInvoice, setExternalInvoice] = useState<InvoiceDTO | null>(null);
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const [createMode, setCreateMode] = useState<CreateMode>("appointment");
  const [createAppointmentId, setCreateAppointmentId] = useState("");
  const [createCustomerId, setCreateCustomerId] = useState("");
  const [createPaymentMethod, setCreatePaymentMethod] =
    useState<PaymentMethod>("BANK_TRANSFER");
  const [createLines, setCreateLines] = useState<LineForm[]>([createLine()]);

  const [editor, setEditor] = useState<InvoiceEditorForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<
    { type: "success" | "error" | "info"; text: string } | null
  >(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    setRequestedInvoiceId(params.get("invoiceId"));
  }, []);

  const editableInvoices = useMemo(() => {
    const byId = new Map<string, InvoiceDTO>();
    for (const draft of draftInvoices) {
      byId.set(draft.id, draft);
    }
    if (externalInvoice && !byId.has(externalInvoice.id)) {
      byId.set(externalInvoice.id, externalInvoice);
    }
    return Array.from(byId.values());
  }, [draftInvoices, externalInvoice]);

  const selectedInvoice = useMemo(
    () => editableInvoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null,
    [editableInvoices, selectedInvoiceId],
  );

  const selectedCreateCustomer = useMemo(
    () => customers.find((customer) => customer.id === createCustomerId) ?? null,
    [createCustomerId, customers],
  );

  const selectedCustomerRecipientLines = useMemo(
    () => getRecipientPreview(selectedCreateCustomer),
    [selectedCreateCustomer],
  );

  const createSubtotalCents = useMemo(
    () =>
      createLines.reduce((sum, line) => {
        const total = lineTotalCents(line);
        return sum + (total ?? 0);
      }, 0),
    [createLines],
  );

  const createStockWarnings = useMemo(() => {
    const warnings: string[] = [];
    for (const line of createLines) {
      const stock = parseStock(line.stock);
      if (stock === null) continue;
      const quantity = parseQuantity(line.quantity) ?? 0;
      const label = line.service.trim() || "Position";
      if (stock <= 3) {
        warnings.push(`${label}: niedriger Lagerbestand (${stock})`);
      }
      if (quantity > stock) {
        warnings.push(`${label}: Menge (${quantity}) über Bestand (${stock})`);
      }
    }
    return warnings;
  }, [createLines]);

  const editorSubtotalCents = useMemo(
    () =>
      (editor?.items ?? []).reduce((sum, line) => {
        const total = lineTotalCents(line);
        return sum + (total ?? 0);
      }, 0),
    [editor?.items],
  );

  const editorStockWarnings = useMemo(() => {
    const warnings: string[] = [];
    for (const line of editor?.items ?? []) {
      const stock = parseStock(line.stock);
      if (stock === null) continue;
      const quantity = parseQuantity(line.quantity) ?? 0;
      const label = line.service.trim() || "Position";
      if (stock <= 3) {
        warnings.push(`${label}: niedriger Lagerbestand (${stock})`);
      }
      if (quantity > stock) {
        warnings.push(`${label}: Menge (${quantity}) über Bestand (${stock})`);
      }
    }
    return warnings;
  }, [editor?.items]);

  const needsFullAddress = requiresFullInvoiceAddress(editorSubtotalCents);

  const loadData = useCallback(async (preferredInvoiceId: string | null = null) => {
    try {
      setLoading(true);
      const [draftData, customerData, appointmentData] = await Promise.all([
        apiRequest<InvoiceDTO[]>("/api/invoices?lifecycle=ENTWURF"),
        apiRequest<CustomerDTO[]>("/api/customers?archived=true"),
        apiRequest<AppointmentDTO[]>("/api/appointments?includeCancelled=true"),
      ]);

      const activeCustomers = customerData.filter((customer) => !customer.archived);
      const billableAppointments = appointmentData
        .filter(
          (appointment) =>
            !appointment.hasInvoice &&
            !appointment.isCancelled &&
            (appointment.status === "ERLEDIGT" || appointment.status === "ABGERECHNET"),
        )
        .sort(
          (left, right) =>
            new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime(),
        );

      let fetchedExternal: InvoiceDTO | null = null;
      if (requestedInvoiceId && !draftData.some((invoice) => invoice.id === requestedInvoiceId)) {
        try {
          fetchedExternal = await apiRequest<InvoiceDTO>(`/api/invoices/${requestedInvoiceId}`);
        } catch {
          fetchedExternal = null;
        }
      }

      setDraftInvoices(draftData);
      setExternalInvoice(fetchedExternal);
      setCustomers(activeCustomers);
      setAppointments(billableAppointments);

      setSelectedInvoiceId((current) => {
        const requestedOrPreferred = preferredInvoiceId ?? requestedInvoiceId;

        if (requestedOrPreferred) {
          if (draftData.some((invoice) => invoice.id === requestedOrPreferred)) {
            return requestedOrPreferred;
          }
          if (fetchedExternal?.id === requestedOrPreferred) {
            return requestedOrPreferred;
          }
        }

        if (
          current &&
          (draftData.some((invoice) => invoice.id === current) ||
            fetchedExternal?.id === current)
        ) {
          return current;
        }

        return draftData[0]?.id ?? fetchedExternal?.id ?? null;
      });

      setCreateAppointmentId((current) => current || billableAppointments[0]?.id || "");
      setCreateCustomerId((current) => current || activeCustomers[0]?.id || "");
      setNotice((current) => {
        if (requestedInvoiceId && fetchedExternal && fetchedExternal.lifecycleStatus === "FINALISIERT") {
          return {
            type: "info",
            text: "Finalisierte Rechnung aus dem Archiv ist zum Bearbeiten geöffnet.",
          };
        }
        return current;
      });
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Rechnungsdaten konnten nicht geladen werden.",
      });
    } finally {
      setLoading(false);
    }
  }, [requestedInvoiceId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedInvoice) {
      setEditor(mapInvoiceToEditor(selectedInvoice));
    } else {
      setEditor(null);
    }
  }, [selectedInvoice]);

  const applyCustomerAddressToEditor = useCallback(
    (customerId: string) => {
      const customer = customers.find((entry) => entry.id === customerId) ?? null;
      if (!customer) {
        return;
      }
      const recipientFields = customer.billingAddressEnabled
        ? {
            name: customer.invoiceRecipientName || customer.name,
            attention: customer.invoiceRecipientAttention || "",
            line2: customer.invoiceRecipientLine2 || "",
            street: customer.invoiceStreet || "",
            houseNumber: customer.invoiceHouseNumber || "",
            zipCode: customer.invoicePostalCode || "",
            city: customer.invoiceCity || "",
            country: customer.invoiceCountry || "Deutschland",
            email: customer.invoiceEmail || "",
            phone: customer.invoicePhone || "",
            notes: customer.invoiceNotes || "",
          }
        : {
            name: customer.name,
            attention: "",
            line2: "",
            street: customer.street || "",
            houseNumber: customer.houseNumber || "",
            zipCode: customer.postalCode || "",
            city: customer.city || "",
            country: customer.country || "Deutschland",
            email: customer.email || "",
            phone: customer.phone || "",
            notes: "",
          };

      setEditor((current) =>
        current
          ? {
              ...current,
              customerId,
              recipientName: recipientFields.name,
              recipientAttention: recipientFields.attention,
              recipientLine2: recipientFields.line2,
              recipientStreet: recipientFields.street,
              recipientHouseNumber: recipientFields.houseNumber,
              recipientZipCode: recipientFields.zipCode,
              recipientCity: recipientFields.city,
              recipientCountry: recipientFields.country,
              recipientEmail: recipientFields.email,
              recipientPhone: recipientFields.phone,
              recipientNotes: recipientFields.notes,
            }
          : current,
      );
    },
    [customers],
  );

  const updateCreateLine = (id: string, field: keyof Omit<LineForm, "id">, value: string) => {
    setCreateLines((current) =>
      current.map((line) => (line.id === id ? { ...line, [field]: value } : line)),
    );
  };

  const removeCreateLine = (id: string) => {
    setCreateLines((current) => {
      if (current.length <= 1) {
        return current;
      }
      return current.filter((line) => line.id !== id);
    });
  };

  const updateEditorLine = (id: string, field: keyof Omit<LineForm, "id">, value: string) => {
    setEditor((current) =>
      current
        ? {
            ...current,
            items: current.items.map((line) =>
              line.id === id ? { ...line, [field]: value } : line,
            ),
          }
        : current,
    );
  };

  const removeEditorLine = (id: string) => {
    setEditor((current) => {
      if (!current) {
        return current;
      }
      if (current.items.length <= 1) {
        return current;
      }
      return {
        ...current,
        items: current.items.filter((line) => line.id !== id),
      };
    });
  };

  const validateLineItems = (lines: LineForm[]) => {
    const prepared = lines
      .filter((line) => !isLineEmpty(line))
      .map((line) => {
        const service = line.service.trim();
        const quantity = parseQuantity(line.quantity);
        const unitPriceCents = parseEuroToCents(line.unitPrice);
        return {
          service,
          quantity,
          unitPriceCents,
        };
      });

    for (const line of prepared) {
      if (!line.service) {
        return { error: "Bitte gib fr jede Position eine Bezeichnung an." };
      }
      if (line.quantity === null) {
        return { error: "Bitte prfe die Menge jeder Position." };
      }
      if (line.unitPriceCents === null) {
        return { error: "Bitte prfe den Einzelpreis jeder Position." };
      }
    }

    return {
      items: prepared.map((line) => ({
        service: line.service,
        quantity: line.quantity as number,
        unitPriceCents: line.unitPriceCents as number,
      })),
    };
  };

  const createFromAppointment = async () => {
    if (!createAppointmentId) {
      setNotice({ type: "error", text: "Bitte whle zuerst einen Termin aus." });
      return;
    }
    const selectedAppointment = appointments.find(
      (appointment) => appointment.id === createAppointmentId,
    );
    if (!selectedAppointment) {
      setNotice({ type: "error", text: "Ausgewählter Termin wurde nicht gefunden." });
      return;
    }

    try {
      setSaving(true);
      const created = await apiRequest<InvoiceDTO>("/api/invoices", {
        method: "POST",
        body: {
          customerId: selectedAppointment.customerId,
          appointmentId: createAppointmentId,
          paymentMethod: createPaymentMethod,
        },
      });
      setNotice({
        type: "success",
        text: "Rechnungsentwurf aus Termin wurde erstellt.",
      });
      await loadData(created.id);
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Terminrechnung konnte nicht erstellt werden.",
      });
    } finally {
      setSaving(false);
    }
  };

  const createFreeInvoice = async () => {
    if (!createCustomerId) {
      setNotice({ type: "error", text: "Bitte eine Kundin auswählen." });
      return;
    }
    const lineValidation = validateLineItems(createLines);
    if ("error" in lineValidation) {
      setNotice({ type: "error", text: lineValidation.error ?? "Ungültige Positionen." });
      return;
    }

    try {
      setSaving(true);
      const created = await apiRequest<InvoiceDTO>("/api/invoices", {
        method: "POST",
        body: {
          customerId: createCustomerId,
          paymentMethod: createPaymentMethod,
          items: lineValidation.items.map((line) => ({
            name: line.service,
            quantity: line.quantity,
            priceCents: line.unitPriceCents,
          })),
        },
      });

      setCreateLines([createLine()]);
      setNotice({
        type: "success",
        text: "Freier Rechnungsentwurf wurde erstellt.",
      });
      await loadData(created.id);
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Freie Rechnung konnte nicht erstellt werden.",
      });
    } finally {
      setSaving(false);
    }
  };

  const persistInvoice = async (action: "SAVE_DRAFT" | "FINALIZE") => {
    if (!selectedInvoice || !editor) {
      return;
    }
    if (!editor.customerId) {
      setNotice({ type: "error", text: "Bitte eine Kundin auswählen." });
      return;
    }

    const lineValidation = validateLineItems(editor.items);
    if ("error" in lineValidation) {
      setNotice({ type: "error", text: lineValidation.error ?? "Ungültige Positionen." });
      return;
    }

    try {
      setSaving(true);
      const issueDateIso = toIsoDate(editor.issueDate);
      const serviceDateIso = toIsoDate(editor.serviceDate);
      const payload = {
        customerId: editor.customerId,
        paymentMethod: editor.paymentMethod,
        paymentStatus: editor.paymentStatus,
        ...(issueDateIso ? { issueDate: issueDateIso } : {}),
        serviceDate: serviceDateIso,
        recipientName: editor.recipientName.trim(),
        recipientAttention: editor.recipientAttention.trim(),
        recipientLine2: editor.recipientLine2.trim(),
        recipientStreet: editor.recipientStreet.trim(),
        recipientHouseNumber: editor.recipientHouseNumber.trim(),
        recipientZipCode: editor.recipientZipCode.trim(),
        recipientCity: editor.recipientCity.trim(),
        recipientCountry: editor.recipientCountry.trim(),
        recipientEmail: editor.recipientEmail.trim(),
        recipientPhone: editor.recipientPhone.trim(),
        recipientNotes: editor.recipientNotes.trim(),
        smallBusinessEnabled: editor.smallBusinessEnabled,
        legalSmallBusinessNote: editor.legalSmallBusinessNote.trim(),
        closingText: editor.closingText.trim(),
        additionalFooterNote: editor.additionalFooterNote.trim(),
        items: lineValidation.items.map((line) => ({
          service: line.service,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
        })),
        action,
      };

      const updated = await apiRequest<InvoiceDTO>(`/api/invoices/${selectedInvoice.id}`, {
        method: "PUT",
        body: payload,
      });

      setNotice({
        type: "success",
        text:
          action === "FINALIZE"
            ? "Rechnung wurde finalisiert."
            : "Rechnung wurde gespeichert.",
      });
      await loadData(updated.id);
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : action === "FINALIZE"
              ? "Finalisieren ist fehlgeschlagen."
              : "Speichern ist fehlgeschlagen.",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteDraft = async () => {
    if (!selectedInvoice || selectedInvoice.lifecycleStatus !== "ENTWURF") {
      return;
    }

    try {
      setSaving(true);
      await apiRequest(`/api/invoices/${selectedInvoice.id}`, {
        method: "PUT",
        body: { deleteDraft: true },
      });
      setSelectedInvoiceId(null);
      setNotice({ type: "success", text: "Entwurf wurde gelscht." });
      await loadData();
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Entwurf konnte nicht gelöscht werden.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-hidden">
      <PageHeader title="Rechnung erstellen" actions={<InvoiceAreaSwitch current="create" />} />

      {notice ? <InlineNotice type={notice.type} text={notice.text} /> : null}

      <section className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <aside className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-serif text-2xl text-[#1a3f39]">Rechnungsentwurf anlegen</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`h-10 rounded-xl border px-3 text-sm font-semibold transition ${
                  createMode === "appointment"
                    ? "border-[#0f5a55] bg-[#e6f3ef] text-[#0f5a55]"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setCreateMode("appointment")}
              >
                Aus Termin
              </button>
              <button
                type="button"
                className={`h-10 rounded-xl border px-3 text-sm font-semibold transition ${
                  createMode === "free"
                    ? "border-[#0f5a55] bg-[#e6f3ef] text-[#0f5a55]"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setCreateMode("free")}
              >
                Freie Rechnung
              </button>
            </div>

            {createMode === "appointment" ? (
              <div className="mt-4 space-y-3">
                <label className="flex flex-col gap-1 text-sm">
                  Termin
                  <select
                    className="input-base"
                    value={createAppointmentId}
                    onChange={(event) => setCreateAppointmentId(event.target.value)}
                  >
                    {appointments.length === 0 ? (
                      <option value="">Keine abrechenbaren Termine</option>
                    ) : (
                      appointments.map((appointment) => (
                        <option key={appointment.id} value={appointment.id}>
                          {appointment.customerName} · {appointment.service} ·{" "}
                          {formatDateTime(appointment.startsAt)}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Zahlungsart
                  <select
                    className="input-base"
                    value={createPaymentMethod}
                    onChange={(event) =>
                      setCreatePaymentMethod(event.target.value as PaymentMethod)
                    }
                  >
                    {paymentMethodOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn-primary w-full"
                  disabled={saving || !createAppointmentId}
                  onClick={() => void createFromAppointment()}
                >
                  <FilePlus2 className="mr-2 size-4" />
                  Entwurf aus Termin erstellen
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="flex flex-col gap-1 text-sm">
                  Kundin
                  <select
                    className="input-base"
                    value={createCustomerId}
                    onChange={(event) => setCreateCustomerId(event.target.value)}
                  >
                    <option value="">Kundin auswählen</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </label>

                {createCustomerId && (
                  <div className="rounded-xl border border-[#d6e6e1] bg-[#f8fcfa] px-3 py-2 text-sm text-slate-700">
                    {selectedCustomerRecipientLines.length === 0 ? (
                      <p>Keine Adresse hinterlegt.</p>
                    ) : (
                      selectedCustomerRecipientLines.map((line, index) => (
                        <p key={`${line}-${index}`}>{line}</p>
                      ))
                    )}
                  </div>
                )}

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Schnell hinzufügen
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {quickAddTemplates.map((template) => (
                      <button
                        key={template.label}
                        type="button"
                        className="rounded-lg border border-[#d7e3df] bg-white px-2.5 py-2 text-left text-xs text-slate-700 transition hover:border-[#9bc2b8]"
                        onClick={() =>
                          setCreateLines((current) => [
                            ...current,
                            createLine({
                              service: template.service,
                              quantity: "1",
                              unitPrice: template.unitPrice,
                              stock: template.stock ?? "",
                            }),
                          ])
                        }
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-[#dbe8e3] bg-[#f8fcfa] p-3">
                  {createLines.map((line) => (
                    <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_72px_102px_86px_32px] gap-2">
                      <input
                        className="input-base h-9 text-sm"
                        value={line.service}
                        onChange={(event) =>
                          updateCreateLine(line.id, "service", event.target.value)
                        }
                        placeholder="Bezeichnung"
                      />
                      <input
                        className="input-base h-9 text-sm"
                        value={line.quantity}
                        onChange={(event) =>
                          updateCreateLine(line.id, "quantity", event.target.value)
                        }
                        placeholder="1"
                      />
                      <input
                        className="input-base h-9 text-sm"
                        value={line.unitPrice}
                        onChange={(event) =>
                          updateCreateLine(line.id, "unitPrice", event.target.value)
                        }
                        placeholder="49,00"
                      />
                      <input
                        className="input-base h-9 text-sm"
                        value={line.stock}
                        onChange={(event) =>
                          updateCreateLine(line.id, "stock", event.target.value)
                        }
                        placeholder="Lager"
                      />
                      <button
                        type="button"
                        className="inline-flex h-9 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-white disabled:opacity-30"
                        onClick={() => removeCreateLine(line.id)}
                        disabled={createLines.length <= 1}
                        aria-label="Position entfernen"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-secondary h-9 w-full"
                    onClick={() => setCreateLines((current) => [...current, createLine()])}
                  >
                    <Plus className="mr-1 size-4" />
                    Position hinzufügen
                  </button>
                </div>
                {createStockWarnings.length > 0 && (
                  <div className="rounded-xl border border-[#f1d4c4] bg-[#fff4ec] px-3 py-2 text-sm text-[#7a4a2a]">
                    <p className="font-semibold">Lagerhinweis</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {createStockWarnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <label className="flex flex-col gap-1 text-sm">
                  Zahlungsart
                  <select
                    className="input-base"
                    value={createPaymentMethod}
                    onChange={(event) =>
                      setCreatePaymentMethod(event.target.value as PaymentMethod)
                    }
                  >
                    {paymentMethodOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-xl border border-[#e4ece9] bg-white p-3 text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Zwischensumme</span>
                    <span>{formatEuroFromCents(createSubtotalCents)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between font-semibold text-[#1a3f39]">
                    <span>Endbetrag</span>
                    <span>{formatEuroFromCents(createSubtotalCents)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-primary w-full"
                  disabled={saving || !createCustomerId}
                  onClick={() => void createFreeInvoice()}
                >
                  <FilePlus2 className="mr-2 size-4" />
                  Freien Entwurf erstellen
                </button>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-[#1a3f39]">Entwrfe</h3>
            <p className="mt-1 text-sm text-slate-600">
              Finalisierte Rechnungen findest du im Rechnungsarchiv.
            </p>
            <label className="mt-3 flex flex-col gap-1 text-sm">
              Entwurf bearbeiten
              <select
                className="input-base"
                value={selectedInvoiceId ?? ""}
                onChange={(event) => setSelectedInvoiceId(event.target.value || null)}
                disabled={loading}
              >
                <option value="">
                  {loading ? "Wird geladen ..." : "Keinen Entwurf ausgewählt"}
                </option>
                {draftInvoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {formatDraftLabel(invoice)}
                  </option>
                ))}
                {externalInvoice && externalInvoice.lifecycleStatus !== "ENTWURF" && (
                  <option value={externalInvoice.id}>
                    {externalInvoice.invoiceNumber ?? "Finalisierte Rechnung"} ·{" "}
                    {externalInvoice.customerName}
                  </option>
                )}
              </select>
            </label>
            <Link href="/invoices/archive" className="btn-secondary mt-3 h-9 w-full">
              Zum Rechnungsarchiv
            </Link>
          </section>
        </aside>

        <section className="min-h-0 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          {!selectedInvoice || !editor ? (
            <div className="flex min-h-[360px] items-center justify-center text-sm text-slate-500">
              Erstelle links einen Entwurf oder wähle einen vorhandenen Entwurf aus.
            </div>
          ) : (
            <div className="space-y-4">
              <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[#dcebe6] bg-[#f8fcfa] p-3">
                <div>
                  <h2 className="font-serif text-2xl text-[#1a3f39]">
                    {selectedInvoice.invoiceNumber ?? "Entwurf"}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {selectedInvoice.customerName} ·{" "}
                    {selectedInvoice.appointmentService ?? "Freie Rechnung"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-[#d7e6e1] bg-[#f4faf7] px-2 py-0.5 text-[#2f5f56]">
                      {INVOICE_LIFECYCLE_LABELS[selectedInvoice.lifecycleStatus]}
                    </span>
                    <span className="rounded-full border border-[#e5dfeb] bg-[#fbf8ff] px-2 py-0.5 text-[#5a476f]">
                      {requiresFullInvoiceAddress(editorSubtotalCents)
                        ? "Vollständige Rechnung"
                        : "Kleinbetragsrechnung"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href={`/invoices/${selectedInvoice.id}/preview`} className="btn-secondary h-9">
                    <Eye className="mr-2 size-4" />
                    Vorschau
                  </Link>
                  {selectedInvoice.lifecycleStatus === "ENTWURF" && (
                    <button
                      type="button"
                      className="btn-secondary h-9 border-[#e8c8cf] text-[#8a4a5a]"
                      onClick={() => void deleteDraft()}
                      disabled={saving}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Entwurf löschen
                    </button>
                   )}
                </div>
              </header>

              <section className="grid gap-3 lg:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  Kundin
                  <select
                    className="input-base"
                    value={editor.customerId}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) {
                        return;
                      }
                      applyCustomerAddressToEditor(value);
                    }}
                  >
                    <option value="">Kundin auswählen</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Zahlungsart
                  <select
                    className="input-base"
                    value={editor.paymentMethod}
                    onChange={(event) =>
                      setEditor((current) =>
                        current
                          ? {
                              ...current,
                              paymentMethod: event.target.value as PaymentMethod,
                              paymentStatus:
                                event.target.value === "CASH" ? "PAID" : current.paymentStatus,
                            }
                          : current,
                      )
                    }
                  >
                    {paymentMethodOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Zahlungsstatus
                  <select
                    className="input-base"
                    value={editor.paymentStatus}
                    onChange={(event) =>
                      setEditor((current) =>
                        current
                          ? { ...current, paymentStatus: event.target.value as PaymentStatus }
                          : current,
                      )
                    }
                  >
                    {paymentStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Rechnungsdatum
                  <input
                    type="date"
                    className="input-base"
                    value={editor.issueDate}
                    onChange={(event) =>
                      setEditor((current) =>
                        current ? { ...current, issueDate: event.target.value } : current,
                      )
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm lg:col-span-2">
                  Leistungsdatum
                  <input
                    type="date"
                    className="input-base"
                    value={editor.serviceDate}
                    onChange={(event) =>
                      setEditor((current) =>
                        current ? { ...current, serviceDate: event.target.value } : current,
                      )
                    }
                  />
                </label>
              </section>

              <section className="space-y-3 rounded-2xl border border-[#dcebe6] bg-[#f8fcfa] p-3">
                <h3 className="font-semibold text-[#1a3f39]">Rechnung an</h3>
                {needsFullAddress && (
                  <p className="rounded-lg border border-[#f1d4c4] bg-[#fff4ec] px-3 py-2 text-sm text-[#7a4a2a]">
                    Für Beträge über 250 € wird eine vollständige Kundenadresse benötigt.
                  </p>
                 )}
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm md:col-span-2">
                    Name {needsFullAddress ? "*" : ""}
                    <input
                      className="input-base"
                      value={editor.recipientName}
                      onChange={(event) =>
                        setEditor((current) =>
                          current ? { ...current, recipientName: event.target.value } : current,
                        )
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    z. Hd. (optional)
                    <input
                      className="input-base"
                      value={editor.recipientAttention}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? { ...current, recipientAttention: event.target.value }
                            : current,
                        )
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Zusatzzeile (optional)
                    <input
                      className="input-base"
                      value={editor.recipientLine2}
                      onChange={(event) =>
                        setEditor((current) =>
                          current ? { ...current, recipientLine2: event.target.value } : current,
                        )
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Straße {needsFullAddress ? "*" : ""}
                    <input
                      className="input-base"
                      value={editor.recipientStreet}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? { ...current, recipientStreet: event.target.value }
                            : current,
                        )
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Hausnummer {needsFullAddress ? "*" : ""}
                    <input
                      className="input-base"
                      value={editor.recipientHouseNumber}
                      onChange={(event) =>
                        setEditor((current) =>
                          current
                            ? { ...current, recipientHouseNumber: event.target.value }
                            : current,
                        )
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    PLZ {needsFullAddress ? "*" : ""}
                    <input
                      className="input-base"
                      value={editor.recipientZipCode}
                      onChange={(event) =>
                        setEditor((current) =>
                          current ? { ...current, recipientZipCode: event.target.value } : current,
                        )
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Ort {needsFullAddress ? "*" : ""}
                    <input
                      className="input-base"
                      value={editor.recipientCity}
                      onChange={(event) =>
                        setEditor((current) =>
                          current ? { ...current, recipientCity: event.target.value } : current,
                        )
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Land
                    <input
                      className="input-base"
                      value={editor.recipientCountry}
                      onChange={(event) =>
                        setEditor((current) =>
                          current ? { ...current, recipientCountry: event.target.value } : current,
                        )
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    E-Mail (optional)
                    <input
                      className="input-base"
                      value={editor.recipientEmail}
                      onChange={(event) =>
                        setEditor((current) =>
                          current ? { ...current, recipientEmail: event.target.value } : current,
                        )
                      }
                    />
                  </label>
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-[#dcebe6] bg-[#f8fcfa] p-3">
                <h3 className="font-semibold text-[#1a3f39]">Positionen</h3>
                <div className="space-y-2">
                  {editor.items.map((line) => (
                    <div key={line.id} className="grid grid-cols-[minmax(0,1fr)_72px_102px_84px_102px_32px] gap-2">
                      <input
                        className="input-base h-9 text-sm"
                        value={line.service}
                        onChange={(event) =>
                          updateEditorLine(line.id, "service", event.target.value)
                        }
                        placeholder="Bezeichnung"
                      />
                      <input
                        className="input-base h-9 text-sm"
                        value={line.quantity}
                        onChange={(event) =>
                          updateEditorLine(line.id, "quantity", event.target.value)
                        }
                        placeholder="1"
                      />
                      <input
                        className="input-base h-9 text-sm"
                        value={line.unitPrice}
                        onChange={(event) =>
                          updateEditorLine(line.id, "unitPrice", event.target.value)
                        }
                        placeholder="49,00"
                      />
                      <input
                        className="input-base h-9 text-sm"
                        value={line.stock}
                        onChange={(event) =>
                          updateEditorLine(line.id, "stock", event.target.value)
                        }
                        placeholder="Lager"
                      />
                      <div className="flex h-9 items-center rounded-lg border border-[#d7e3df] bg-white px-2 text-sm font-medium text-slate-700">
                        {lineTotalCents(line) === null
                          ? "—"
                          : formatEuroFromCents(lineTotalCents(line) ?? 0)}
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-9 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-white disabled:opacity-30"
                        onClick={() => removeEditorLine(line.id)}
                        disabled={editor.items.length <= 1}
                        aria-label="Position entfernen"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn-secondary h-9"
                  onClick={() =>
                    setEditor((current) =>
                      current ? { ...current, items: [...current.items, createLine()] } : current,
                    )
                  }
                >
                  <Plus className="mr-1 size-4" />
                  Position hinzufügen
                </button>
                {editorStockWarnings.length > 0 && (
                  <div className="rounded-xl border border-[#f1d4c4] bg-[#fff4ec] px-3 py-2 text-sm text-[#7a4a2a]">
                    <p className="font-semibold">Lagerhinweis</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {editorStockWarnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                 )}

                <div className="rounded-xl border border-[#e4ece9] bg-white p-3 text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Zwischensumme</span>
                    <span>{formatEuroFromCents(editorSubtotalCents)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between font-semibold text-[#1a3f39]">
                    <span>Endbetrag</span>
                    <span>{formatEuroFromCents(editorSubtotalCents)}</span>
                  </div>
                </div>
              </section>

              <section className="grid gap-2 md:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-[#f8fcfa] px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={editor.smallBusinessEnabled}
                    onChange={(event) =>
                      setEditor((current) =>
                        current
                          ? { ...current, smallBusinessEnabled: event.target.checked }
                          : current,
                      )
                    }
                  />
                  Kleinunternehmerregelung aktiv (§ 19 UStG)
                </label>
                <label className="flex flex-col gap-1 text-sm md:col-span-2">
                  Rechtlicher Hinweis
                  <textarea
                    className="textarea-base min-h-20"
                    value={editor.legalSmallBusinessNote}
                    onChange={(event) =>
                      setEditor((current) =>
                        current
                          ? { ...current, legalSmallBusinessNote: event.target.value }
                          : current,
                      )
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm md:col-span-2">
                  Abschlusstext
                  <textarea
                    className="textarea-base min-h-20"
                    value={editor.closingText}
                    onChange={(event) =>
                      setEditor((current) =>
                        current ? { ...current, closingText: event.target.value } : current,
                      )
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm md:col-span-2">
                  Zusatzhinweis (optional)
                  <textarea
                    className="textarea-base min-h-20"
                    value={editor.additionalFooterNote}
                    onChange={(event) =>
                      setEditor((current) =>
                        current
                          ? { ...current, additionalFooterNote: event.target.value }
                          : current,
                      )
                    }
                  />
                </label>
              </section>

              <footer className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#dcebe6] bg-[#f8fcfa] p-3">
                <p className="text-sm text-slate-600">
                  {selectedInvoice.lifecycleStatus === "ENTWURF"
                    ? "Entwurf kann gespeichert, finalisiert oder gelöscht werden."
                    : "Finalisierte Rechnung bleibt editierbar; PDF wird bei Änderungen neu erzeugt."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary h-9"
                    onClick={() => void persistInvoice("SAVE_DRAFT")}
                    disabled={saving}
                  >
                    Entwurf speichern
                  </button>
                  <button
                    type="button"
                    className="btn-primary h-9"
                    onClick={() => void persistInvoice("FINALIZE")}
                    disabled={saving}
                  >
                    <CheckCircle2 className="mr-2 size-4" />
                    Finalisieren
                  </button>
                </div>
              </footer>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}



