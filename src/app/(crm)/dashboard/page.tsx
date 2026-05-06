"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  ArrowRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Coins,
  HandCoins,
  Plus,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import { InlineNotice } from "@/components/inline-notice";
import {
  getServiceBadgeClass,
  getServiceBadgeStyle,
  getServiceDotStyle,
} from "@/lib/appointment-services";
import { apiRequest } from "@/lib/client-api";
import { formatEuroFromCents } from "@/lib/currency";
import { formatDateTime } from "@/lib/datetime";
import type { AppointmentDTO, DashboardPayload, InvoiceDTO } from "@/types/crm";

type WeeklyDay = {
  day: Date;
  key: string;
  appointments: AppointmentDTO[];
};

type MonthlyCell = {
  day: Date;
  key: string;
  appointments: AppointmentDTO[];
};

type ServiceMarkerKey = "refill" | "neuset11" | "volumenset" | "individuell";

const SERVICE_MARKERS: Record<ServiceMarkerKey, { label: string; color: string }> = {
  refill: { label: "Refill", color: "#4FC3F7" },
  neuset11: { label: "Neuset 1:1", color: "#0F766E" },
  volumenset: { label: "Volumenset", color: "#7C3AED" },
  individuell: { label: "Individuell", color: "#9CA3AF" },
};

function toDayKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function getWeekdayLabel(date: Date) {
  const labels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const dayIndex = date.getDay();
  return labels[dayIndex === 0 ? 6 : dayIndex - 1];
}

function formatWeekRangeLabel(weekStart: Date) {
  const weekEnd = addDays(weekStart, 6);
  return `Woche vom ${format(weekStart, "dd.MM.")}\u2013${format(weekEnd, "dd.MM.")}`;
}

function getServiceMarkerKey(service: string): ServiceMarkerKey {
  const normalized = service.trim().toLowerCase();
  if (normalized.includes("refill")) return "refill";
  if (normalized.includes("neuset") || normalized.includes("1:1")) return "neuset11";
  if (normalized.includes("volumen") || normalized.includes("volume")) return "volumenset";
  return "individuell";
}

export default function DashboardPage() {
  const router = useRouter();

  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [appointments, setAppointments] = useState<AppointmentDTO[]>([]);
  const [openInvoices, setOpenInvoices] = useState<InvoiceDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [visibleMonthStart, setVisibleMonthStart] = useState(() => startOfMonth(new Date()));

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const [dashboardData, appointmentsData, openInvoiceData] = await Promise.all([
          apiRequest<DashboardPayload>("/api/dashboard"),
          apiRequest<AppointmentDTO[]>("/api/appointments?includeCancelled=true"),
          apiRequest<InvoiceDTO[]>("/api/invoices?status=OFFEN"),
        ]);
        setDashboard(dashboardData);
        setAppointments(appointmentsData);
        setOpenInvoices(openInvoiceData);
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Dashboard konnte nicht geladen werden.");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const today = useMemo(() => new Date(), []);

  const activeAppointments = useMemo(
    () =>
      appointments
        .filter((item) => !item.isCancelled)
        .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()),
    [appointments],
  );

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, AppointmentDTO[]>();
    for (const appointment of activeAppointments) {
      const key = toDayKey(new Date(appointment.startsAt));
      const current = map.get(key) ?? [];
      current.push(appointment);
      map.set(key, current);
    }
    return map;
  }, [activeAppointments]);

  const selectedDayKey = useMemo(() => toDayKey(selectedDate), [selectedDate]);
  const selectedWeekStart = useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 1 }), [selectedDate]);

  const weeklyDays = useMemo<WeeklyDay[]>(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDays(selectedWeekStart, index);
      const key = toDayKey(day);
      return {
        day,
        key,
        appointments: appointmentsByDay.get(key) ?? [],
      };
    });
  }, [appointmentsByDay, selectedWeekStart]);

  const weeklyAppointments = useMemo(
    () =>
      weeklyDays
        .flatMap((day) => day.appointments)
        .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()),
    [weeklyDays],
  );

  const weeklyServiceSummary = useMemo(() => {
    const initial: Record<ServiceMarkerKey, number> = {
      refill: 0,
      neuset11: 0,
      volumenset: 0,
      individuell: 0,
    };
    for (const appointment of weeklyAppointments) {
      const marker = getServiceMarkerKey(appointment.service);
      initial[marker] += 1;
    }
    return initial;
  }, [weeklyAppointments]);

  const weeklyServiceEntries = useMemo(
    () =>
      (Object.keys(SERVICE_MARKERS) as ServiceMarkerKey[]).map((key) => ({
        key,
        label: SERVICE_MARKERS[key].label,
        color: SERVICE_MARKERS[key].color,
        count: weeklyServiceSummary[key],
      })),
    [weeklyServiceSummary],
  );

  const selectedDayAppointments = useMemo(
    () => [...(appointmentsByDay.get(selectedDayKey) ?? [])].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [appointmentsByDay, selectedDayKey],
  );

  const selectedDayServiceSummary = useMemo(() => {
    const initial: Record<ServiceMarkerKey, number> = {
      refill: 0,
      neuset11: 0,
      volumenset: 0,
      individuell: 0,
    };
    for (const appointment of selectedDayAppointments) {
      const marker = getServiceMarkerKey(appointment.service);
      initial[marker] += 1;
    }
    return initial;
  }, [selectedDayAppointments]);

  const selectedDayServiceEntries = useMemo(
    () =>
      (Object.keys(SERVICE_MARKERS) as ServiceMarkerKey[])
        .map((key) => ({
          key,
          label: SERVICE_MARKERS[key].label,
          color: SERVICE_MARKERS[key].color,
          count: selectedDayServiceSummary[key],
        }))
        .filter((entry) => entry.count > 0),
    [selectedDayServiceSummary],
  );

  const monthlyCells = useMemo<MonthlyCell[]>(() => {
    const monthStart = startOfMonth(visibleMonthStart);
    const monthEnd = endOfMonth(visibleMonthStart);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd }).map((day) => {
      const key = toDayKey(day);
      return {
        day,
        key,
        appointments: appointmentsByDay.get(key) ?? [],
      };
    });
  }, [appointmentsByDay, visibleMonthStart]);

  const todayAppointments = useMemo(() => appointmentsByDay.get(toDayKey(today)) ?? [], [appointmentsByDay, today]);

  const openInvoiceAmountCents = useMemo(
    () => openInvoices.reduce((sum, invoice) => sum + invoice.amountCents, 0),
    [openInvoices],
  );

  const thisMonthRevenueCents = useMemo(
    () => dashboard?.chartSeries.revenueByMonth[dashboard.chartSeries.revenueByMonth.length - 1]?.valueCents ?? 0,
    [dashboard],
  );

  const cardClass =
    "rounded-[26px] border border-[#adc6bd] bg-[linear-gradient(180deg,#ffffff_0%,#f8fcfa_100%)] p-5 shadow-[0_18px_34px_rgba(10,58,53,0.18)]";
  const cardHeadingClass = "inline-flex items-center gap-2 font-serif text-[1.88rem] leading-none text-[#0d312c]";
  const sectionLinkClass =
    "inline-flex items-center gap-1 rounded-full border border-[#b8d1c9] bg-[#deeee8] px-2.5 py-1 text-[0.63rem] font-semibold uppercase tracking-[0.14em] text-[#1f4c43] transition hover:border-[#9fbeb4] hover:bg-[#cfe5dd] hover:text-[#123a33]";
  const emptyStateClass = "rounded-2xl border border-[#bfd5cd] bg-[#e4f1ec] px-4 py-3 text-sm font-medium text-[#2f524a]";
  const quickActionButtonClass =
    "group flex h-16 items-center justify-between rounded-2xl border border-[#2e6158]/20 bg-white/95 px-4 text-left shadow-[0_10px_22px_rgba(8,38,34,0.2)] transition hover:-translate-y-0.5 hover:border-[#f0d3da]/60 hover:bg-white hover:shadow-[0_16px_28px_rgba(8,38,34,0.28)]";

  const getDayDensityClass = (appointmentCount: number) => {
    if (appointmentCount >= 3) return "border-[#e9c5c2] bg-[#fcf2f1] text-[#8f3129]";
    if (appointmentCount === 2) return "border-[#ecd8c1] bg-[#fdf7ee] text-[#9a5f2d]";
    if (appointmentCount === 1) return "border-[#ebe2c2] bg-[#fcf9f0] text-[#886e2a]";
    return "border-[#c8d8d2] bg-[#f1f7f4] text-[#335a52]";
  };

  const selectDate = (day: Date) => {
    setSelectedDate(day);
    setVisibleMonthStart(startOfMonth(day));
  };

  const followUpRows = dashboard?.followUps.filter((entry) => entry.status !== "AKTIV") ?? [];

  return (
    <div className="h-full min-h-0 space-y-6 overflow-y-auto pr-1">
      <section className="rounded-[30px] border border-[#abc5bc] bg-[linear-gradient(127deg,#ffffff_0%,#d7ebe3_54%,#eacfd7_100%)] p-6 shadow-[0_26px_48px_rgba(10,59,54,0.24)]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#d8adb8] bg-[#f4e0e6] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#7c3f4d]">
              <Sparkles className="size-3.5" />
              Studio-Übersicht
            </p>
            <h1 className="mt-3 font-serif text-[2.95rem] leading-[0.93] text-[#0b2d28]">Dashboard</h1>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <span className="rounded-full border border-[#adc9c0] bg-white px-3 py-1 text-xs font-semibold text-[#143f37] shadow-[0_7px_14px_rgba(9,61,55,0.15)]">
                {todayAppointments.length} Termine heute
              </span>
              <span className="rounded-full border border-[#adc9c0] bg-white px-3 py-1 text-xs font-semibold text-[#143f37] shadow-[0_7px_14px_rgba(9,61,55,0.15)]">
                {openInvoices.length} offene Rechnungen
              </span>
              <span className="rounded-full border border-[#d8bac2] bg-[#fff9fb] px-3 py-1 text-xs font-semibold text-[#733f4c] shadow-[0_7px_14px_rgba(136,73,86,0.18)]">
                Offen: {formatEuroFromCents(openInvoiceAmountCents)}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-[#1f4c43]/35 bg-[linear-gradient(155deg,#1f4d44_0%,#123a34_100%)] px-4 py-3 shadow-[0_14px_26px_rgba(8,43,38,0.35)]">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#c9dfd7]">Schnellzugriff</p>
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="h-10 rounded-xl border border-white/25 bg-white/10 px-3.5 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-white/18"
                onClick={() => router.push("/appointments")}
              >
                Termine
              </button>
              <button
                type="button"
                className="h-10 rounded-xl border border-white/25 bg-white/10 px-3.5 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-white/18"
                onClick={() => router.push("/customers")}
              >
                Kundinnen
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#f1d7de] px-4 text-sm font-semibold text-[#4f2530] shadow-[0_12px_22px_rgba(8,43,38,0.3)] transition hover:bg-[#ebc6d1]"
                onClick={() => router.push("/appointments")}
              >
                <Plus className="mr-1 size-4" />
                Neuer Termin
              </button>
            </div>
          </div>
        </div>
      </section>

      {error ? <InlineNotice type="error" text={error} /> : null}

      {isLoading ? (
        <section className="rounded-[26px] border border-[#d4e2dd] bg-[linear-gradient(180deg,#ffffff_0%,#f6fbf9_100%)] p-6 text-sm font-medium text-[#486660] shadow-[0_12px_24px_rgba(13,80,74,0.11)]">
          Studio-Daten werden geladen...
        </section>
      ) : null}

      {!isLoading && dashboard ? (
        <>
          <section className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" data-testid="dashboard-planning-grid">
            <div className="space-y-5 xl:grid xl:grid-rows-[auto_1fr] xl:space-y-0 xl:gap-5" data-testid="dashboard-weekly-column">
              <article className={cardClass} data-testid="dashboard-weekly-planner">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className={cardHeadingClass}>
                    <CalendarClock className="size-5 text-[#2f5f56]" />
                    Wochenplanung
                  </h2>
                  <button
                    type="button"
                    className={sectionLinkClass}
                    onClick={() => router.push("/appointments")}
                  >
                    Alle Termine öffnen
                  </button>
                </div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#4f7269]" data-testid="dashboard-week-range">
                  {formatWeekRangeLabel(selectedWeekStart)}
                </p>
                <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-[#5b7a72]">
                  Ausgewählter Tag: {format(selectedDate, "dd.MM.yyyy")}
                </p>
                <div className="grid gap-2 sm:grid-cols-7">
                  {weeklyDays.map((entry) => {
                    const isSelected = isSameDay(entry.day, selectedDate);
                    return (
                      <button
                        key={entry.key}
                        type="button"
                        onClick={() => selectDate(entry.day)}
                        className={`rounded-xl border px-2 py-2 text-left transition ${getDayDensityClass(entry.appointments.length)} ${
                          isSelected
                            ? "border-[#2d7066] ring-2 ring-[#0f5a55]/60 ring-offset-1 ring-offset-[#f8fcfa] shadow-[inset_0_0_0_1px_rgba(15,90,85,0.26),0_0_0_1px_rgba(15,90,85,0.14)]"
                            : ""
                        }`}
                        title={`${format(entry.day, "EEEE")} - ${entry.appointments.length} Termine`}
                      >
                        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]">{getWeekdayLabel(entry.day)}</p>
                        <p className="mt-0.5 text-sm font-semibold">{format(entry.day, "dd.MM")}</p>
                        <p className="mt-1 text-[0.62rem] font-medium">
                          {entry.appointments.length} Termin{entry.appointments.length === 1 ? "" : "e"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </article>

              <article className={`${cardClass} flex h-full flex-col xl:min-h-[420px]`} data-testid="dashboard-weekly-customers">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className={cardHeadingClass}>
                    <Users className="size-5 text-[#2f5f56]" />
                    Nächste Kundinnen (Woche)
                  </h2>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4f7269]">
                    {weeklyAppointments.length} Termine
                  </p>
                </div>
                <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[#5b7a72]">
                  {formatWeekRangeLabel(selectedWeekStart)}
                </p>

                {weeklyAppointments.length > 0 ? (
                  <>
                    <ul className="max-h-[225px] space-y-1.5 overflow-y-auto pr-1">
                      {weeklyAppointments.slice(0, 8).map((appointment) => (
                        <li
                          key={appointment.id}
                          data-starts-at={appointment.startsAt}
                          className={`rounded-lg border border-[#c2d8d0] bg-white px-2.5 py-1.5 shadow-[0_6px_10px_rgba(10,58,53,0.08)] ${
                            isSameDay(new Date(appointment.startsAt), selectedDate)
                              ? "border-[#8fb8ad] bg-[#f2f9f6]"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[0.84rem] font-semibold text-[#153f37]">{appointment.customerName}</p>
                            <p className="text-[0.68rem] font-semibold text-[#476860]">{formatDateTime(appointment.startsAt)}</p>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <span className={getServiceBadgeClass(appointment.service)} style={getServiceBadgeStyle(appointment.service)}>
                              <span className="size-1.5 rounded-full" style={getServiceDotStyle(appointment.service)} />
                              {appointment.service}
                            </span>
                            <span className="text-[0.55rem] font-semibold uppercase tracking-[0.1em] text-[#55756d]">
                              {appointment.status}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="mt-3 inline-flex h-10 items-center justify-center rounded-xl border border-[#b8d1c9] bg-[#edf6f2] px-4 text-sm font-semibold text-[#1f4e45] transition hover:border-[#9fbeb4] hover:bg-[#dceee7]"
                      onClick={() => router.push("/appointments")}
                    >
                      Alle Termine der Woche anzeigen
                      <ArrowRight className="ml-1 size-4" />
                    </button>
                  </>
                ) : (
                  <p className={emptyStateClass}>Keine Termine in der ausgewählten Woche.</p>
                )}

                <div className="mt-auto border-t border-[#d6e4df] pt-3.5">
                  <div className="rounded-xl border border-[#cfdfd9] bg-[#f7fcfa] px-3 py-2.5" data-testid="dashboard-weekly-service-summary">
                    <p className="text-[0.72rem] font-semibold text-[#44695f]">
                      Leistungsübersicht der Woche
                    </p>
                    <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {weeklyServiceEntries.map((entry) => (
                        <li
                          key={entry.key}
                          className="inline-flex items-center justify-between rounded-md border border-[#d7e4df] bg-white/90 px-2 py-1 text-[0.69rem] font-semibold text-[#2d5750]"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                            {entry.label}
                          </span>
                          <span className="text-[#476860]">{entry.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            </div>

            <article className={`${cardClass} h-full`} data-testid="dashboard-monthly-planner">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className={cardHeadingClass}>
                  <CalendarClock className="size-5 text-[#2f5f56]" />
                  Monatsplanung
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#b8d1c9] bg-[#edf6f2] text-[#1f4e45] transition hover:border-[#9fbeb4] hover:bg-[#dceee7]"
                    onClick={() => setVisibleMonthStart((current) => startOfMonth(subMonths(current, 1)))}
                    aria-label="Vorheriger Monat"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <p className="min-w-[130px] text-center text-sm font-semibold text-[#1f4e45]">{format(visibleMonthStart, "MMMM yyyy")}</p>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#b8d1c9] bg-[#edf6f2] text-[#1f4e45] transition hover:border-[#9fbeb4] hover:bg-[#dceee7]"
                    onClick={() => setVisibleMonthStart((current) => startOfMonth(addMonths(current, 1)))}
                    aria-label="Nächster Monat"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center rounded-lg border border-[#b8d1c9] bg-[#edf6f2] px-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#1f4e45] transition hover:border-[#9fbeb4] hover:bg-[#dceee7]"
                    onClick={() => selectDate(new Date())}
                  >
                    Heute
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((weekday) => (
                  <p key={weekday} className="text-center text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#5b7a72]">
                    {weekday}
                  </p>
                ))}

                {monthlyCells.map((cell) => {
                  const inCurrentMonth = isSameMonth(cell.day, visibleMonthStart);
                  const isSelected = isSameDay(cell.day, selectedDate);
                  const isTodayCell = isSameDay(cell.day, today);
                  const markers = cell.appointments.map((appointment) => getServiceMarkerKey(appointment.service));

                  return (
                    <button
                      key={cell.key}
                      type="button"
                      data-day-key={cell.key}
                      aria-label={`Kalendertag ${format(cell.day, "dd.MM.yyyy")}`}
                      onClick={() => selectDate(cell.day)}
                      className={`flex min-h-[74px] flex-col justify-between rounded-xl border px-2 py-2 text-left transition ${
                        inCurrentMonth ? "border-[#d2e1db] bg-[#f8fcfa]" : "border-[#e3ece8] bg-[#f4f8f6] text-[#8ca29b]"
                      } ${
                        isSelected
                          ? "border-[#3c7b70] bg-[#e7f3ef] ring-2 ring-[#1f5f54]/40 shadow-[inset_0_0_0_1px_rgba(18,79,70,0.22)]"
                          : "hover:border-[#bad0c8] hover:bg-[#f2f8f5]"
                      }`}
                    >
                      <p
                        className={`text-sm font-semibold ${isTodayCell ? "text-[#0f5a55]" : "text-[#244d45]"} ${!inCurrentMonth ? "opacity-60" : ""}`}
                      >
                        {format(cell.day, "d")}
                      </p>
                      <div className="flex min-h-[16px] flex-wrap items-center gap-1 pb-0.5">
                        {markers.map((marker, index) => (
                          <span
                            key={`${cell.key}-${marker}-${index}`}
                            className="size-1.5 rounded-full"
                            style={{ backgroundColor: SERVICE_MARKERS[marker].color }}
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap gap-3 rounded-xl border border-[#c9dad4] bg-[#f6fbf9] px-3 py-2.5">
                {(Object.keys(SERVICE_MARKERS) as ServiceMarkerKey[]).map((key) => (
                  <div
                    key={key}
                    className="inline-flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[#466b63]"
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: SERVICE_MARKERS[key].color }} />
                    {SERVICE_MARKERS[key].label}
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-[#c9dad4] bg-[#f6fbf9] p-3" data-testid="dashboard-day-detail">
                <h3 className="text-[0.95rem] font-semibold text-[#1a433b]">
                  Termine am {format(selectedDate, "dd.MM.yyyy")}
                </h3>

                {selectedDayAppointments.length > 0 ? (
                  <>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {selectedDayServiceEntries.map((entry) => (
                        <span
                          key={entry.key}
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.08em]"
                          style={{
                            borderColor: `${entry.color}66`,
                            backgroundColor: `${entry.color}14`,
                            color: entry.color,
                          }}
                        >
                          <span className="size-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                          {entry.label}: {entry.count}
                        </span>
                      ))}
                    </div>

                    <ul className="mt-2.5 max-h-[172px] space-y-1.5 overflow-y-auto pr-1">
                      {selectedDayAppointments.map((appointment) => (
                        <li key={appointment.id} className="rounded-lg border border-[#d1e0da] bg-white px-2.5 py-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[0.84rem] font-semibold text-[#133a33]">{appointment.customerName}</p>
                            <p className="text-[0.68rem] font-semibold text-[#1e4a41]">{formatDateTime(appointment.startsAt)}</p>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <span className={getServiceBadgeClass(appointment.service)} style={getServiceBadgeStyle(appointment.service)}>
                              <span className="size-1.5 rounded-full" style={getServiceDotStyle(appointment.service)} />
                              {appointment.service}
                            </span>
                            <span className="text-[0.55rem] font-semibold uppercase tracking-[0.1em] text-[#476860]">
                              {appointment.status}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className={`mt-3 ${emptyStateClass}`}>Keine Termine an diesem Tag.</p>
                )}
              </div>
            </article>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
            <article className={cardClass}>
              <h2 className={cardHeadingClass}>
                <Wallet className="size-5 text-[#2f5f56]" />
                Finanz-Snapshot
              </h2>
              <div className="mt-4 space-y-2.5">
                <div className="rounded-xl border border-[#b9d1c8] bg-[#e3f1ec] px-3.5 py-2.5">
                  <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#4f7269]">Abgeschlossener Umsatz</p>
                  <p className="mt-1 text-xl font-semibold text-[#103b34]">{formatEuroFromCents(dashboard.metrics.completedRevenueCents)}</p>
                </div>
                <div className="rounded-xl border border-[#c4d7d0] bg-[#f3faf7] px-3.5 py-2.5">
                  <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#4f7269]">Offene Rechnungen</p>
                  <p className="mt-1 text-xl font-semibold text-[#103b34]">{dashboard.metrics.invoicesOpen}</p>
                </div>
                <div className="rounded-xl border border-[#d9bfc7] bg-[#f8e9ee] px-3.5 py-2.5">
                  <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#764f5a]">Offener Betrag</p>
                  <p className="mt-1 text-xl font-semibold text-[#6a3b48]">{formatEuroFromCents(openInvoiceAmountCents)}</p>
                </div>
                <div className="rounded-xl border border-[#c4d7d0] bg-[#f3faf7] px-3.5 py-2.5">
                  <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#4f7269]">Monat aktuell</p>
                  <p className="mt-1 text-xl font-semibold text-[#103b34]">{formatEuroFromCents(thisMonthRevenueCents)}</p>
                </div>
              </div>
            </article>

            <article className={cardClass}>
              <h2 className={cardHeadingClass}>
                <HandCoins className="size-5 text-[#2f5f56]" />
                Offene Rechnungen
              </h2>
              {openInvoices.length === 0 ? (
                <p className={`mt-4 ${emptyStateClass}`}>Keine offenen Rechnungen.</p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {openInvoices.slice(0, 5).map((invoice) => (
                    <li key={invoice.id} className="rounded-2xl border border-[#bfd4cc] bg-white px-4 py-3 shadow-[0_10px_18px_rgba(10,58,53,0.1)]">
                      <p className="text-sm font-semibold text-[#1c433b]">{invoice.invoiceNumber}</p>
                      <p className="text-xs text-[#4f7269]">{invoice.customerName}</p>
                      <p className="mt-1.5 text-xs font-semibold text-[#7e4552]">{formatEuroFromCents(invoice.amountCents)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>

          <section className={cardClass} data-testid="dashboard-follow-up-list">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className={cardHeadingClass}>
                <Users className="size-5 text-[#2f5f56]" />
                Kundinnen zur Nachfassung
              </h2>
              <button
                type="button"
                className={sectionLinkClass}
                onClick={() => router.push("/customers")}
              >
                Kundinnen öffnen
              </button>
            </div>
            {followUpRows.length === 0 ? (
              <p className={emptyStateClass}>Keine überfälligen Nachfassungen.</p>
            ) : (
              <ul className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                {followUpRows.map((entry) => (
                  <li
                    key={entry.customerId}
                    className="rounded-xl border border-[#d1e0da] bg-white px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#153f37]">{entry.customerName}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${
                          entry.status === "UEBERFAELLIG"
                            ? "border border-[#f1d4c4] bg-[#fff4ec] text-[#7a4a2a]"
                            : "border border-[#e7cdd3] bg-[#fff4f6] text-[#7b4450]"
                        }`}
                      >
                        {entry.status === "UEBERFAELLIG" ? "überfällig" : "inaktiv"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#4f7269]">
                      Letzter Termin:{" "}
                      {entry.lastAppointmentAt
                        ? format(new Date(entry.lastAppointmentAt), "dd.MM.yyyy")
                        : "kein Termin"}
                    </p>
                    <p className="text-xs text-[#4f7269]">
                      Refill-Vorschlag:{" "}
                      {entry.suggestedRefillDate
                        ? format(new Date(entry.suggestedRefillDate), "dd.MM.yyyy")
                        : "sofort möglich"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[28px] border border-[#204d44]/25 bg-[linear-gradient(138deg,#1c4e45_0%,#113a34_100%)] p-5 shadow-[0_20px_34px_rgba(8,43,38,0.34)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="inline-flex items-center gap-2 font-serif text-[1.82rem] leading-none text-[#f3faf7]">
                <Coins className="size-5 text-[#f3dce3]" />
                Schnellaktionen
              </h2>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              <button type="button" className={quickActionButtonClass} onClick={() => router.push("/appointments")}>
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-lg bg-[#e3f2ec] text-[#184b42]"><CalendarClock className="size-4" /></span>
                  <div><p className="text-sm font-semibold text-[#1a433b]">Terminplanung</p><p className="text-[0.68rem] font-medium text-[#51756c]">Tagesansicht öffnen</p></div>
                </div>
                <ArrowRight className="size-4 text-[#1e4e45] transition group-hover:translate-x-0.5" />
              </button>
              <button type="button" className={quickActionButtonClass} onClick={() => router.push("/customers")}>
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-lg bg-[#e3f2ec] text-[#184b42]"><Users className="size-4" /></span>
                  <div><p className="text-sm font-semibold text-[#1a433b]">Kundinnenprofil</p><p className="text-[0.68rem] font-medium text-[#51756c]">Stammdaten pflegen</p></div>
                </div>
                <ArrowRight className="size-4 text-[#1e4e45] transition group-hover:translate-x-0.5" />
              </button>
              <button type="button" className={quickActionButtonClass} onClick={() => router.push("/invoices")}>
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-lg bg-[#f6e6ec] text-[#7f4250]"><HandCoins className="size-4" /></span>
                  <div><p className="text-sm font-semibold text-[#1a433b]">Rechnungsarchiv</p><p className="text-[0.68rem] font-medium text-[#51756c]">Offene Posten prüfen</p></div>
                </div>
                <ArrowRight className="size-4 text-[#1e4e45] transition group-hover:translate-x-0.5" />
              </button>
              <button type="button" className={quickActionButtonClass} onClick={() => router.push("/appointments") }>
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-lg bg-[#e3f2ec] text-[#184b42]"><Plus className="size-4" /></span>
                  <div><p className="text-sm font-semibold text-[#1a433b]">Neuer Termin</p><p className="text-[0.68rem] font-medium text-[#51756c]">Schnell anlegen</p></div>
                </div>
                <ArrowRight className="size-4 text-[#1e4e45] transition group-hover:translate-x-0.5" />
              </button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

