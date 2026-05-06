"use client";

import Link from "next/link";

type InvoiceAreaSwitchProps = {
  current: "create" | "archive";
};

export function InvoiceAreaSwitch({ current }: InvoiceAreaSwitchProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#dce9e4] bg-[#f8fcfa] p-2">
      <Link
        href="/invoices"
        className={[
          "inline-flex h-9 items-center rounded-xl border px-3 text-sm font-semibold transition",
          current === "create"
            ? "border-[#0f5a55] bg-[#e6f3ef] text-[#0f5a55]"
            : "border-[#d5e2dd] bg-white text-slate-700 hover:bg-slate-50",
        ].join(" ")}
      >
        Rechnung erstellen
      </Link>
      <Link
        href="/invoices/archive"
        className={[
          "inline-flex h-9 items-center rounded-xl border px-3 text-sm font-semibold transition",
          current === "archive"
            ? "border-[#0f5a55] bg-[#e6f3ef] text-[#0f5a55]"
            : "border-[#d5e2dd] bg-white text-slate-700 hover:bg-slate-50",
        ].join(" ")}
      >
        Rechnungsarchiv
      </Link>
    </div>
  );
}

