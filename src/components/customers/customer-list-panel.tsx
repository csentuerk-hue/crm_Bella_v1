import { Plus, Search } from "lucide-react";

import { CustomerAvatar } from "@/components/customers/customer-avatar";
import { CustomerStatusBadge } from "@/components/customers/customer-status-badge";
import type { CustomerDTO } from "@/types/crm";

type CustomerListPanelProps = {
  query: string;
  onQueryChange: (value: string) => void;
  customers: CustomerDTO[];
  selectedCustomerId: string | null;
  loadingCustomers: boolean;
  onSelectCustomer: (customerId: string) => void;
  onCreateCustomer: () => void;
};

export function CustomerListPanel({
  query,
  onQueryChange,
  customers,
  selectedCustomerId,
  loadingCustomers,
  onSelectCustomer,
  onCreateCustomer,
}: CustomerListPanelProps) {
  return (
    <aside
      data-testid="customers-list-column"
      className="flex min-h-[calc(100vh-11.5rem)] flex-col rounded-[30px] border border-[#d3e3de] bg-white/95 p-4 shadow-[0_14px_30px_rgba(13,80,74,0.12)]"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-serif text-[1.65rem] leading-none text-[#173f39]">Kundinnenliste</h2>
        <button type="button" className="btn-primary h-9 px-3 text-xs" onClick={onCreateCustomer}>
          <Plus className="mr-1 size-4" />
          Neue Kundin
        </button>
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Suche nach Name"
          className="input-base w-full pl-9"
        />
      </label>

      <div className="mt-3 flex-1 overflow-y-auto pr-1">
        {loadingCustomers ? (
          <p className="rounded-2xl border border-[#e0ebe7] bg-[#f7fbf9] px-3 py-3 text-sm text-slate-600">
            Kundinnen werden geladen...
          </p>
        ) : null}

        {!loadingCustomers && customers.length === 0 ? (
          <p className="rounded-2xl border border-[#e0ebe7] bg-[#f7fbf9] px-3 py-3 text-sm text-slate-600">
            Keine Kundinnen gefunden.
          </p>
        ) : null}

        {!loadingCustomers ? (
          <ul className="space-y-2">
            {customers.map((customer) => {
              const isActive = selectedCustomerId === customer.id;
              return (
                <li key={customer.id}>
                  <button
                    type="button"
                    onClick={() => onSelectCustomer(customer.id)}
                    className={[
                      "flex w-full items-center gap-2.5 rounded-2xl border px-2.5 py-2.5 text-left transition",
                      isActive
                        ? "border-[#8fc3b5] bg-[#e9f6f1] shadow-[0_4px_10px_rgba(36,96,87,0.14)]"
                        : "border-[#dfeae6] bg-white hover:border-[#c2d9d1] hover:bg-[#f7fcfa]",
                    ].join(" ")}
                  >
                    <CustomerAvatar name={customer.name} photoUrl={customer.photoUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{customer.name}</p>
                      <p className="truncate text-xs text-slate-600">{customer.phone || "-"}</p>
                    </div>
                    <CustomerStatusBadge status={customer.status} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </aside>
  );
}
