"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Plus,
  Search,
  Users,
} from "lucide-react";

import { InlineNotice } from "@/components/inline-notice";
import {
  APPOINTMENT_SERVICE_OPTIONS,
  getServiceBadgeClass,
  getServiceBadgeStyle,
  getServiceColor,
  getServiceDotStyle,
} from "@/lib/appointment-services";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/constants";
import { apiRequest } from "@/lib/client-api";
import { formatEuroFromCents } from "@/lib/currency";
import { formatDateTime } from "@/lib/datetime";
import type {
  AppointmentDTO,
  AppointmentStatus,
  CustomerDTO,
  PaymentMethod,
  ServiceDTO,
} from "@/types/crm";

type CreationMode = "normal" | "quick";
type ArchiveStatusFilter =
  | "ALL"
  | "OPEN_ARCHIVE"
  | "ERLEDIGT"
  | "ABGERECHNET"
  | "STORNIERT";
type ServiceType = "preset" | "individual" | "quick";

type AppointmentForm = {
  id: string;
  title: string;
  customerId: string;
  startsAt: string;
  service: string;
  customServiceText: string;
  notes: string;
  priceEuro: string;
  status: AppointmentStatus;
  hasInvoice: boolean;
};

type ServiceOption = {
  id: string | null;
  value: string;
  defaultPriceCents: number;
  durationMinutes: number;
  type: ServiceType;
};

type QuickCustomerForm = {
  name: string;
  phone: string;
  email: string;
};

const QUICK_SERVICE_VALUE = "Schnelltermin";
const QUICK_PLACEHOLDER_CUSTOMER_NAME = "Schnelltermin (Platzhalter)";
const DEFAULT_PAYMENT_METHOD: PaymentMethod = "BANK_TRANSFER";

const PAYMENT_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "BANK_TRANSFER", label: "Überweisung" },
  { value: "CASH", label: "Barzahlung" },
  { value: "CARD", label: "Kartenzahlung" },
];

const STATUS_ORDER: Record<ArchiveStatusFilter, string> = {
  ALL: "Alle",
  OPEN_ARCHIVE: "Offen",
  ERLEDIGT: "Erledigt",
  ABGERECHNET: "Abgerechnet",
  STORNIERT: "Storniert",
};

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const emptyAppointmentForm: AppointmentForm = {
  id: "",
  title: "",
  customerId: "",
  startsAt: "",
  service: APPOINTMENT_SERVICE_OPTIONS[0].value ?? "Refill",
  customServiceText: "",
  notes: "",
  priceEuro:
    APPOINTMENT_SERVICE_OPTIONS[0].defaultPriceCents != null
      ? (APPOINTMENT_SERVICE_OPTIONS[0].defaultPriceCents / 100)
          .toFixed(2)
          .replace(".", ",")
      : "",
  status: "OFFEN",
  hasInvoice: false,
};

function parseEuroToCents(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function startsAtToLocalInput(startsAt: string): string {
  return startsAt.slice(0, 16);
}

function toIsoWithOffset(localDateTime: string): string {
  return new Date(localDateTime).toISOString();
}

function getWeekStart(baseDate: Date): Date {
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function getWeekEnd(baseDate: Date): Date {
  const weekStart = getWeekStart(baseDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

function isSameCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatWeekLabel(now: Date): string {
  const weekStart = getWeekStart(now);
  const weekEnd = getWeekEnd(now);
  const startDay = String(weekStart.getDate()).padStart(2, "0");
  const startMonth = String(weekStart.getMonth() + 1).padStart(2, "0");
  const endDay = String(weekEnd.getDate()).padStart(2, "0");
  const endMonth = String(weekEnd.getMonth() + 1).padStart(2, "0");
  return `${startDay}.${startMonth}.–${endDay}.${endMonth}.`;
}

function normalizeForSearch(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function toServiceType(value: string): ServiceType {
  const normalized = normalizeForSearch(value);
  if (normalized === normalizeForSearch(QUICK_SERVICE_VALUE)) return "quick";
  if (normalized.includes("individuell")) return "individual";
  return "preset";
}

function toArchiveStatus(appointment: AppointmentDTO): ArchiveStatusFilter {
  if (appointment.isCancelled) return "STORNIERT";
  if (appointment.hasInvoice || appointment.status === "ABGERECHNET") {
    return "ABGERECHNET";
  }
  return "ERLEDIGT";
}

export default function AppointmentsPage() {
  const router = useRouter();

  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [allCustomers, setAllCustomers] = useState<CustomerDTO[]>([]);
  const [services, setServices] = useState<ServiceDTO[]>([]);
  const [placeholderCustomerId, setPlaceholderCustomerId] = useState<string | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [archiveCustomerId, setArchiveCustomerId] = useState("");
  const [archiveStatus, setArchiveStatus] = useState<ArchiveStatusFilter>("ALL");
  const [archiveDateFrom, setArchiveDateFrom] = useState("");
  const [archiveDateTo, setArchiveDateTo] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [creationMode, setCreationMode] = useState<CreationMode>("normal");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<AppointmentForm>(emptyAppointmentForm);
  const [customerSearch, setCustomerSearch] = useState("");
  const [submittingForm, setSubmittingForm] = useState(false);

  const [assignCustomerId, setAssignCustomerId] = useState("");
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState<QuickCustomerForm>({
    name: "",
    phone: "",
    email: "",
  });
  const [creatingQuickCustomer, setCreatingQuickCustomer] = useState(false);

  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceAppointmentId, setInvoiceAppointmentId] = useState<string | null>(
    null,
  );
  const [invoicePaymentMethod, setInvoicePaymentMethod] =
    useState<PaymentMethod>(DEFAULT_PAYMENT_METHOD);
  const [invoicePriceEuro, setInvoicePriceEuro] = useState("");
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [deletingQuickAppointmentId, setDeletingQuickAppointmentId] = useState<string | null>(
    null,
  );

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [appointmentData, customerData, serviceData] = await Promise.all([
        apiRequest<AppointmentDTO[]>("/api/appointments?includeCancelled=true"),
        apiRequest<CustomerDTO[]>("/api/customers?archived=true"),
        apiRequest<ServiceDTO[]>("/api/services?includeInactive=true"),
      ]);

      setAppointments(appointmentData);
      setAllCustomers(customerData);
      setServices(serviceData);

      const placeholder = customerData.find(
        (customer) =>
          normalizeForSearch(customer.name) ===
            normalizeForSearch(QUICK_PLACEHOLDER_CUSTOMER_NAME) && customer.archived,
      );
      setPlaceholderCustomerId(placeholder?.id ?? null);

      setSelectedAppointmentId((current) => {
        if (current && appointmentData.some((item) => item.id === current)) {
          return current;
        }
        return appointmentData[0]?.id ?? null;
      });
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Termine konnten nicht geladen werden.",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeCustomers = useMemo(
    () =>
      allCustomers.filter(
        (customer) =>
          !customer.archived &&
          normalizeForSearch(customer.name) !==
            normalizeForSearch(QUICK_PLACEHOLDER_CUSTOMER_NAME),
      ),
    [allCustomers],
  );

  const serviceOptions = useMemo<ServiceOption[]>(() => {
    const fromApi: ServiceOption[] = services
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((service) => ({
        id: service.id,
        value: service.name,
        defaultPriceCents: service.defaultPriceCents,
        durationMinutes: service.durationMinutes,
        type: toServiceType(service.name),
      }));

    const withFallbacks: ServiceOption[] = [...fromApi];
    for (const fallback of APPOINTMENT_SERVICE_OPTIONS) {
      if (
        !withFallbacks.some(
          (option) =>
            normalizeForSearch(option.value) ===
            normalizeForSearch(fallback.value),
        )
      ) {
        withFallbacks.push({
          id: null,
          value: fallback.value,
          defaultPriceCents: fallback.defaultPriceCents,
          durationMinutes: 0,
          type: toServiceType(fallback.value),
        });
      }
    }
    if (
      !withFallbacks.some(
        (option) =>
          normalizeForSearch(option.value) === normalizeForSearch(QUICK_SERVICE_VALUE),
      )
    ) {
      withFallbacks.push({
        id: null,
        value: QUICK_SERVICE_VALUE,
        defaultPriceCents: 0,
        durationMinutes: 0,
        type: "quick",
      });
    }

    return withFallbacks;
  }, [services]);

  const findServiceOption = useCallback(
    (service: string | null | undefined) => {
      const normalized = normalizeForSearch(service);
      if (!normalized) return null;
      return (
        serviceOptions.find(
          (option) => normalizeForSearch(option.value) === normalized,
        ) ?? null
      );
    },
    [serviceOptions],
  );

  const ensurePlaceholderCustomer = useCallback(async () => {
    if (placeholderCustomerId) {
      return placeholderCustomerId;
    }

    const existing = allCustomers.find(
      (customer) =>
        normalizeForSearch(customer.name) ===
          normalizeForSearch(QUICK_PLACEHOLDER_CUSTOMER_NAME) && customer.archived,
    );
    if (existing) {
      setPlaceholderCustomerId(existing.id);
      return existing.id;
    }

    const created = await apiRequest<CustomerDTO>("/api/customers", {
      method: "POST",
      body: {
        name: QUICK_PLACEHOLDER_CUSTOMER_NAME,
        archived: true,
          notes:
            "Systemkundin für Schnelltermine. Wird für unvollständige Termine verwendet.",
        status: "NEU",
      },
    });

    setAllCustomers((current) => [created, ...current]);
    setPlaceholderCustomerId(created.id);
    return created.id;
  }, [allCustomers, placeholderCustomerId]);

  const now = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => getWeekStart(now), [now]);
  const weekEnd = useMemo(() => getWeekEnd(now), [now]);

  const activeAppointments = useMemo(() => {
    const searchTerm = normalizeForSearch(search);
    return appointments
      .filter(
        (appointment) =>
          !appointment.isCancelled &&
          !appointment.hasInvoice &&
          appointment.status !== "ERLEDIGT" &&
          appointment.status !== "ABGERECHNET",
      )
      .filter((appointment) => {
        if (!searchTerm) return true;
        return (
          normalizeForSearch(appointment.customerName).includes(searchTerm) ||
          normalizeForSearch(appointment.service).includes(searchTerm) ||
          normalizeForSearch(appointment.title).includes(searchTerm)
        );
      })
      .sort(
        (left, right) =>
          new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
      );
  }, [appointments, search]);

  const upcomingAppointments = useMemo(
    () =>
      activeAppointments
        .filter((appointment) => new Date(appointment.startsAt).getTime() >= now.getTime())
        .slice(0, 3),
    [activeAppointments, now],
  );

  const weeklyAppointments = useMemo(
    () =>
      activeAppointments.filter((appointment) => {
        const startsAt = new Date(appointment.startsAt);
        return startsAt >= weekStart && startsAt <= weekEnd;
      }),
    [activeAppointments, weekEnd, weekStart],
  );

  const weeklyDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + index);
        const appointmentsForDay = weeklyAppointments.filter((appointment) =>
          isSameCalendarDay(new Date(appointment.startsAt), day),
        );
        return { day, appointments: appointmentsForDay };
      }),
    [weekStart, weeklyAppointments],
  );

  const boardColumns = useMemo(() => {
    const offen: AppointmentDTO[] = [];
    const dieseWoche: AppointmentDTO[] = [];
    const vergangen: AppointmentDTO[] = [];

    for (const appointment of activeAppointments) {
      const startsAt = new Date(appointment.startsAt);
      if (startsAt < now) {
        vergangen.push(appointment);
        continue;
      }
      if (startsAt >= weekStart && startsAt <= weekEnd) {
        dieseWoche.push(appointment);
        continue;
      }
      offen.push(appointment);
    }

    return [
      {
        key: "OFFEN",
        title: "Offen",
        items: offen,
      },
      {
        key: "DIESE_WOCHE",
        title: "Diese Woche",
        items: dieseWoche,
      },
      {
        key: "VERGANGEN",
        title: "Vergangen",
        items: vergangen,
      },
    ];
  }, [activeAppointments, now, weekEnd, weekStart]);

  const archiveAppointments = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            appointment.isCancelled ||
            appointment.status === "ERLEDIGT" ||
            appointment.status === "ABGERECHNET" ||
            appointment.hasInvoice,
        )
        .sort(
          (left, right) =>
            new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime(),
        ),
    [appointments],
  );

  const archiveSummary = useMemo(() => {
    const open = archiveAppointments.filter(
      (appointment) =>
        !appointment.isCancelled &&
        appointment.status === "ERLEDIGT" &&
        !appointment.hasInvoice,
    ).length;
    const billed = archiveAppointments.filter(
      (appointment) =>
        appointment.hasInvoice || appointment.status === "ABGERECHNET",
    ).length;
    const cancelled = archiveAppointments.filter(
      (appointment) => appointment.isCancelled,
    ).length;
    return { open, billed, cancelled };
  }, [archiveAppointments]);

  const filteredArchiveAppointments = useMemo(() => {
    const searchTerm = normalizeForSearch(archiveSearch);
    const fromDate = archiveDateFrom ? new Date(`${archiveDateFrom}T00:00:00`) : null;
    const toDate = archiveDateTo ? new Date(`${archiveDateTo}T23:59:59`) : null;

    return archiveAppointments.filter((appointment) => {
      if (archiveCustomerId && appointment.customerId !== archiveCustomerId) {
        return false;
      }

      const archiveStatusValue = toArchiveStatus(appointment);
      if (archiveStatus !== "ALL") {
        if (archiveStatus === "OPEN_ARCHIVE") {
          if (
            !(
              appointment.status === "ERLEDIGT" &&
              !appointment.hasInvoice &&
              !appointment.isCancelled
            )
          ) {
            return false;
          }
        } else if (archiveStatusValue !== archiveStatus) {
          return false;
        }
      }

      const startsAt = new Date(appointment.startsAt);
      if (fromDate && startsAt < fromDate) {
        return false;
      }
      if (toDate && startsAt > toDate) {
        return false;
      }

      if (!searchTerm) {
        return true;
      }
      return (
        normalizeForSearch(appointment.customerName).includes(searchTerm) ||
        normalizeForSearch(appointment.service).includes(searchTerm) ||
        normalizeForSearch(appointment.title).includes(searchTerm)
      );
    });
  }, [
    archiveAppointments,
    archiveCustomerId,
    archiveDateFrom,
    archiveDateTo,
    archiveSearch,
    archiveStatus,
  ]);

  const selectedAppointment = useMemo(
    () => appointments.find((appointment) => appointment.id === selectedAppointmentId) ?? null,
    [appointments, selectedAppointmentId],
  );

  const isQuickAppointment = useCallback(
    (appointment: AppointmentDTO) =>
      appointment.customerId === placeholderCustomerId ||
      normalizeForSearch(appointment.service) === normalizeForSearch(QUICK_SERVICE_VALUE) ||
      appointment.priceCents === 0,
    [placeholderCustomerId],
  );

  const isSelectedQuickPlaceholder = Boolean(
    selectedAppointment &&
      selectedAppointment.customerId === placeholderCustomerId,
  );
  const selectedIsQuickAppointment = Boolean(
    selectedAppointment && isQuickAppointment(selectedAppointment),
  );

  useEffect(() => {
    if (!assignCustomerId && activeCustomers.length > 0) {
      setAssignCustomerId(activeCustomers[0].id);
    }
  }, [activeCustomers, assignCustomerId]);

  const openCreate = (mode: CreationMode) => {
    const defaultService =
      mode === "quick"
        ? QUICK_SERVICE_VALUE
        : serviceOptions.find((option) => option.type === "preset")?.value ??
          APPOINTMENT_SERVICE_OPTIONS[0].value ??
          "Refill";
    const defaultServiceOption = findServiceOption(defaultService);
    const defaultPrice =
      mode === "quick"
        ? ""
        : defaultServiceOption && defaultServiceOption.defaultPriceCents > 0
          ? centsToInput(defaultServiceOption.defaultPriceCents)
          : "";

    setCreationMode(mode);
    setForm({
      ...emptyAppointmentForm,
      id: "",
      title: "",
      customerId: "",
      startsAt: new Date().toISOString().slice(0, 16),
      service: defaultService,
      customServiceText: "",
      notes: "",
      priceEuro: defaultPrice,
      status: "OFFEN",
      hasInvoice: false,
    });
    setCustomerSearch("");
    setCreateMenuOpen(false);
    setFormOpen(true);
  };

  const openEdit = (appointment: AppointmentDTO) => {
    const serviceOption = findServiceOption(appointment.service);
    const isQuick =
      appointment.customerId === placeholderCustomerId ||
      normalizeForSearch(appointment.service) ===
        normalizeForSearch(QUICK_SERVICE_VALUE) ||
      appointment.priceCents === 0;

    setCreationMode(isQuick ? "quick" : "normal");
    setForm({
      id: appointment.id,
      title: appointment.title ?? "",
      customerId:
        appointment.customerId === placeholderCustomerId ? "" : appointment.customerId,
      startsAt: startsAtToLocalInput(appointment.startsAt),
      service:
        serviceOption ||
        normalizeForSearch(appointment.service) ===
          normalizeForSearch(QUICK_SERVICE_VALUE)
          ? appointment.service
          : "Individuell",
      customServiceText:
        serviceOption &&
        serviceOption.type !== "individual" &&
        serviceOption.type !== "quick"
          ? ""
          : normalizeForSearch(appointment.service) ===
              normalizeForSearch(QUICK_SERVICE_VALUE)
            ? ""
            : appointment.service,
      notes: appointment.notes ?? "",
      priceEuro:
        appointment.priceCents > 0 ? centsToInput(appointment.priceCents) : "",
      status: appointment.status,
      hasInvoice: appointment.hasInvoice,
    });
    setCustomerSearch(appointment.customerName);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setForm(emptyAppointmentForm);
    setCustomerSearch("");
  };

  const customerOptions = useMemo(() => {
    const query = normalizeForSearch(customerSearch);
    const filtered = !query
      ? activeCustomers
      : activeCustomers.filter((customer) => {
          return (
            normalizeForSearch(customer.name).includes(query) ||
            normalizeForSearch(customer.email).includes(query) ||
            normalizeForSearch(customer.phone).includes(query)
          );
        });
    return filtered;
  }, [activeCustomers, customerSearch]);

  const selectedFormCustomer = useMemo(
    () => activeCustomers.find((customer) => customer.id === form.customerId) ?? null,
    [activeCustomers, form.customerId],
  );

  const setServiceValue = (nextService: string) => {
    const option = findServiceOption(nextService);
    setForm((current) => ({
      ...current,
      service: nextService,
      customServiceText: nextService === "Individuell" ? current.customServiceText : "",
      priceEuro:
        option && option.type === "preset" && option.defaultPriceCents > 0
          ? centsToInput(option.defaultPriceCents)
          : nextService === QUICK_SERVICE_VALUE
            ? ""
            : current.priceEuro,
    }));
  };

  const submitForm = async () => {
    if (!form.startsAt) {
      setNotice({ type: "error", text: "Bitte Datum und Uhrzeit eintragen." });
      return;
    }

    const selectedService =
      form.service === "Individuell"
        ? form.customServiceText.trim()
        : form.service.trim();
    const serviceOption = findServiceOption(form.service);
    const isIndividual =
      form.service === "Individuell" || serviceOption?.type === "individual";
    const isQuickService =
      normalizeForSearch(form.service) ===
        normalizeForSearch(QUICK_SERVICE_VALUE) ||
      serviceOption?.type === "quick";

    let resolvedCustomerId = form.customerId.trim();
    if (!resolvedCustomerId && creationMode === "quick") {
      resolvedCustomerId = await ensurePlaceholderCustomer();
    }

    if (creationMode === "normal" && !resolvedCustomerId) {
      setNotice({ type: "error", text: "Bitte eine Kundin auswählen." });
      return;
    }

    if (creationMode === "normal" && !selectedService) {
      setNotice({ type: "error", text: "Bitte eine Leistung auswählen." });
      return;
    }

    const parsedPrice = parseEuroToCents(form.priceEuro);
    let resolvedPriceCents = parsedPrice;

    if (!resolvedPriceCents && serviceOption?.type === "preset") {
      resolvedPriceCents = serviceOption.defaultPriceCents;
    }

    if (creationMode === "normal" && isIndividual && !resolvedPriceCents) {
      setNotice({
        type: "error",
        text: "Für individuelle Leistungen bitte einen Preis eintragen.",
      });
      return;
    }

    if (creationMode === "normal" && !isQuickService && !resolvedPriceCents) {
      setNotice({ type: "error", text: "Bitte einen gültigen Preis eintragen." });
      return;
    }

    if (creationMode === "quick" && resolvedPriceCents === null) {
      resolvedPriceCents = 0;
    }

    const effectiveService =
      selectedService ||
      (creationMode === "quick" ? QUICK_SERVICE_VALUE : form.service.trim());

    if (form.status === "ERLEDIGT") {
      if (!resolvedCustomerId || resolvedCustomerId === placeholderCustomerId) {
        setNotice({
          type: "error",
          text: "Für erledigte Termine bitte zuerst eine echte Kundin zuweisen.",
        });
        return;
      }
      if (
        !effectiveService ||
        normalizeForSearch(effectiveService) ===
          normalizeForSearch(QUICK_SERVICE_VALUE)
      ) {
        setNotice({
          type: "error",
          text: "Für erledigte Termine bitte eine gültige Leistung wählen.",
        });
        return;
      }
      const completionServiceOption =
        findServiceOption(effectiveService) ?? serviceOption;
      if (
        (!completionServiceOption ||
          completionServiceOption.type === "individual") &&
        (resolvedPriceCents ?? 0) <= 0
      ) {
        setNotice({
          type: "error",
          text: "Für individuelle Leistungen ist ein Preis erforderlich.",
        });
        return;
      }
    }

    const payload = {
      title: form.title.trim() || null,
      startsAt: toIsoWithOffset(form.startsAt),
      service: effectiveService,
      notes: form.notes.trim() || null,
      status: form.status,
      priceCents: resolvedPriceCents ?? 0,
      customerId: resolvedCustomerId,
      isCancelled: false,
      cancellationReason: null,
    };

    if (form.id && form.hasInvoice) {
      try {
        setSubmittingForm(true);
        await apiRequest(`/api/appointments/${form.id}`, {
          method: "PUT",
          body: { status: "ABGERECHNET" as AppointmentStatus },
        });
        setNotice({ type: "success", text: "Terminstatus aktualisiert." });
        closeForm();
        await loadData();
      } catch (error) {
        setNotice({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "Termin konnte nicht gespeichert werden.",
        });
      } finally {
        setSubmittingForm(false);
      }
      return;
    }

    try {
      setSubmittingForm(true);
      if (form.id) {
        await apiRequest(`/api/appointments/${form.id}`, {
          method: "PUT",
          body: payload,
        });
        setNotice({ type: "success", text: "Termin aktualisiert." });
      } else {
        await apiRequest("/api/appointments", {
          method: "POST",
          body: payload,
        });
        setNotice({ type: "success", text: "Termin gespeichert." });
      }
      closeForm();
      await loadData();
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Termin konnte nicht gespeichert werden.",
      });
    } finally {
      setSubmittingForm(false);
    }
  };

  const updateAppointmentStatus = async (
    appointmentId: string,
    status: AppointmentStatus,
  ) => {
    await apiRequest(`/api/appointments/${appointmentId}/status`, {
      method: "PATCH",
      body: { status },
    });
  };

  const cancelAppointment = async (appointment: AppointmentDTO) => {
    try {
      await apiRequest(`/api/appointments/${appointment.id}`, {
        method: "PUT",
        body: {
          isCancelled: true,
          cancellationReason: "Storniert",
          status: appointment.status,
        },
      });
      setNotice({ type: "info", text: "Termin wurde storniert." });
      await loadData();
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Termin konnte nicht storniert werden.",
      });
    }
  };

  const deleteQuickAppointment = async (appointment: AppointmentDTO) => {
    if (!isQuickAppointment(appointment)) {
      setNotice({
        type: "error",
        text: "Schnelltermin-Löschen ist nur für Schnelltermine verfügbar.",
      });
      return;
    }
    if (appointment.hasInvoice) {
      setNotice({
        type: "error",
        text: "Schnelltermin mit Rechnung kann nicht gelöscht werden.",
      });
      return;
    }

    const confirmed = window.confirm(
      "Schnelltermin wirklich endgültig löschen Dieser Vorgang ist permanent.",
    );
    if (!confirmed) {
      return;
    }

    try {
      setDeletingQuickAppointmentId(appointment.id);
      await apiRequest(`/api/appointments/${appointment.id}`, {
        method: "DELETE",
      });
      setNotice({ type: "success", text: "Schnelltermin wurde gelöscht." });
      await loadData();
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Schnelltermin konnte nicht gelöscht werden.",
      });
    } finally {
      setDeletingQuickAppointmentId(null);
    }
  };

  const markAppointmentCompleted = async (appointment: AppointmentDTO) => {
    if (appointment.customerId === placeholderCustomerId) {
      setNotice({
        type: "error",
        text: "Bitte zuerst eine Kundin zuweisen, bevor der Termin erledigt wird.",
      });
      return;
    }

    if (
      !appointment.service ||
      normalizeForSearch(appointment.service) ===
        normalizeForSearch(QUICK_SERVICE_VALUE)
    ) {
      setNotice({
        type: "error",
        text: "Bitte zuerst eine Leistung für den Termin hinterlegen.",
      });
      return;
    }

    const serviceOption = findServiceOption(appointment.service);
    const currentPrice = appointment.finalPriceCents || appointment.priceCents;

    if (serviceOption?.type === "preset" && currentPrice <= 0) {
      if (serviceOption.defaultPriceCents <= 0) {
        setNotice({
          type: "error",
          text: "Für diese Leistung fehlt ein gültiger Standardpreis.",
        });
        return;
      }

      await apiRequest(`/api/appointments/${appointment.id}`, {
        method: "PUT",
        body: {
          priceCents: serviceOption.defaultPriceCents,
        },
      });
    } else if (
      (!serviceOption || serviceOption.type === "individual") &&
      currentPrice <= 0
    ) {
      setNotice({
        type: "error",
        text: "Für individuelle Leistungen bitte zuerst einen Preis eintragen.",
      });
      return;
    }

    try {
      await updateAppointmentStatus(appointment.id, "ERLEDIGT");
      setNotice({ type: "success", text: "Termin als erledigt archiviert." });
      await loadData();
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Status konnte nicht aktualisiert werden.",
      });
    }
  };

  const assignCustomerToSelected = async () => {
    if (!selectedAppointment || !assignCustomerId) {
      setNotice({ type: "error", text: "Bitte eine Kundin auswählen." });
      return;
    }
    try {
      await apiRequest(`/api/appointments/${selectedAppointment.id}`, {
        method: "PUT",
        body: { customerId: assignCustomerId },
      });
      setNotice({ type: "success", text: "Kundin wurde zugewiesen." });
      await loadData();
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Kundin konnte nicht zugewiesen werden.",
      });
    }
  };

  const createCustomerForSelected = async () => {
    if (!selectedAppointment) {
      return;
    }
    if (!quickCustomerForm.name.trim()) {
      setNotice({ type: "error", text: "Bitte einen Namen für die Kundin eintragen." });
      return;
    }

    try {
      setCreatingQuickCustomer(true);
      const created = await apiRequest<CustomerDTO>("/api/customers", {
        method: "POST",
        body: {
          name: quickCustomerForm.name.trim(),
          phone: quickCustomerForm.phone.trim() || null,
          email: quickCustomerForm.email.trim() || null,
          status: "NEU",
          archived: false,
          mediaConsent: false,
        },
      });
      await apiRequest(`/api/appointments/${selectedAppointment.id}`, {
        method: "PUT",
        body: { customerId: created.id },
      });
      setQuickCustomerOpen(false);
      setQuickCustomerForm({ name: "", phone: "", email: "" });
      setNotice({ type: "success", text: "Neue Kundin erstellt und zugewiesen." });
      await loadData();
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Kundin konnte nicht erstellt werden.",
      });
    } finally {
      setCreatingQuickCustomer(false);
    }
  };

  const openInvoiceDialog = (appointment: AppointmentDTO) => {
    const serviceOption = findServiceOption(appointment.service);
    const fallbackPrice =
      appointment.priceCents > 0
        ? appointment.priceCents
        : serviceOption?.defaultPriceCents ?? 0;

    setInvoiceAppointmentId(appointment.id);
    setInvoicePaymentMethod(DEFAULT_PAYMENT_METHOD);
    setInvoicePriceEuro(fallbackPrice > 0 ? centsToInput(fallbackPrice) : "");
    setInvoiceDialogOpen(true);
  };

  const closeInvoiceDialog = () => {
    setInvoiceDialogOpen(false);
    setInvoiceAppointmentId(null);
    setInvoicePriceEuro("");
    setInvoicePaymentMethod(DEFAULT_PAYMENT_METHOD);
  };

  const submitInvoiceFromArchive = async () => {
    if (!invoiceAppointmentId) return;
    const appointment = appointments.find((item) => item.id === invoiceAppointmentId);
    if (!appointment) {
      setNotice({ type: "error", text: "Termin nicht gefunden." });
      return;
    }
    if (appointment.customerId === placeholderCustomerId) {
      setNotice({
        type: "error",
        text: "Bitte dem Termin zuerst eine echte Kundin zuweisen.",
      });
      return;
    }

    const serviceOption = findServiceOption(appointment.service);
    const isIndividual =
      !serviceOption || serviceOption.type === "individual";
    const parsedPrice = parseEuroToCents(invoicePriceEuro);
    const currentPrice = appointment.finalPriceCents || appointment.priceCents;
    let resolvedPrice = currentPrice;

    if (isIndividual) {
      if (!parsedPrice || parsedPrice <= 0) {
        setNotice({
          type: "error",
          text: "Für individuelle Leistungen bitte einen gültigen Preis eintragen.",
        });
        return;
      }
      resolvedPrice = parsedPrice;
    } else if (parsedPrice && parsedPrice > 0) {
      resolvedPrice = parsedPrice;
    } else if (resolvedPrice <= 0 && serviceOption.defaultPriceCents > 0) {
      resolvedPrice = serviceOption.defaultPriceCents;
    }

    if (resolvedPrice <= 0) {
      setNotice({ type: "error", text: "Bitte einen gültigen Preis eintragen." });
      return;
    }

    try {
      setSubmittingInvoice(true);
      if (resolvedPrice !== appointment.priceCents) {
        await apiRequest(`/api/appointments/${appointment.id}`, {
          method: "PUT",
          body: { priceCents: resolvedPrice },
        });
      }

      await apiRequest("/api/invoices", {
        method: "POST",
        body: {
          customerId: appointment.customerId,
          appointmentId: appointment.id,
          paymentMethod: invoicePaymentMethod,
        },
      });

      closeInvoiceDialog();
      setNotice({
        type: "success",
        text: "Rechnung erstellt. Vorschau ist im Rechnungsarchiv verfügbar.",
      });
      await loadData();
    } catch (error) {
      setNotice({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Rechnung konnte nicht erstellt werden.",
      });
    } finally {
      setSubmittingInvoice(false);
    }
  };

const mediaConsentBadge = (allowed: boolean) =>
  allowed
    ? "border-[#a7d5bc] bg-[#e8f8ee] text-[#2d6b49]"
    : "border-[#efc0be] bg-[#fff0ef] text-[#8a3f3b]";

  const selectedIsArchived = Boolean(
    selectedAppointment &&
      (selectedAppointment.isCancelled ||
        selectedAppointment.status === "ERLEDIGT" ||
        selectedAppointment.status === "ABGERECHNET" ||
        selectedAppointment.hasInvoice),
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-hidden">
      <header className="rounded-[28px] border border-[#d5e4df] bg-[linear-gradient(125deg,#ffffff_0%,#f6fbf8_48%,#f8f2f4_100%)] p-5 shadow-[0_14px_32px_rgba(13,80,74,0.11)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-4xl leading-none text-[#173f39]">Termine</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary h-10 px-4"
              onClick={() => router.push("/customers")}
            >
              <Users className="mr-2 size-4" />
              Kundinnen
            </button>
            <div className="relative">
              <button
                type="button"
                className="btn-primary h-10 px-4"
                onClick={() => setCreateMenuOpen((current) => !current)}
              >
                <Plus className="mr-2 size-4" />
                Termin anlegen
                <ChevronDown className="ml-2 size-4" />
              </button>
              {createMenuOpen && (
                <div className="absolute right-0 z-20 mt-2 w-48 rounded-2xl border border-[#cfe2dc] bg-white p-1.5 shadow-xl">
                  <button
                    type="button"
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-[#eef6f3]"
                    onClick={() => openCreate("normal")}
                  >
                    Neuer Termin
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-[#eef6f3]"
                    onClick={() => openCreate("quick")}
                  >
                    Schnelltermin
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <article className="rounded-3xl border border-[#d8e7e1] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 font-serif text-2xl text-[#1a3f39]">
              <CalendarClock className="size-5 text-[#2f5f56]" />
              Diese Woche
            </h2>
            <span className="rounded-full border border-[#d7e6e1] bg-[#f5fbf9] px-3 py-1 text-xs font-semibold text-[#2f5f56]">
              {formatWeekLabel(now)}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-7">
            {weeklyDays.map((day) => {
              const count = day.appointments.length;
              const workloadClass =
                count === 0
                  ? "border-[#e3ece8] bg-white text-slate-600"
                  : count === 1
                    ? "border-[#f1dca7] bg-[#fff8e7] text-[#7f6424]"
                    : count === 2
                      ? "border-[#f0c9a2] bg-[#fff1e5] text-[#8f5124]"
                      : "border-[#efb1ab] bg-[#fff0ef] text-[#8a3f3b]";
              return (
                <div
                  key={day.day.toISOString()}
                  className={`rounded-2xl border px-2 py-2 text-center ${workloadClass}`}
                >
                  <p className="text-[0.67rem] font-semibold uppercase tracking-[0.11em]">
                    {WEEKDAY_LABELS[day.day.getDay() === 0 ? 6 : day.day.getDay() - 1]}
                  </p>
                  <p className="text-sm font-semibold">
                    {String(day.day.getDate()).padStart(2, "0")}
                  </p>
                  <p className="text-[0.67rem]">{count} Termine</p>
                </div>
              );
            })}
          </div>
        </article>

        <div className="grid gap-4">
          <article className="rounded-3xl border border-[#d8e7e1] bg-white p-4 shadow-sm">
            <h2 className="inline-flex items-center gap-2 font-serif text-2xl text-[#1a3f39]">
              <CalendarClock className="size-5 text-[#2f5f56]" />
              Demnächst
            </h2>
            <ul className="mt-3 space-y-2">
              {upcomingAppointments.length === 0 ? (
                <li className="rounded-xl border border-[#e3ece8] bg-[#f8fcfa] px-3 py-2 text-sm text-slate-600">
                  Keine anstehenden Termine.
                </li>
              ) : (
                upcomingAppointments.map((appointment) => (
                  <li
                    key={appointment.id}
                    className="rounded-xl border border-[#e3ece8] bg-[#f8fcfa] px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">
                        {appointment.customerName}
                      </p>
                      <p className="text-xs text-slate-600">
                        {formatDateTime(appointment.startsAt)}
                      </p>
                    </div>
                    <span
                      className={`mt-1 ${getServiceBadgeClass(appointment.service)}`}
                      style={getServiceBadgeStyle(appointment.service)}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={getServiceDotStyle(appointment.service)}
                      />
                      {appointment.service}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </article>

          <button
            type="button"
            onClick={() => setArchiveOpen((current) => !current)}
            className={`rounded-3xl border p-4 text-left shadow-sm transition ${
              archiveSummary.open > 0
                ? "border-[#efc1ba] bg-[#fff3f1] hover:bg-[#ffe9e5]"
                : "border-[#d8e7e1] bg-white hover:bg-[#f8fcfa]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="inline-flex items-center gap-2 font-serif text-2xl text-[#1a3f39]">
                <Archive className="size-5 text-[#2f5f56]" />
                Archiv
              </h3>
              {archiveSummary.open > 0 && (
                <span className="rounded-full bg-[#b94a47] px-2 py-0.5 text-xs font-semibold text-white">
                  {archiveSummary.open} offen
                </span>
               )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full border border-[#d7e6e1] bg-[#f4faf7] px-2 py-0.5 text-[#2f5f56]">
                {archiveSummary.open} offen
              </span>
              <span className="rounded-full border border-[#d7e6e1] bg-[#f4faf7] px-2 py-0.5 text-[#2f5f56]">
                {archiveSummary.billed} abgerechnet
              </span>
              <span className="rounded-full border border-[#d7e6e1] bg-[#f4faf7] px-2 py-0.5 text-[#2f5f56]">
                {archiveSummary.cancelled} storniert
              </span>
            </div>
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input-base w-full pl-9"
            placeholder="Suche nach Kundin, Leistung oder Titel"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </section>

      {notice ? <InlineNotice type={notice.type} text={notice.text} /> : null}

      {isLoading ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Termine werden geladen...
        </section>
      ) : (
        <section className="grid min-h-0 flex-1 gap-5 overflow-hidden xl:grid-cols-[minmax(0,1.7fr)_360px]">
          <div className="min-h-0">
            <div className="overflow-x-auto pb-1" data-testid="appointments-kanban-board">
              <div className="flex min-w-max gap-4">
                {boardColumns.map((column) => (
                  <article
                    key={column.key}
                    data-testid={`kanban-column-${column.key.toLowerCase()}`}
                    className="w-[19rem] shrink-0 rounded-3xl border border-[#d9e8e3] bg-[linear-gradient(180deg,#ffffff_0%,#f8fcfa_100%)] p-3"
                  >
                    <header className="rounded-2xl border border-[#d7e7e1] bg-[#edf6f2] px-3 py-2.5">
                      <h3 className="text-sm font-semibold text-[#163f39]">{column.title}</h3>
                      <p
                        className="text-xs text-slate-600"
                        data-testid={`kanban-column-count-${column.key.toLowerCase()}`}
                      >
                        {column.items.length} Termine
                      </p>
                    </header>
                    <div
                      className="mt-3 max-h-[62vh] space-y-2 overflow-y-auto"
                      data-testid={`kanban-column-body-${column.key.toLowerCase()}`}
                    >
                      {column.items.length === 0 ? (
                        <div className="rounded-xl border border-[#e4ece8] bg-[#f8fcfa] px-3 py-3 text-sm text-slate-500">
                          Keine Termine
                        </div>
                      ) : (
                        column.items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedAppointmentId(item.id)}
                            className={`w-full rounded-2xl border border-l-4 px-3 py-3 text-left ${
                              selectedAppointmentId === item.id
                                ? "border-[#8ec2b5] bg-[#e9f6f1]"
                                : "border-[#e2ece8] bg-white hover:border-[#c6ddd5]"
                            }`}
                            style={{ borderLeftColor: getServiceColor(item.service) }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-800">
                                {item.customerName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatDateTime(item.startsAt)}
                              </p>
                            </div>
                            <span
                              className={`mt-1 ${getServiceBadgeClass(item.service)}`}
                              style={getServiceBadgeStyle(item.service)}
                            >
                              <span
                                className="size-1.5 rounded-full"
                                style={getServiceDotStyle(item.service)}
                              />
                              {item.service}
                            </span>
                            <p className="mt-2 text-xs font-semibold text-[#8d4d5a]">
                              {formatEuroFromCents(item.priceCents)}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <aside className="max-h-[calc(100vh-18rem)] overflow-y-auto rounded-3xl border border-[#d9e8e3] bg-white p-4 shadow-sm">
            <h2 className="inline-flex items-center gap-2 font-serif text-2xl text-[#1a3f39]">
              <CalendarClock className="size-5 text-[#2f5f56]" />
              Termin-Detail
            </h2>
            {!selectedAppointment ? (
              <p className="mt-3 rounded-xl border border-[#e4ece8] bg-[#f8fcfa] px-3 py-3 text-sm text-slate-600">
                Keine Auswahl.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-lg font-semibold text-slate-800">
                  {selectedAppointment.customerName}
                </p>
                <span
                  className={getServiceBadgeClass(selectedAppointment.service)}
                  style={getServiceBadgeStyle(selectedAppointment.service)}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={getServiceDotStyle(selectedAppointment.service)}
                  />
                  {selectedAppointment.service}
                </span>
                <p className="text-sm text-slate-600">
                  {formatDateTime(selectedAppointment.startsAt)}
                </p>
                <p className="text-sm font-semibold text-[#8d4d5a]">
                  {formatEuroFromCents(selectedAppointment.priceCents)}
                </p>
                <div className="rounded-xl border border-[#e4ece8] bg-[#f8fcfa] px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                    Medienfreigabe
                  </p>
                  <span
                    className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] ${mediaConsentBadge(
                      selectedAppointment.customerMediaConsent,
                    )}`}
                  >
                    {selectedAppointment.customerMediaConsent
                      ? "Ja - Fotos/Videos erlaubt"
                      : "Nein - keine Aufnahmen"}
                  </span>
                </div>

                {isSelectedQuickPlaceholder && (
                  <div className="space-y-2 rounded-xl border border-[#f0d7c5] bg-[#fff7f1] p-3">
                    <p className="text-sm font-semibold text-[#7d4b2b]">
                      Schnelltermin ohne Kundin
                    </p>
                    <label className="flex flex-col gap-1 text-sm">
                      <span>Kundin wählen</span>
                      <select
                        className="input-base h-9"
                        value={assignCustomerId}
                        onChange={(event) => setAssignCustomerId(event.target.value)}
                      >
                        <option value="">Bitte auswählen</option>
                        {activeCustomers.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        className="btn-secondary h-9"
                        onClick={() => void assignCustomerToSelected()}
                      >
                        Kundin zuweisen
                      </button>
                      <button
                        type="button"
                        className="btn-secondary h-9"
                        onClick={() => setQuickCustomerOpen(true)}
                      >
                        Kundin erstellen
                      </button>
                    </div>
                  </div>
                 )}

                <label className="flex flex-col gap-1 text-sm">
                  Status
                  <select
                    className="input-base h-9"
                    value={selectedAppointment.status}
                    onChange={(event) => {
                      const nextStatus = event.target.value as AppointmentStatus;
                      if (nextStatus === "ERLEDIGT") {
                        void markAppointmentCompleted(selectedAppointment);
                        return;
                      }
                      void updateAppointmentStatus(selectedAppointment.id, nextStatus);
                    }}
                    disabled={selectedAppointment.hasInvoice}
                  >
                    {selectedAppointment.hasInvoice ? (
                      <option value="ABGERECHNET">Abgerechnet</option>
                    ) : (
                      <>
                        <option value="OFFEN">{APPOINTMENT_STATUS_LABELS.OFFEN}</option>
                        <option value="GEPLANT">{APPOINTMENT_STATUS_LABELS.GEPLANT}</option>
                        <option value="ERLEDIGT">{APPOINTMENT_STATUS_LABELS.ERLEDIGT}</option>
                      </>
                    )}
                  </select>
                </label>

                <button
                  type="button"
                  className="btn-secondary h-9 w-full"
                  onClick={() => openEdit(selectedAppointment)}
                >
                  Bearbeiten
                </button>
                {selectedIsQuickAppointment && (
                  <button
                    type="button"
                    className="btn-secondary h-9 w-full border-[#efc7cb] bg-[#fff6f7] text-[#8f3b45] hover:bg-[#ffecee]"
                    onClick={() => void deleteQuickAppointment(selectedAppointment)}
                    disabled={
                      selectedAppointment.hasInvoice ||
                      deletingQuickAppointmentId === selectedAppointment.id
                    }
                  >
                    {deletingQuickAppointmentId === selectedAppointment.id ? "Lösche Schnelltermin..." : "Schnelltermin löschen"}
                  </button>
                 )}
                {!selectedIsArchived && (
                  <>
                    <button
                      type="button"
                      className="btn-secondary h-9 w-full"
                      onClick={() => void markAppointmentCompleted(selectedAppointment)}
                    >
                      <CheckCircle2 className="mr-1 size-4" />
                      Als erledigt archivieren
                    </button>
                    <button
                      type="button"
                      className="btn-secondary h-9 w-full"
                      onClick={() => void cancelAppointment(selectedAppointment)}
                      disabled={selectedAppointment.hasInvoice}
                    >
                      Stornieren
                    </button>
                  </>
                 )}
                {selectedAppointment.status === "ERLEDIGT" &&
                !selectedAppointment.hasInvoice &&
                !selectedAppointment.isCancelled && (
                  <button
                    type="button"
                    className="btn-secondary h-9 w-full"
                    onClick={() => openInvoiceDialog(selectedAppointment)}
                  >
                    <CircleDollarSign className="mr-1 size-4" />
                    Rechnung erstellen
                  </button>
                 )}
              </div>
            )}
          </aside>
        </section>
      )}

      {archiveOpen && (
        <section className="flex max-h-[36vh] min-h-0 flex-col space-y-3 overflow-hidden rounded-3xl border border-[#d9e8e3] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="inline-flex items-center gap-2 font-serif text-2xl text-[#1a3f39]">
              <Archive className="size-5 text-[#2f5f56]" />
              Archiv
            </h2>
          </div>

          <div className="grid gap-2 md:grid-cols-5">
            <label className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input-base w-full pl-9"
                placeholder="Suche im Archiv"
                value={archiveSearch}
                onChange={(event) => setArchiveSearch(event.target.value)}
              />
            </label>
            <select
              className="input-base h-10"
              value={archiveCustomerId}
              onChange={(event) => setArchiveCustomerId(event.target.value)}
            >
              <option value="">Alle Kundinnen</option>
              {activeCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            <select
              className="input-base h-10"
              value={archiveStatus}
              onChange={(event) =>
                setArchiveStatus(event.target.value as ArchiveStatusFilter)
              }
            >
              {Object.entries(STATUS_ORDER).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                className="input-base h-10"
                value={archiveDateFrom}
                onChange={(event) => setArchiveDateFrom(event.target.value)}
              />
              <input
                type="date"
                className="input-base h-10"
                value={archiveDateTo}
                onChange={(event) => setArchiveDateTo(event.target.value)}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                  <th className="py-2 pr-3">Termin</th>
                  <th className="py-2 pr-3">Kundin</th>
                  <th className="py-2 pr-3">Leistung</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Preis</th>
                  <th className="py-2 text-right">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredArchiveAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-500">
                      Keine Archivtreffer.
                    </td>
                  </tr>
                ) : (
                  filteredArchiveAppointments.map((appointment) => (
                    <tr
                      key={appointment.id}
                      className="hover:bg-[#f8fcfa]"
                      onClick={() => setSelectedAppointmentId(appointment.id)}
                    >
                      <td className="py-2 pr-3 text-slate-700">
                        {formatDateTime(appointment.startsAt)}
                      </td>
                      <td className="py-2 pr-3 font-medium text-slate-800">
                        {appointment.customerName}
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{appointment.service}</td>
                      <td className="py-2 pr-3">
                        <span className="inline-flex rounded-full border border-[#d7e6e1] bg-[#f4faf7] px-2 py-0.5 text-xs font-semibold text-[#2f5f56]">
                          {toArchiveStatus(appointment) === "STORNIERT"
                            ? "Storniert"
                            : toArchiveStatus(appointment) === "ABGERECHNET"
                              ? "Abgerechnet"
                              : "Erledigt"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-700">
                        {formatEuroFromCents(appointment.priceCents)}
                      </td>
                      <td className="py-2 text-right">
                        {appointment.status === "ERLEDIGT" &&
                        !appointment.hasInvoice &&
                        !appointment.isCancelled ? (
                          <button
                            type="button"
                            className="btn-secondary h-8 px-3"
                            onClick={(event) => {
                              event.stopPropagation();
                              openInvoiceDialog(appointment);
                            }}
                          >
                            Rechnung erstellen
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary h-8 px-3"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEdit(appointment);
                            }}
                          >
                            Bearbeiten
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
       )}

      {formOpen && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/25 px-3">
          <section className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-serif text-2xl text-[#1a3f39]">
                {form.id
                  ? "Termin bearbeiten"
                  : creationMode === "quick"
                    ? "Schnelltermin anlegen"
                    : "Neuer Termin"}
              </h2>
              <span className="rounded-full border border-[#d7e6e1] bg-[#f4faf7] px-2 py-0.5 text-xs font-semibold text-[#2f5f56]">
                {creationMode === "quick" ? "Schnelltermin" : "Normal"}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                Titel (optional)
                <input
                  className="input-base"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="z. B. Blocker, Beratung, Erstkontakt"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                Kundin suchen
                <input
                  className="input-base"
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  placeholder="Name, E-Mail, Telefon"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                Kundin
                <select
                  className="input-base"
                  value={form.customerId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, customerId: event.target.value }))
                  }
                  disabled={form.hasInvoice}
                >
                  <option value="">
                    {creationMode === "quick"
                      ? "Keine Kundin zugewiesen"
                      : "Bitte auswählen"}
                  </option>
                  {customerOptions.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>

              {selectedFormCustomer && selectedFormCustomer.cancellationCount > 0 && (
                <p className="sm:col-span-2 rounded-xl border border-[#f1d4c4] bg-[#fff4ec] px-3 py-2 text-sm text-[#7a4a2a]">
                  {selectedFormCustomer.cancellationCount}x storniert
                </p>
               )}

              <label className="flex flex-col gap-1 text-sm">
                Datum & Uhrzeit
                <input
                  type="datetime-local"
                  className="input-base"
                  value={form.startsAt}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, startsAt: event.target.value }))
                  }
                  disabled={form.hasInvoice}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                Preis (EUR)
                <input
                  className="input-base"
                  value={form.priceEuro}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, priceEuro: event.target.value }))
                  }
                  placeholder={creationMode === "quick" ? "optional" : ""}
                  disabled={form.hasInvoice}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                Leistung
                <select
                  className="input-base"
                  value={form.service}
                  onChange={(event) => setServiceValue(event.target.value)}
                  disabled={form.hasInvoice}
                >
                  {creationMode === "quick" && (
                    <option value={QUICK_SERVICE_VALUE}>Schnelltermin</option>
                   )}
                  {serviceOptions
                    .filter((option) =>
                      creationMode === "quick"
                        ? option.type !== "quick"
                        : option.value !== QUICK_SERVICE_VALUE,
                    )
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.value}
                      </option>
                    ))}
                </select>
              </label>

              {form.service === "Individuell" && (
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  Individuelle Leistung
                  <input
                    className="input-base"
                    value={form.customServiceText}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        customServiceText: event.target.value,
                      }))
                    }
                    placeholder="z. B. Modell, Kulanz, Korrektur"
                    disabled={form.hasInvoice}
                  />
                </label>
               )}

              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                Notiz (optional)
                <textarea
                  className="textarea-base min-h-24"
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />
              </label>

              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                Status
                <select
                  className="input-base"
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as AppointmentStatus,
                    }))
                  }
                  disabled={form.hasInvoice}
                >
                  {form.hasInvoice ? (
                    <option value="ABGERECHNET">Abgerechnet</option>
                  ) : (
                    <>
                      <option value="OFFEN">Offen</option>
                      <option value="GEPLANT">Geplant</option>
                      <option value="ERLEDIGT">Erledigt</option>
                    </>
                  )}
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={closeForm}>
                Schließen
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void submitForm()}
                disabled={submittingForm}
              >
                {submittingForm ? "Speichern..." : "Termin speichern"}
              </button>
            </div>
          </section>
        </div>
       )}

      {quickCustomerOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/35 px-3">
          <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="font-serif text-2xl text-[#1a3f39]">Kundin erstellen</h3>
            <div className="mt-3 space-y-2">
              <label className="flex flex-col gap-1 text-sm">
                Name
                <input
                  className="input-base"
                  value={quickCustomerForm.name}
                  onChange={(event) =>
                    setQuickCustomerForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Telefon
                <input
                  className="input-base"
                  value={quickCustomerForm.phone}
                  onChange={(event) =>
                    setQuickCustomerForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                E-Mail
                <input
                  className="input-base"
                  value={quickCustomerForm.email}
                  onChange={(event) =>
                    setQuickCustomerForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setQuickCustomerOpen(false)}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void createCustomerForSelected()}
                disabled={creatingQuickCustomer}
              >
                {creatingQuickCustomer ? "Speichern..." : "Kundin speichern"}
              </button>
            </div>
          </section>
        </div>
       )}

      {invoiceDialogOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/35 px-3">
          <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="font-serif text-2xl text-[#1a3f39]">
              Rechnung aus Archivtermin
            </h3>
            <div className="mt-3 space-y-3">
              <label className="flex flex-col gap-1 text-sm">
                Zahlungsart
                <select
                  className="input-base"
                  value={invoicePaymentMethod}
                  onChange={(event) =>
                    setInvoicePaymentMethod(event.target.value as PaymentMethod)
                  }
                >
                  {PAYMENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Preis (EUR)
                <input
                  className="input-base"
                  value={invoicePriceEuro}
                  onChange={(event) => setInvoicePriceEuro(event.target.value)}
                />
              </label>
              <p className="rounded-xl border border-[#dce8e3] bg-[#f7fcfa] px-3 py-2 text-sm text-slate-700">
                Für Preset-Leistungen wird ein Standardpreis verwendet, falls kein Preis
                hinterlegt ist. Für individuelle Leistungen ist ein manueller Preis
                erforderlich.
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeInvoiceDialog}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void submitInvoiceFromArchive()}
                disabled={submittingInvoice}
              >
                {submittingInvoice ? "Erstelle..." : "Rechnung erstellen"}
              </button>
            </div>
          </section>
        </div>
       )}

      {createMenuOpen && (
        <button
          type="button"
          aria-label="Menü schließen"
          className="fixed inset-0 z-10 cursor-default bg-transparent"
          onClick={() => setCreateMenuOpen(false)}
        />
       )}
    </div>
  );
}



