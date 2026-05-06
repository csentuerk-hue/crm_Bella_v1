import { NextRequest, NextResponse } from "next/server";
import { addDays, differenceInCalendarDays, subMonths } from "date-fns";

import { serverError } from "@/lib/api";
import { reconcileAppointmentInvoiceConsistency } from "@/lib/data-consistency";
import { requirePermission } from "@/lib/permissions";
import { ensureDatabaseInitialized, prisma } from "@/lib/prisma";
import { toAppointmentDTO, toCustomerDTO, toInvoiceDTO } from "@/lib/serializers";
import type { DashboardPayload } from "@/types/crm";

function monthKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, "dashboard:read");
  if (auth.denied) {
    return auth.denied;
  }
  try {
    await ensureDatabaseInitialized();
    await reconcileAppointmentInvoiceConsistency();

    const now = new Date();
    const fromDate = subMonths(now, 5);

    const [
      openAppointments,
      plannedAppointments,
      archivedCustomers,
      invoicesOpen,
      paidInvoices,
      recentAppointments,
      recentCustomers,
      recentInvoiceRows,
      followUpCustomers,
      appointmentsForBar,
      invoicesForDonut,
      invoicesForLine,
    ] = await Promise.all([
      prisma.appointment.count({ where: { status: "OFFEN", isCancelled: false } }),
      prisma.appointment.count({ where: { status: "GEPLANT", isCancelled: false } }),
      prisma.customer.count({ where: { archived: true } }),
      prisma.invoice.count({ where: { status: "OFFEN" } }),
      prisma.invoice.aggregate({
        _sum: { amountCents: true },
        where: { status: "BEZAHLT" },
      }),
      prisma.appointment.findMany({
        include: {
          customer: { select: { id: true, name: true, mediaConsent: true } },
          invoice: { select: { id: true } },
        },
        orderBy: { startsAt: "desc" },
        take: 8,
      }),
      prisma.customer.findMany({
        include: {
          appointments: {
            select: {
              id: true,
              startsAt: true,
              isCancelled: true,
              invoice: { select: { status: true } },
            },
          },
          treatmentEntries: { select: { id: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      prisma.invoice.findMany({
        include: {
          items: true,
          appointment: {
            select: {
              id: true,
              startsAt: true,
              service: true,
              customer: { select: { name: true } },
            },
          },
        },
        orderBy: { issueDate: "desc" },
        take: 8,
      }),
      prisma.customer.findMany({
        where: { archived: false },
        include: {
          appointments: {
            where: { isCancelled: false },
            orderBy: { startsAt: "desc" },
            take: 1,
            select: { startsAt: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
      prisma.appointment.groupBy({
        by: ["status"],
        _count: { status: true },
        where: { isCancelled: false },
      }),
      prisma.invoice.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      prisma.invoice.findMany({
        where: { issueDate: { gte: fromDate } },
        select: { issueDate: true, amountCents: true },
      }),
    ]);

    const revenueByMonthMap = new Map<string, number>();
    for (let i = 5; i >= 0; i -= 1) {
      const date = subMonths(now, i);
      revenueByMonthMap.set(monthKey(date), 0);
    }
    for (const invoice of invoicesForLine) {
      const key = monthKey(invoice.issueDate);
      if (revenueByMonthMap.has(key)) {
        revenueByMonthMap.set(key, (revenueByMonthMap.get(key) ?? 0) + invoice.amountCents);
      }
    }

    const validRecentInvoiceRows = recentInvoiceRows.filter(
      (invoice): invoice is typeof invoice & { customerId: string } =>
        typeof invoice.customerId === "string" && invoice.customerId.trim().length > 0,
    );
    const recentInvoiceCustomerIds = Array.from(
      new Set(validRecentInvoiceRows.map((invoice) => invoice.customerId)),
    );
    const recentInvoiceCustomers =
      recentInvoiceCustomerIds.length === 0
        ? []
        : await prisma.customer.findMany({
            where: { id: { in: recentInvoiceCustomerIds } },
            select: {
              id: true,
              name: true,
            },
          });
    const recentInvoiceCustomerMap = new Map(
      recentInvoiceCustomers.map((customer) => [customer.id, customer]),
    );

    const payload: DashboardPayload = {
      metrics: {
        openAppointments,
        plannedAppointments,
        completedRevenueCents: paidInvoices._sum.amountCents ?? 0,
        invoicesOpen,
        archivedCustomers,
      },
      chartSeries: {
        revenueByMonth: [...revenueByMonthMap.entries()].map(([month, valueCents]) => ({
          month,
          valueCents,
        })),
        appointmentsByStatus: appointmentsForBar.map((item) => ({
          status: item.status as DashboardPayload["chartSeries"]["appointmentsByStatus"][number]["status"],
          count: item._count.status,
        })),
        invoiceByStatus: invoicesForDonut.map((item) => ({
          status: item.status as DashboardPayload["chartSeries"]["invoiceByStatus"][number]["status"],
          count: item._count.status,
        })),
      },
      latest: {
        appointments: recentAppointments.map((item) => toAppointmentDTO(item)),
        customers: recentCustomers.map((item) => toCustomerDTO(item)),
        invoices: validRecentInvoiceRows.map((invoice) =>
          toInvoiceDTO({
            ...invoice,
            customer: recentInvoiceCustomerMap.get(invoice.customerId) ?? null,
          }),
        ),
      },
      followUps: followUpCustomers
        .map((customer) => {
          const lastAppointmentAt = customer.appointments[0]?.startsAt ?? null;
          const daysSinceLast = lastAppointmentAt
            ? differenceInCalendarDays(now, lastAppointmentAt)
            : null;
          const status: "AKTIV" | "UEBERFAELLIG" | "INAKTIV" =
            !lastAppointmentAt || (daysSinceLast !== null && daysSinceLast >= 28)
              ? daysSinceLast !== null && daysSinceLast >= 56
                ? "INAKTIV"
                : "UEBERFAELLIG"
              : "AKTIV";
          return {
            customerId: customer.id,
            customerName: customer.name,
            status,
            lastAppointmentAt: lastAppointmentAt ? lastAppointmentAt.toISOString() : null,
            suggestedRefillDate: lastAppointmentAt
              ? addDays(lastAppointmentAt, 21).toISOString()
              : null,
            daysSinceLast,
          };
        })
        .sort((left, right) => {
          const rank = (value: "AKTIV" | "UEBERFAELLIG" | "INAKTIV") =>
            value === "UEBERFAELLIG" ? 0 : value === "INAKTIV" ? 1 : 2;
          return rank(left.status) - rank(right.status);
        })
        .slice(0, 12),
    };

    return NextResponse.json(payload);
  } catch {
    return serverError("Dashboard konnte nicht geladen werden.");
  }
}
