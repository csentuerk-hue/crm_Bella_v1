import Image from "next/image";

import { sanitizeReturnTo } from "@/lib/auth";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const returnTo = sanitizeReturnTo(params.next);
  const hasError = params.error === "1";

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(120%_120%_at_18%_8%,#f9ecef_0%,#edf6f3_46%,#f7faf9_100%)] px-5 py-10 text-slate-800">
      <section className="w-full max-w-md rounded-[32px] border border-[#d6e4df] bg-white/92 p-7 shadow-[0_28px_70px_rgba(17,72,68,0.18)] backdrop-blur sm:p-9">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 grid size-24 place-items-center rounded-full border border-[#d6e4df] bg-[#f7fbf9] shadow-sm">
            <Image
              src="/logo-bella.svg"
              alt="Bella by Sobiella"
              width={72}
              height={72}
              priority
              unoptimized
            />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a26d72]">
            Bella by Sobiella
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#24594f]">Bella CRM</h1>
          <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
            Geschuetzter Studiozugang fuer Kundinnen, Termine und Rechnungen.
          </p>
        </div>

        <form action="/api/auth/login" method="post" className="space-y-5">
          <input type="hidden" name="returnTo" value={returnTo} />

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
              Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              className="h-12 w-full rounded-2xl border border-[#cbdcd6] bg-white px-4 text-base outline-none transition focus:border-[#2e5f56] focus:ring-4 focus:ring-[#2e5f56]/10"
            />
          </div>

          {hasError ? (
            <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Das Passwort ist nicht korrekt.
            </p>
          ) : null}

          <button
            type="submit"
            className="h-12 w-full rounded-2xl bg-[#2e5f56] px-5 font-semibold text-white shadow-[0_10px_24px_rgba(46,95,86,0.24)] transition hover:bg-[#244f48] focus:outline-none focus:ring-4 focus:ring-[#2e5f56]/20"
          >
            Anmelden
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-slate-400">
          Die Sitzung wird nur in einem geschuetzten Browser-Cookie gespeichert.
        </p>
      </section>
    </main>
  );
}
