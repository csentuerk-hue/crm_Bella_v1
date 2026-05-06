"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, CircleDollarSign, Plus, Receipt, Search, ShieldCheck, Trash2 } from "lucide-react";

import { CustomerAvatar } from "@/components/customers/customer-avatar";
import { CustomerStatusBadge } from "@/components/customers/customer-status-badge";
import { InlineNotice } from "@/components/inline-notice";
import { CUSTOMER_STATUS_LABELS, INVOICE_STATUS_LABELS } from "@/lib/constants";
import { compareCustomerStatusForList } from "@/lib/customer-status";
import { apiRequest } from "@/lib/client-api";
import { formatEuroFromCents } from "@/lib/currency";
import { formatDate, formatDateTime } from "@/lib/datetime";
import type { AppointmentDTO, CustomerDTO, CustomerStatus, InvoiceDTO } from "@/types/crm";

type CustomerForm = {
  name: string;
  phone: string;
  email: string;
  birthday: string;
  preferences: string;
  allergies: string;
  notes: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
  billingAddressEnabled: boolean;
  invoiceRecipientName: string;
  invoiceRecipientAttention: string;
  invoiceRecipientLine2: string;
  invoiceStreet: string;
  invoiceHouseNumber: string;
  invoicePostalCode: string;
  invoiceCity: string;
  invoiceCountry: string;
  invoiceEmail: string;
  invoicePhone: string;
  invoiceNotes: string;
  photoUrl: string;
  status: CustomerStatus;
  archived: boolean;
  mediaConsent: boolean;
};

const emptyForm: CustomerForm = {
  name: "",
  phone: "",
  email: "",
  birthday: "",
  preferences: "",
  allergies: "",
  notes: "",
  street: "",
  houseNumber: "",
  postalCode: "",
  city: "",
  country: "Deutschland",
  billingAddressEnabled: false,
  invoiceRecipientName: "",
  invoiceRecipientAttention: "",
  invoiceRecipientLine2: "",
  invoiceStreet: "",
  invoiceHouseNumber: "",
  invoicePostalCode: "",
  invoiceCity: "",
  invoiceCountry: "Deutschland",
  invoiceEmail: "",
  invoicePhone: "",
  invoiceNotes: "",
  photoUrl: "",
  status: "NEU",
  archived: false,
  mediaConsent: false,
};

const FORCED_DELETE_CONFIRMATION_CODE = "54323";

function toDateInput(isoDate: string | null): string {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toPayload(form: CustomerForm) {
  return {
    name: form.name.trim(),
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    birthday: form.birthday || null,
    preferences: form.preferences.trim() || null,
    allergies: form.allergies.trim() || null,
    notes: form.notes.trim() || null,
    street: form.street.trim() || null,
    houseNumber: form.houseNumber.trim() || null,
    postalCode: form.postalCode.trim() || null,
    city: form.city.trim() || null,
    country: form.country.trim() || "Deutschland",
    billingAddressEnabled: form.billingAddressEnabled,
    invoiceRecipientName: form.invoiceRecipientName.trim() || null,
    invoiceRecipientAttention: form.invoiceRecipientAttention.trim() || null,
    invoiceRecipientLine2: form.invoiceRecipientLine2.trim() || null,
    invoiceStreet: form.invoiceStreet.trim() || null,
    invoiceHouseNumber: form.invoiceHouseNumber.trim() || null,
    invoicePostalCode: form.invoicePostalCode.trim() || null,
    invoiceCity: form.invoiceCity.trim() || null,
    invoiceCountry: form.invoiceCountry.trim() || "Deutschland",
    invoiceEmail: form.invoiceEmail.trim() || null,
    invoicePhone: form.invoicePhone.trim() || null,
    invoiceNotes: form.invoiceNotes.trim() || null,
    photoUrl: form.photoUrl.trim() || null,
    status: form.status,
    archived: form.archived,
    mediaConsent: form.mediaConsent,
  };
}

function validateBillingAddressForm(form: CustomerForm): string | null {
  if (!form.billingAddressEnabled) {
    return null;
  }

  if (!form.invoiceRecipientName.trim()) {
    return "Rechnungsempfängername fehlt.";
  }
  if (!form.invoiceStreet.trim()) {
    return "Rechnungsstraße fehlt.";
  }
  if (!form.invoiceHouseNumber.trim()) {
    return "Rechnungshausnummer fehlt.";
  }
  if (!form.invoicePostalCode.trim()) {
    return "Rechnungs-PLZ fehlt.";
  }
  if (!form.invoiceCity.trim()) {
    return "Rechnungsort fehlt.";
  }
  return null;
}

export default function CustomersPage() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [onlyWithMediaConsent, setOnlyWithMediaConsent] = useState(false);
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CustomerForm>(emptyForm);
  const [profileForm, setProfileForm] = useState<CustomerForm | null>(null);
  const profileFormRef = useRef<CustomerForm | null>(null);
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [invoices, setInvoices] = useState<InvoiceDTO[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaDraft, setMediaDraft] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showForcedDeleteZone, setShowForcedDeleteZone] = useState(false);
  const [forcedDeleteCode, setForcedDeleteCode] = useState("");
  const [forcedDeleteAcknowledged, setForcedDeleteAcknowledged] = useState(false);
  const [forcingDelete, setForcingDelete] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const loadCustomers = useCallback(async () => {
    try {
      setLoadingCustomers(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set("query", query.trim());
      if (showArchived) params.set("archived", "true");
      const data = await apiRequest<CustomerDTO[]>(`/api/customers${params.toString() ? `?${params.toString()}` : ""}`);
      setCustomers(data);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Kundinnen konnten nicht geladen werden." });
    } finally {
      setLoadingCustomers(false);
    }
  }, [query, showArchived]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    if (selectedId && !customers.some((customer) => customer.id === selectedId)) {
      setSelectedId(null);
      setAppointments([]);
      setInvoices([]);
    }
  }, [customers, selectedId]);

  const selectedCustomer = useMemo(() => customers.find((customer) => customer.id === selectedId) ?? null, [customers, selectedId]);

  useEffect(() => {
    if (!selectedCustomer) {
      setProfileForm(null);
      profileFormRef.current = null;
      setDeleteConfirmOpen(false);
      setShowForcedDeleteZone(false);
      setForcedDeleteCode("");
      setForcedDeleteAcknowledged(false);
      return;
    }
    const nextForm: CustomerForm = {
      name: selectedCustomer.name,
      phone: selectedCustomer.phone ?? "",
      email: selectedCustomer.email ?? "",
      birthday: toDateInput(selectedCustomer.birthday),
      preferences: selectedCustomer.preferences ?? "",
      allergies: selectedCustomer.allergies ?? "",
      notes: selectedCustomer.notes ?? "",
      street: selectedCustomer.street ?? "",
      houseNumber: selectedCustomer.houseNumber ?? "",
      postalCode: selectedCustomer.postalCode ?? "",
      city: selectedCustomer.city ?? "",
      country: selectedCustomer.country || "Deutschland",
      billingAddressEnabled: selectedCustomer.billingAddressEnabled,
      invoiceRecipientName: selectedCustomer.invoiceRecipientName ?? "",
      invoiceRecipientAttention: selectedCustomer.invoiceRecipientAttention ?? "",
      invoiceRecipientLine2: selectedCustomer.invoiceRecipientLine2 ?? "",
      invoiceStreet: selectedCustomer.invoiceStreet ?? "",
      invoiceHouseNumber: selectedCustomer.invoiceHouseNumber ?? "",
      invoicePostalCode: selectedCustomer.invoicePostalCode ?? "",
      invoiceCity: selectedCustomer.invoiceCity ?? "",
      invoiceCountry: selectedCustomer.invoiceCountry || "Deutschland",
      invoiceEmail: selectedCustomer.invoiceEmail ?? "",
      invoicePhone: selectedCustomer.invoicePhone ?? "",
      invoiceNotes: selectedCustomer.invoiceNotes ?? "",
      photoUrl: selectedCustomer.photoUrl ?? "",
      status: selectedCustomer.manualStatus,
      archived: selectedCustomer.archived,
      mediaConsent: selectedCustomer.mediaConsent,
    };
    setProfileForm(nextForm);
    profileFormRef.current = nextForm;
  }, [selectedCustomer]);

  const updateProfileField = useCallback(
    <K extends keyof CustomerForm>(field: K, value: CustomerForm[K]) => {
      setProfileForm((current) => {
        if (!current) return current;
        const next = { ...current, [field]: value };
        profileFormRef.current = next;
        return next;
      });
    },
    [],
  );

  const loadDetail = useCallback(async (customerId: string) => {
    try {
      setLoadingDetail(true);
      const [appointmentData, invoiceData] = await Promise.all([
        apiRequest<AppointmentDTO[]>(`/api/appointments?includeCancelled=true&customerId=${encodeURIComponent(customerId)}`),
        apiRequest<InvoiceDTO[]>(`/api/invoices?customerId=${encodeURIComponent(customerId)}`),
      ]);
      setAppointments(appointmentData.sort((a, b) => b.startsAt.localeCompare(a.startsAt)));
      setInvoices(invoiceData.sort((a, b) => b.issueDate.localeCompare(a.issueDate)));
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Details konnten nicht geladen werden." });
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId || isCreating) return;
    void loadDetail(selectedId);
  }, [isCreating, loadDetail, selectedId]);

  const listCustomers = useMemo(() => {
    const filteredCustomers = onlyWithMediaConsent
      ? customers.filter((customer) => customer.mediaConsent)
      : customers;

    return [...filteredCustomers].sort((left, right) => {
      const statusOrder = compareCustomerStatusForList(left.status, right.status);
      if (statusOrder !== 0) return statusOrder;
      const leftDate = left.lastAppointmentAt ?? left.updatedAt;
      const rightDate = right.lastAppointmentAt ?? right.updatedAt;
      return rightDate.localeCompare(leftDate);
    });
  }, [customers, onlyWithMediaConsent]);

  const invoiceEligibleAppointment = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            !appointment.hasInvoice &&
            !appointment.isCancelled &&
            (appointment.status === "ERLEDIGT" || appointment.status === "ABGERECHNET"),
        )
        .sort((left, right) => left.startsAt.localeCompare(right.startsAt))[0] ?? null,
    [appointments],
  );

  const startCreate = () => {
    setCreateForm(emptyForm);
    setSelectedId(null);
    setIsCreating(true);
  };

  const openMediaConsentModal = () => {
    if (!profileForm) return;
    setMediaDraft(profileForm.mediaConsent);
    setMediaOpen(true);
  };

  const createCustomer = async () => {
    if (!createForm.name.trim()) {
      setNotice({ type: "error", text: "Name ist ein Pflichtfeld." });
      return;
    }
    const billingValidationMessage = validateBillingAddressForm(createForm);
    if (billingValidationMessage) {
      setNotice({ type: "error", text: billingValidationMessage });
      return;
    }
    try {
      setSavingCreate(true);
      const created = await apiRequest<CustomerDTO>("/api/customers", {
        method: "POST",
        body: { ...toPayload(createForm), status: "NEU", mediaConsent: false },
      });
      setNotice({ type: "success", text: "Kundin wurde angelegt." });
      setIsCreating(false);
      setSelectedId(created.id);
      await loadCustomers();
      await loadDetail(created.id);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Kundin konnte nicht angelegt werden." });
    } finally {
      setSavingCreate(false);
    }
  };

  const saveProfile = async (overrides?: Partial<CustomerForm>) => {
    if (!selectedId) return;
    const current = profileFormRef.current;
    if (!current) return;
    const next = { ...current, ...overrides };
    const billingValidationMessage = validateBillingAddressForm(next);
    if (billingValidationMessage) {
      setNotice({ type: "error", text: billingValidationMessage });
      return;
    }

    try {
      setSaving(true);
      await apiRequest(`/api/customers/${selectedId}`, {
        method: "PUT",
        body: toPayload(next),
      });
      setProfileForm(next);
      profileFormRef.current = next;
      setCustomers((current) => {
        const updated = current.map((customer) =>
          customer.id === selectedId
            ? {
                ...customer,
                name: next.name,
                phone: next.phone || null,
                email: next.email || null,
                birthday: next.birthday ? new Date(next.birthday).toISOString() : null,
                preferences: next.preferences || null,
                allergies: next.allergies || null,
                notes: next.notes || null,
                street: next.street || null,
                houseNumber: next.houseNumber || null,
                postalCode: next.postalCode || null,
                city: next.city || null,
                country: next.country || "Deutschland",
                billingAddressEnabled: next.billingAddressEnabled,
                invoiceRecipientName: next.invoiceRecipientName || null,
                invoiceRecipientAttention: next.invoiceRecipientAttention || null,
                invoiceRecipientLine2: next.invoiceRecipientLine2 || null,
                invoiceStreet: next.invoiceStreet || null,
                invoiceHouseNumber: next.invoiceHouseNumber || null,
                invoicePostalCode: next.invoicePostalCode || null,
                invoiceCity: next.invoiceCity || null,
                invoiceCountry: next.invoiceCountry || "Deutschland",
                invoiceEmail: next.invoiceEmail || null,
                invoicePhone: next.invoicePhone || null,
                invoiceNotes: next.invoiceNotes || null,
                photoUrl: next.photoUrl || null,
                manualStatus: next.status,
                status: next.status,
                archived: next.archived,
                mediaConsent: next.mediaConsent,
                updatedAt: new Date().toISOString(),
              }
            : customer,
        );

        if (next.archived && !showArchived) {
          return updated.filter((customer) => customer.id !== selectedId);
        }

        return updated;
      });
      setNotice({ type: "success", text: "Profil gespeichert." });
      await loadDetail(selectedId);
      if (next.archived && !showArchived) {
        setSelectedId(null);
        setAppointments([]);
        setInvoices([]);
      }
      if (overrides?.mediaConsent !== undefined) setMediaOpen(false);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Profil konnte nicht gespeichert werden." });
    } finally {
      setSaving(false);
    }
  };

  const createInvoiceFromSelectedCustomer = async () => {
    if (!selectedCustomer) return;
    if (!invoiceEligibleAppointment) {
      setNotice({
        type: "info",
        text: "Keine abrechenbaren Termine gefunden. Bitte erst einen erledigten Termin anlegen.",
      });
      return;
    }

    try {
      setCreatingInvoice(true);
      const createdInvoice = await apiRequest<InvoiceDTO>("/api/invoices", {
        method: "POST",
        body: {
          customerId: selectedCustomer.id,
          appointmentId: invoiceEligibleAppointment.id,
        },
      });
      setNotice({
        type: "success",
        text: `Rechnung ${createdInvoice.invoiceNumber} erstellt.`,
      });
      await loadDetail(selectedCustomer.id);
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Rechnung konnte nicht erstellt werden.",
      });
    } finally {
      setCreatingInvoice(false);
    }
  };

  const deleteCustomer = async () => {
    if (!selectedCustomer) return;

    try {
      setDeleting(true);
      await apiRequest(`/api/customers/${selectedCustomer.id}`, { method: "DELETE" });
      setDeleteConfirmOpen(false);
      setSelectedId(null);
      setAppointments([]);
      setInvoices([]);
      setProfileForm(null);
      profileFormRef.current = null;
      setNotice({ type: "success", text: "Kundin wurde dauerhaft gelöscht." });
      await loadCustomers();
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Kundin konnte nicht gelöscht werden.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const forceDeleteCustomer = async () => {
    if (!selectedCustomer) return;

    const isValidCode = forcedDeleteCode.trim() === FORCED_DELETE_CONFIRMATION_CODE;
    if (!isValidCode || !forcedDeleteAcknowledged) {
      setNotice({
        type: "error",
        text: "Forced Delete ist gesperrt. Bitte Code 54323 eingeben und die endgültige Löschung bestätigen.",
      });
      return;
    }

    try {
      setForcingDelete(true);
      await apiRequest(`/api/customers/${selectedCustomer.id}`, {
        method: "DELETE",
        body: {
          forceDelete: true,
          confirmationCode: forcedDeleteCode.trim(),
          confirmPermanentDeletion: forcedDeleteAcknowledged,
        },
      });

      setDeleteConfirmOpen(false);
      setShowForcedDeleteZone(false);
      setForcedDeleteCode("");
      setForcedDeleteAcknowledged(false);
      setSelectedId(null);
      setAppointments([]);
      setInvoices([]);
      setProfileForm(null);
      profileFormRef.current = null;
      setNotice({ type: "success", text: "Kundin und verknüpfte Daten wurden endgültig gelöscht." });
      await loadCustomers();
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Forced Delete konnte nicht ausgeführt werden.",
      });
    } finally {
      setForcingDelete(false);
    }
  };

  const linkedAppointmentsCount = selectedCustomer?.appointmentsCount ?? 0;
  const linkedInvoicesCount = appointments.filter((appointment) => appointment.hasInvoice).length;
  const linkedHistoryCount = selectedCustomer?.treatmentsCount ?? 0;
  const hasCustomerNote = Boolean((selectedCustomer?.notes ?? "").trim());
  const canRunForcedDelete =
    forcedDeleteCode.trim() === FORCED_DELETE_CONFIRMATION_CODE &&
    forcedDeleteAcknowledged &&
    !forcingDelete;

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-hidden">
      <header className="rounded-[28px] border border-[#d5e4df] bg-[linear-gradient(125deg,#ffffff_0%,#f6fbf8_48%,#f8f2f4_100%)] p-5 shadow-[0_14px_32px_rgba(13,80,74,0.11)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="mt-2 font-serif text-4xl leading-none text-[#173f39]">Kundinnen</h1>
          </div>
          <button type="button" className="btn-primary h-10 px-4" onClick={startCreate}>
            <Plus className="mr-2 size-4" />
            Neue Kundin
          </button>
        </div>
      </header>

      {notice ? <InlineNotice type={notice.type} text={notice.text} /> : null}

      <section className="grid min-h-0 flex-1 gap-5 overflow-hidden lg:grid-cols-[330px_minmax(0,1fr)]" data-testid="customers-crm-layout">
        <aside data-testid="customers-list-column" className="min-h-0 rounded-[28px] border border-[#d5e4df] bg-white p-4 shadow-[0_12px_24px_rgba(13,80,74,0.1)]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Suche nach Name" className="input-base w-full pl-9" />
          </label>
          <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
            Archivierte anzeigen
          </label>
          <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={onlyWithMediaConsent}
              onChange={(event) => setOnlyWithMediaConsent(event.target.checked)}
            />
            Nur mit Medienfreigabe
          </label>
          <div className="mt-4 h-full max-h-[calc(100vh-18rem)] overflow-y-auto pr-1">
            {loadingCustomers ? <p className="rounded-xl border border-[#e2ece8] bg-[#f8fcfa] px-3 py-3 text-sm text-slate-600">Kundinnen werden geladen...</p> : null}
            {!loadingCustomers ? (
              listCustomers.length > 0 ? (
                <ul className="space-y-2">
                  {listCustomers.map((customer) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(customer.id);
                          setIsCreating(false);
                          setAppointments([]);
                          setInvoices([]);
                        }}
                        className={`w-full rounded-2xl border px-3 py-2.5 text-left transition ${selectedId === customer.id ? "border-[#8ec2b5] bg-[#e9f6f1]" : "border-[#dfeae6] bg-white hover:border-[#c2d9d1] hover:bg-[#f7fcfa]"}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <CustomerAvatar name={customer.name} photoUrl={customer.photoUrl} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">{customer.name}</p>
                            <p className="truncate text-xs text-slate-600">{customer.phone || "-"}</p>
                            <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-slate-500">Letzter Besuch: {customer.lastAppointmentAt ? formatDate(customer.lastAppointmentAt) : "-"}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-end gap-2">
                          {customer.archived ? <span className="rounded-full border border-[#d4ced2] bg-[#f5eef1] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7b5660]">Archiviert</span> : null}
                          {customer.cancellationCount > 0 ? (
                            <span className="rounded-full border border-[#f1c9b1] bg-[#fff1e7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9a4f20]">
                              {customer.cancellationCount}x storniert
                            </span>
                          ) : null}
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                              customer.mediaConsent
                                ? "border-[#a7d5bc] bg-[#e8f8ee] text-[#2d6b49]"
                                : "border-[#efc0be] bg-[#fff0ef] text-[#8a3f3b]"
                            }`}
                          >
                            {customer.mediaConsent
                              ? "Medienfreigabe vorhanden"
                              : "Keine Medienfreigabe"}
                          </span>
                          <CustomerStatusBadge status={customer.status} />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-[#e2ece8] bg-[#f8fcfa] px-3 py-3 text-sm text-slate-600">Keine passenden Kundinnen gefunden.</p>
              )
            ) : null}
          </div>
        </aside>

        <main data-testid="customers-main-column" className="min-h-0 overflow-y-auto rounded-[28px] border border-[#d5e4df] bg-white p-4 shadow-[0_12px_24px_rgba(13,80,74,0.1)]">
          {!selectedCustomer && !isCreating ? (
            <section className="relative grid min-h-[calc(100vh-16rem)] place-items-center overflow-hidden rounded-3xl border border-[#dceae4] bg-[linear-gradient(180deg,#ffffff_0%,#f8fcfa_100%)]">
              <Image src="/branding/bella-watermark.png" alt="Bella by Sobiella Wasserzeichen" fill className="pointer-events-none object-contain opacity-10" sizes="(min-width: 1024px) 50vw, 100vw" />
              <div className="relative z-10 flex flex-col items-center gap-2">
                <button type="button" className="btn-primary" onClick={startCreate}><Plus className="mr-2 size-4" />Neue Kundin</button>
              </div>
            </section>
          ) : null}

          {isCreating ? (
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div className="rounded-3xl border border-[#dceae4] bg-[#f8fcfa] p-5">
                <h2 className="font-serif text-3xl text-[#1a3f39]">Neue Kundin</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    Name (Pflichtfeld)
                    <input
                      className="input-base"
                      value={createForm.name}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Telefonnummer
                    <input
                      className="input-base"
                      value={createForm.phone}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, phone: event.target.value }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    E-Mail
                    <input
                      className="input-base"
                      value={createForm.email}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, email: event.target.value }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Geburtstag
                    <input
                      type="date"
                      className="input-base"
                      value={createForm.birthday}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, birthday: event.target.value }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Foto URL
                    <input
                      className="input-base"
                      value={createForm.photoUrl}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, photoUrl: event.target.value }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    Vorlieben
                    <textarea
                      className="textarea-base min-h-20"
                      value={createForm.preferences}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, preferences: event.target.value }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    Allergien
                    <textarea
                      className="textarea-base min-h-20"
                      value={createForm.allergies}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, allergies: event.target.value }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    Interne Notiz
                    <textarea
                      className="textarea-base min-h-24"
                      value={createForm.notes}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, notes: event.target.value }))
                      }
                    />
                  </label>

                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#507b71] sm:col-span-2">
                    Kundinnenadresse (Standard für Rechnungs-Fallback)
                  </p>
                  <label className="flex flex-col gap-1 text-sm">
                    Straße
                    <input
                      className="input-base"
                      value={createForm.street}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, street: event.target.value }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Hausnummer
                    <input
                      className="input-base"
                      value={createForm.houseNumber}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, houseNumber: event.target.value }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    PLZ
                    <input
                      className="input-base"
                      value={createForm.postalCode}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, postalCode: event.target.value }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Ort
                    <input
                      className="input-base"
                      value={createForm.city}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, city: event.target.value }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    Land
                    <input
                      className="input-base"
                      value={createForm.country}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, country: event.target.value }))
                      }
                    />
                  </label>

                  <label className="mt-2 inline-flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={createForm.billingAddressEnabled}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          billingAddressEnabled: event.target.checked,
                        }))
                      }
                    />
                    Abweichende Rechnungsadresse verwenden
                  </label>

                  {createForm.billingAddressEnabled ? (
                    <>
                      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                        Rechnungsempfängername (Pflicht)
                        <input
                          className="input-base"
                          value={createForm.invoiceRecipientName}
                          onChange={(event) =>
                            setCreateForm((current) => ({
                              ...current,
                              invoiceRecipientName: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                        z. Hd. / Ansprechpartner
                        <input
                          className="input-base"
                          value={createForm.invoiceRecipientAttention}
                          onChange={(event) =>
                            setCreateForm((current) => ({
                              ...current,
                              invoiceRecipientAttention: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                        Zusatzzeile
                        <input
                          className="input-base"
                          value={createForm.invoiceRecipientLine2}
                          onChange={(event) =>
                            setCreateForm((current) => ({
                              ...current,
                              invoiceRecipientLine2: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        Rechnungsstraße (Pflicht)
                        <input
                          className="input-base"
                          value={createForm.invoiceStreet}
                          onChange={(event) =>
                            setCreateForm((current) => ({ ...current, invoiceStreet: event.target.value }))
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        Rechnungshausnummer (Pflicht)
                        <input
                          className="input-base"
                          value={createForm.invoiceHouseNumber}
                          onChange={(event) =>
                            setCreateForm((current) => ({
                              ...current,
                              invoiceHouseNumber: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        Rechnungs-PLZ (Pflicht)
                        <input
                          className="input-base"
                          value={createForm.invoicePostalCode}
                          onChange={(event) =>
                            setCreateForm((current) => ({
                              ...current,
                              invoicePostalCode: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        Rechnungsort (Pflicht)
                        <input
                          className="input-base"
                          value={createForm.invoiceCity}
                          onChange={(event) =>
                            setCreateForm((current) => ({ ...current, invoiceCity: event.target.value }))
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        Rechnungsland
                        <input
                          className="input-base"
                          value={createForm.invoiceCountry}
                          onChange={(event) =>
                            setCreateForm((current) => ({ ...current, invoiceCountry: event.target.value }))
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        Rechnungs-E-Mail
                        <input
                          className="input-base"
                          value={createForm.invoiceEmail}
                          onChange={(event) =>
                            setCreateForm((current) => ({ ...current, invoiceEmail: event.target.value }))
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        Rechnungs-Telefon
                        <input
                          className="input-base"
                          value={createForm.invoicePhone}
                          onChange={(event) =>
                            setCreateForm((current) => ({ ...current, invoicePhone: event.target.value }))
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                        Rechnungsnotiz (intern)
                        <textarea
                          className="textarea-base min-h-20"
                          value={createForm.invoiceNotes}
                          onChange={(event) =>
                            setCreateForm((current) => ({ ...current, invoiceNotes: event.target.value }))
                          }
                        />
                      </label>
                    </>
                  ) : null}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setIsCreating(false)}>
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void createCustomer()}
                    disabled={savingCreate}
                  >
                    {savingCreate ? "Speichern..." : "Speichern"}
                  </button>
                </div>
              </div>
              <aside data-testid="customers-info-column" className="max-h-[calc(100vh-18rem)] overflow-y-auto rounded-3xl border border-[#dceae4] bg-[#f9fcfb] p-4 pr-2">
                <p className="text-sm text-slate-700">Medienfreigabe wird später im Profil gesetzt.</p>
                <p className="mt-2 text-sm text-slate-700">Name ist Pflicht, weitere Angaben sind optional.</p>
                <p className="mt-2 text-sm text-slate-700">
                  Wenn abweichende Rechnungsadresse aktiv ist, sind Rechnungsempfängername, Straße,
                  Hausnummer, PLZ und Ort Pflicht.
                </p>
              </aside>
            </section>
          ) : null}

          {selectedCustomer && profileForm ? (
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
              <div className="space-y-4">
                {loadingDetail ? <p className="rounded-xl border border-[#e2ece8] bg-[#f7fbf9] px-3 py-3 text-sm text-slate-600">Kundinnendetails werden geladen...</p> : null}
                <article className="rounded-3xl border border-[#d9e7e2] bg-[#f8fcfa] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <CustomerAvatar name={selectedCustomer.name} photoUrl={selectedCustomer.photoUrl} size="lg" />
                      <div>
                        <CustomerStatusBadge status={selectedCustomer.status} />
                        <p className="mt-2 font-serif text-3xl leading-none text-[#173f39]">{selectedCustomer.name}</p>
                        <p className="mt-1 text-sm text-slate-600">{selectedCustomer.phone || "-"} - {selectedCustomer.email || "keine E-Mail"}</p>
                        <p className="mt-2 text-sm font-semibold text-[#1f4f44]">
                          Medienfreigabe: {selectedCustomer.mediaConsent ? "Ja" : "Nein"}
                        </p>
                        <span
                          className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                            selectedCustomer.mediaConsent
                              ? "border-[#a7d5bc] bg-[#e8f8ee] text-[#2d6b49]"
                              : "border-[#efc0be] bg-[#fff0ef] text-[#8a3f3b]"
                          }`}
                        >
                          {selectedCustomer.mediaConsent
                            ? "Medienfreigabe vorhanden"
                            : "Keine Medienfreigabe"}
                        </span>
                        {selectedCustomer.cancellationCount > 0 ? (
                          <p className="mt-2 inline-flex rounded-full border border-[#f1c9b1] bg-[#fff1e7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9a4f20]">
                            {selectedCustomer.cancellationCount}x storniert
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <button type="button" className="btn-secondary h-9 px-3" onClick={() => void saveProfile()} disabled={saving}>{saving ? "Speichern..." : "Profil speichern"}</button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" className="btn-secondary h-9 px-3" onClick={() => router.push(`/appointments?customerId=${encodeURIComponent(selectedCustomer.id)}`)}><CalendarPlus className="mr-1 size-4" />Termin</button>
                    <button type="button" className="btn-secondary h-9 px-3" onClick={() => router.push(`/invoices?customerId=${encodeURIComponent(selectedCustomer.id)}`)}><Receipt className="mr-1 size-4" />Rechnung</button>
                    <button
                      type="button"
                      className="btn-secondary h-9 px-3"
                      onClick={() => void createInvoiceFromSelectedCustomer()}
                      disabled={!invoiceEligibleAppointment || creatingInvoice}
                    >
                      <CircleDollarSign className="mr-1 size-4" />
                      {creatingInvoice ? "Erstelle..." : "Rechnung erstellen"}
                    </button>
                    <button type="button" className="btn-secondary h-9 px-3" onClick={openMediaConsentModal}><ShieldCheck className="mr-1 size-4" />Medienfreigabe</button>
                  </div>
                </article>
                <article className="rounded-3xl border border-[#d9e7e2] bg-white p-4">
                  <h3 className="font-serif text-2xl text-[#1a3f39]">Interne Notiz</h3>
                  <textarea className="textarea-base mt-2 min-h-28 w-full" value={profileForm.notes} onChange={(event) => updateProfileField("notes", event.target.value)} />
                </article>
                <div className="grid gap-4 xl:grid-cols-2">
                  <article className="rounded-3xl border border-[#d9e7e2] bg-white p-4"><h3 className="font-serif text-2xl text-[#1a3f39]">Termine</h3><ul className="mt-2 space-y-2">{appointments.slice(0, 5).map((item) => <li key={item.id} className="rounded-xl border border-[#e4ece8] bg-[#f8fcfa] px-3 py-2 text-sm">{item.service} - {formatDateTime(item.startsAt)}</li>)}</ul></article>
                  <article className="rounded-3xl border border-[#d9e7e2] bg-white p-4"><h3 className="font-serif text-2xl text-[#1a3f39]">Rechnungen</h3><ul className="mt-2 space-y-2">{invoices.slice(0, 5).map((item) => <li key={item.id} className="rounded-xl border border-[#e4ece8] bg-[#f8fcfa] px-3 py-2 text-sm">{item.invoiceNumber} - {formatEuroFromCents(item.amountCents)}</li>)}</ul></article>
                </div>
              </div>
              <aside data-testid="customers-info-column" className="max-h-[calc(100vh-18rem)] space-y-3 overflow-y-auto rounded-3xl border border-[#d9e7e2] bg-[#f9fcfb] p-4 pr-2">
                <label className="flex flex-col gap-1 text-sm">
                  Name
                  <input
                    className="input-base"
                    value={profileForm.name}
                    onChange={(event) => updateProfileField("name", event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Telefon
                  <input
                    className="input-base"
                    value={profileForm.phone}
                    onChange={(event) => updateProfileField("phone", event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  E-Mail
                  <input
                    className="input-base"
                    value={profileForm.email}
                    onChange={(event) => updateProfileField("email", event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Geburtstag
                  <input
                    type="date"
                    className="input-base"
                    value={profileForm.birthday}
                    onChange={(event) => updateProfileField("birthday", event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Status
                  <select
                    className="input-base"
                    value={profileForm.status}
                    onChange={(event) => updateProfileField("status", event.target.value as CustomerStatus)}
                  >
                    <option value="NEU">{CUSTOMER_STATUS_LABELS.NEU}</option>
                    <option value="AKTIV">{CUSTOMER_STATUS_LABELS.AKTIV}</option>
                    <option value="INAKTIV">{CUSTOMER_STATUS_LABELS.INAKTIV}</option>
                  </select>
                </label>
                <p className="rounded-xl border border-[#e4ece8] bg-white px-3 py-2 text-sm">
                  Medienfreigabe:{" "}
                  <span className={profileForm.mediaConsent ? "font-semibold text-[#2d6b49]" : "font-semibold text-[#8a3f3b]"}>
                    {profileForm.mediaConsent ? "Ja" : "Nein"}
                  </span>
                </p>

                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#507b71]">
                  Kundinnenadresse
                </p>
                <label className="flex flex-col gap-1 text-sm">
                  Straße
                  <input
                    className="input-base"
                    value={profileForm.street}
                    onChange={(event) => updateProfileField("street", event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Hausnummer
                  <input
                    className="input-base"
                    value={profileForm.houseNumber}
                    onChange={(event) => updateProfileField("houseNumber", event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  PLZ
                  <input
                    className="input-base"
                    value={profileForm.postalCode}
                    onChange={(event) => updateProfileField("postalCode", event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Ort
                  <input
                    className="input-base"
                    value={profileForm.city}
                    onChange={(event) => updateProfileField("city", event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Land
                  <input
                    className="input-base"
                    value={profileForm.country}
                    onChange={(event) => updateProfileField("country", event.target.value)}
                  />
                </label>

                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={profileForm.billingAddressEnabled}
                    onChange={(event) =>
                      updateProfileField("billingAddressEnabled", event.target.checked)
                    }
                  />
                  Abweichende Rechnungsadresse verwenden
                </label>

                {profileForm.billingAddressEnabled ? (
                  <div className="space-y-3 rounded-2xl border border-[#d7e7e1] bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#507b71]">
                      Rechnungsdaten
                    </p>
                    <label className="flex flex-col gap-1 text-sm">
                      Rechnungsempfängername (Pflicht)
                      <input
                        className="input-base"
                        value={profileForm.invoiceRecipientName}
                        onChange={(event) =>
                          updateProfileField("invoiceRecipientName", event.target.value)
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      z. Hd. / Ansprechpartner
                      <input
                        className="input-base"
                        value={profileForm.invoiceRecipientAttention}
                        onChange={(event) =>
                          updateProfileField("invoiceRecipientAttention", event.target.value)
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Zusatzzeile
                      <input
                        className="input-base"
                        value={profileForm.invoiceRecipientLine2}
                        onChange={(event) =>
                          updateProfileField("invoiceRecipientLine2", event.target.value)
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Rechnungsstraße (Pflicht)
                      <input
                        className="input-base"
                        value={profileForm.invoiceStreet}
                        onChange={(event) => updateProfileField("invoiceStreet", event.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Rechnungshausnummer (Pflicht)
                      <input
                        className="input-base"
                        value={profileForm.invoiceHouseNumber}
                        onChange={(event) =>
                          updateProfileField("invoiceHouseNumber", event.target.value)
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Rechnungs-PLZ (Pflicht)
                      <input
                        className="input-base"
                        value={profileForm.invoicePostalCode}
                        onChange={(event) =>
                          updateProfileField("invoicePostalCode", event.target.value)
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Rechnungsort (Pflicht)
                      <input
                        className="input-base"
                        value={profileForm.invoiceCity}
                        onChange={(event) => updateProfileField("invoiceCity", event.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Rechnungsland
                      <input
                        className="input-base"
                        value={profileForm.invoiceCountry}
                        onChange={(event) => updateProfileField("invoiceCountry", event.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Rechnungs-E-Mail
                      <input
                        className="input-base"
                        value={profileForm.invoiceEmail}
                        onChange={(event) => updateProfileField("invoiceEmail", event.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Rechnungs-Telefon
                      <input
                        className="input-base"
                        value={profileForm.invoicePhone}
                        onChange={(event) => updateProfileField("invoicePhone", event.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      Rechnungsnotiz (intern)
                      <textarea
                        className="textarea-base min-h-20"
                        value={profileForm.invoiceNotes}
                        onChange={(event) => updateProfileField("invoiceNotes", event.target.value)}
                      />
                    </label>
                  </div>
                ) : null}

                <label className="flex flex-col gap-1 text-sm">
                  Vorlieben
                  <textarea
                    className="textarea-base min-h-20"
                    value={profileForm.preferences}
                    onChange={(event) => updateProfileField("preferences", event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Allergien
                  <textarea
                    className="textarea-base min-h-20"
                    value={profileForm.allergies}
                    onChange={(event) => updateProfileField("allergies", event.target.value)}
                  />
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={profileForm.archived}
                    onChange={(event) => updateProfileField("archived", event.target.checked)}
                  />
                  Archiviert
                </label>
                <button
                  type="button"
                  className="btn-secondary h-9 w-full"
                  onClick={() => void saveProfile({ archived: !profileForm.archived })}
                  disabled={saving}
                >
                  {profileForm.archived ? "Archiv aufheben" : "Archivieren"}
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-lg border border-[#e5bfc3] bg-[#fff4f5] text-sm font-semibold text-[#8f3b45] transition hover:border-[#d8a6ac] hover:bg-[#fdecee]"
                  onClick={() => {
                    setDeleteConfirmOpen(true);
                    setShowForcedDeleteZone(false);
                    setForcedDeleteCode("");
                    setForcedDeleteAcknowledged(false);
                  }}
                >
                  <Trash2 className="size-4" />
                  Kundin löschen
                </button>
                <p className="rounded-xl border border-[#e4ece8] bg-white px-3 py-2 text-sm">
                  Letzter Termin: {appointments[0] ? formatDateTime(appointments[0].startsAt) : "-"}
                </p>
                <p className="rounded-xl border border-[#e4ece8] bg-white px-3 py-2 text-sm">
                  Rechnungsstatus: {selectedCustomer.lastInvoiceStatus ? INVOICE_STATUS_LABELS[selectedCustomer.lastInvoiceStatus] : "-"}
                </p>
              </aside>
            </section>
          ) : null}
        </main>
      </section>

      {mediaOpen && profileForm ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 px-3">
          <section className="w-full max-w-md rounded-3xl border border-[#d7e5df] bg-white p-5 shadow-2xl">
            <h3 className="font-serif text-2xl text-[#1a3f39]">Medienfreigabe</h3>
            <div className="mt-4 space-y-2">
              <label className="flex items-center gap-2 rounded-xl border border-[#dce9e3] bg-[#f8fcfa] px-3 py-2 text-sm"><input type="radio" checked={mediaDraft} onChange={() => setMediaDraft(true)} />Ja</label>
              <label className="flex items-center gap-2 rounded-xl border border-[#dce9e3] bg-[#f8fcfa] px-3 py-2 text-sm"><input type="radio" checked={!mediaDraft} onChange={() => setMediaDraft(false)} />Nein</label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => { setMediaOpen(false); setMediaDraft(profileForm.mediaConsent); }}>Abbrechen</button>
              <button type="button" className="btn-primary" onClick={() => void saveProfile({ mediaConsent: mediaDraft })} disabled={saving}>{saving ? "Speichern..." : "Speichern"}</button>
            </div>
          </section>
        </div>
      ) : null}

      {deleteConfirmOpen && selectedCustomer ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-3">
          <section className="w-full max-w-xl rounded-3xl border border-[#ebc2c7] bg-white p-5 shadow-2xl">
            <h3 className="font-serif text-2xl text-[#702d36]">Kundin löschen</h3>
            <p className="mt-3 text-sm text-slate-700">
              Für <span className="font-semibold">{selectedCustomer.name}</span> gibt es zwei getrennte Wege:
              sichere Standard-Löschung und den geschützten Forced Delete.
            </p>
            <p className="mt-2 text-sm text-slate-700">
              Archivieren bleibt ein separater Schritt und ist in der Profilspalte weiterhin verfügbar.
            </p>

            <div className="mt-5 rounded-2xl border border-[#dfe9e5] bg-[#f8fcfa] p-4">
              <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-[#325f58]">Normale Löschung (sicher)</h4>
              <p className="mt-2 text-sm text-slate-700">
                Löscht nur, wenn keine verknüpften Rechnungen oder Termine existieren.
              </p>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="inline-flex items-center rounded-lg border border-[#c97883] bg-[#a94656] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#953f4e]"
                  onClick={() => void deleteCustomer()}
                  disabled={deleting || forcingDelete}
                >
                  {deleting ? "Löschen..." : "Normal löschen"}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#efc7cb] bg-[#fff8f8] p-4">
              <button
                type="button"
                className="inline-flex w-full items-center justify-between rounded-xl border border-[#e8b2b8] bg-white px-3 py-2 text-left text-sm font-semibold text-[#7f2f39] transition hover:bg-[#fff3f4]"
                onClick={() => setShowForcedDeleteZone((current) => !current)}
              >
                <span>Danger Zone: Forced Delete</span>
                <span>{showForcedDeleteZone ? "Ausblenden" : "Anzeigen"}</span>
              </button>

              {showForcedDeleteZone ? (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-[#7a3038]">
                    Dieser Vorgang entfernt endgültig und rekursiv:
                  </p>
                  <ul className="space-y-1 rounded-xl border border-[#ecc8cc] bg-white px-3 py-2 text-sm text-slate-700">
                    <li>- Kundin (1x)</li>
                    <li>- Verknüpfte Termine ({linkedAppointmentsCount}x)</li>
                    <li>- Verknüpfte Rechnungen ({linkedInvoicesCount}x)</li>
                    <li>- Verlauf / Behandlungs-Historie ({linkedHistoryCount}x)</li>
                    <li>- Interne Notiz ({hasCustomerNote ? "1x" : "0x"})</li>
                  </ul>

                  <label className="flex flex-col gap-1 text-sm">
                    Sicherheitscode eingeben (nur Zahlen):
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="54323"
                      className="input-base"
                      value={forcedDeleteCode}
                      onChange={(event) => setForcedDeleteCode(event.target.value)}
                    />
                  </label>

                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={forcedDeleteAcknowledged}
                      onChange={(event) => setForcedDeleteAcknowledged(event.target.checked)}
                    />
                    Ich verstehe, dass diese Löschung endgültig ist.
                  </label>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="inline-flex items-center rounded-lg border border-[#9f3341] bg-[#7f2230] px-4 py-2 text-sm font-semibold text-white transition enabled:hover:bg-[#6a1d28] disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => void forceDeleteCustomer()}
                      disabled={!canRunForcedDelete}
                    >
                      {forcingDelete ? "Forced Delete läuft..." : "Forced Delete ausführen"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setShowForcedDeleteZone(false);
                  setForcedDeleteCode("");
                  setForcedDeleteAcknowledged(false);
                }}
                disabled={deleting || forcingDelete}
              >
                Schließen
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

