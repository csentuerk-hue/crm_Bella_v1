import { CUSTOMER_STATUS_LABELS } from "@/lib/constants";
import type { CustomerStatus } from "@/types/crm";

const statusClassMap: Record<CustomerStatus, string> = {
  NEU: "bg-[#f8ecdc] text-[#8a5f2f] border-[#efd7b8]",
  AKTIV: "bg-[#e5f5ef] text-[#1f5a52] border-[#c8e6da]",
  INAKTIV: "bg-[#f1f3f5] text-[#55606d] border-[#d7dde3]",
};

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-semibold tracking-[0.02em] ${statusClassMap[status]}`}
    >
      {CUSTOMER_STATUS_LABELS[status]}
    </span>
  );
}
