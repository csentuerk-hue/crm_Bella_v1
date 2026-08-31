"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  CalendarClock,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Settings,
  Users,
} from "lucide-react";

import { SIDEBAR_ITEMS } from "@/lib/constants";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "Bella by Sobiella": LayoutDashboard,
  Kundinnen: Users,
  Termine: CalendarClock,
  Rechnungen: ReceiptText,
  Archiv: Archive,
  Einstellungen: Settings,
};

export function CrmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(130%_120%_at_18%_6%,#f9ecef_0%,#edf6f3_43%,#f7faf9_100%)] text-slate-800">
      <aside
        data-testid="crm-sidebar"
        className="fixed left-0 top-0 z-40 flex h-screen w-[86px] flex-col items-center border-r border-[#d3e2dd] bg-[linear-gradient(180deg,#f6fbf8_0%,#edf4f1_100%)] px-2.5 py-4 shadow-[0_18px_36px_rgba(16,76,70,0.18)]"
      >
        <nav className="mt-2 flex w-full flex-1 flex-col items-center gap-2.5" aria-label="CRM Navigation">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = iconMap[item.label];
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`sidebar-item-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                aria-label={item.label}
                title={item.label}
                className={[
                  "relative grid size-12 place-items-center rounded-xl border transition-all duration-200",
                  isActive
                    ? "border-[#24594f] bg-[#2e5f56] text-white shadow-[0_9px_20px_rgba(26,95,87,0.34)]"
                    : "border-[#d1ded9] bg-white text-[#2e5c53] hover:border-[#abc4bc] hover:bg-[#eef6f3]",
                ].join(" ")}
              >
                {isActive ? (
                  <span className="absolute -left-2 h-6 w-1 rounded-r-full bg-[#24594f]" aria-hidden="true" />
                ) : null}
                <Icon className="size-5" />
              </Link>
            );
          })}
        </nav>

        <form action="/api/auth/logout" method="post" className="mb-1">
          <button
            type="submit"
            aria-label="Abmelden"
            title="Abmelden"
            className="grid size-12 place-items-center rounded-xl border border-[#d1ded9] bg-white text-[#2e5c53] transition-all duration-200 hover:border-[#d8b7b9] hover:bg-[#fbf0f1] hover:text-[#935d63]"
          >
            <LogOut className="size-5" />
          </button>
        </form>
      </aside>

      <div className="pl-[86px]">
        <div className="h-full w-full p-3 sm:p-4 lg:p-5">
          <div className="h-[calc(100vh-1.5rem)] overflow-hidden rounded-[30px] border border-[#d6e4df] bg-white/88 shadow-[0_24px_44px_rgba(17,72,68,0.14)] backdrop-blur">
            <main className="h-full min-h-0 overflow-hidden p-4 sm:p-5 lg:p-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
