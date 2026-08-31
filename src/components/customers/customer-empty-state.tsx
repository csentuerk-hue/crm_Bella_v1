import Image from "next/image";
import { Plus } from "lucide-react";

type CustomerEmptyStateProps = {
  onCreateCustomer: () => void;
};

export function CustomerEmptyState({ onCreateCustomer }: CustomerEmptyStateProps) {
  return (
    <section className="relative grid min-h-[calc(100vh-11.5rem)] place-items-center overflow-hidden rounded-[30px] border border-[#d4e3de] bg-[linear-gradient(180deg,#ffffff_0%,#f7fcfa_100%)] p-6 shadow-[0_14px_32px_rgba(13,80,74,0.12)]">
      <Image
        src="/branding/bella-watermark.png" loading="eager"
        alt="Bella by Sobiella Wasserzeichen"
        fill
        className="pointer-events-none object-contain opacity-10"
        sizes="(min-width: 1024px) 50vw, 100vw"
      />
      <div className="relative z-10 flex max-w-md flex-col items-center text-center">
        <button type="button" className="btn-primary" onClick={onCreateCustomer}>
          <Plus className="mr-2 size-4" />
          Neue Kundin
        </button>
        <p className="mt-4 text-sm text-slate-600">
          Keine Kundin ausgew?hlt. So bleiben auf offenem Tablet keine sensiblen Daten sichtbar.
        </p>
      </div>
    </section>
  );
}
