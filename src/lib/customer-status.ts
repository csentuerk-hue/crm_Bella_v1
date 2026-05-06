import { subWeeks } from "date-fns";

import type { CustomerStatus } from "@/types/crm";

export function deriveCustomerStatus(params: {
  manualStatus: CustomerStatus | string | null | undefined;
  lastAppointmentAt: Date | null | undefined;
  appointmentsCount: number;
  now?: Date;
}): CustomerStatus {
  const now = params.now ?? new Date();
  const inactivityThreshold = subWeeks(now, 8);
  const lastAppointmentAt = params.lastAppointmentAt ?? null;
  const hasAppointments = params.appointmentsCount > 0;

  if (params.manualStatus === "INAKTIV") {
    return "INAKTIV";
  }

  if (lastAppointmentAt && lastAppointmentAt < inactivityThreshold) {
    return "INAKTIV";
  }

  if (params.manualStatus === "AKTIV" || params.manualStatus === "NEU") {
    return params.manualStatus;
  }

  if (hasAppointments) {
    return "AKTIV";
  }

  return "NEU";
}

export function compareCustomerStatusForList(
  left: CustomerStatus,
  right: CustomerStatus,
): number {
  const rank: Record<CustomerStatus, number> = {
    AKTIV: 0,
    NEU: 1,
    INAKTIV: 2,
  };
  return rank[left] - rank[right];
}
