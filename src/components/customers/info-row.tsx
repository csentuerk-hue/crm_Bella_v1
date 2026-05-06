type InfoRowProps = {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
};

export function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="rounded-xl border border-[#e4ece8] bg-white px-3 py-2.5">
      <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-700">{value}</p>
    </div>
  );
}
