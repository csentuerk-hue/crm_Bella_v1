type Metric = {
  label: string;
  value: string;
  hint: string;
  onClick: () => void;
};

export function MetricsGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <button
          type="button"
          key={metric.label}
          onClick={metric.onClick}
          className="rounded-3xl border border-[#dfece8] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
            {metric.label}
          </p>
          <p className="mt-2 font-serif text-3xl text-[#1a3f39]">{metric.value}</p>
          <p className="mt-1 text-xs text-slate-500">{metric.hint}</p>
        </button>
      ))}
    </div>
  );
}
