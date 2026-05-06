"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  APPOINTMENT_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
} from "@/lib/constants";
import { formatEuroFromCents } from "@/lib/currency";
import type { DashboardPayload } from "@/types/crm";

const barColors = ["#0f5a55", "#74a39d", "#b76e79", "#d2a3ab"];
const donutColors = ["#1a3f39", "#b76e79", "#e3c3c9"];

type ChartProps = DashboardPayload["chartSeries"];

function ChartSurface({
  children,
}: {
  children: (size: { width: number; height: number }) => ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateSize = () => {
      const nextWidth = Math.floor(container.clientWidth);
      const nextHeight = Math.floor(container.clientHeight);
      setSize({ width: nextWidth, height: nextHeight });
    };

    updateSize();
    const frame = window.requestAnimationFrame(updateSize);
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={containerRef} className="mt-3 h-56 w-full min-w-0 min-h-[220px]">
      {size.width > 0 && size.height > 0 ? (
        children(size)
      ) : (
        <div className="h-full w-full rounded-2xl border border-slate-100 bg-slate-50/60" />
      )}
    </div>
  );
}

export function RevenueLineWidget({ series }: { series: ChartProps["revenueByMonth"] }) {
  return (
    <div className="rounded-3xl border border-[#dbece7] bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-700">Umsatztrend (6 Monate)</p>
      <ChartSurface>
        {({ width, height }) => (
          <LineChart width={width} height={height} data={series}>
            <CartesianGrid stroke="#eef4f1" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 12 }}
              tickFormatter={(value) => `${Math.round(value / 100)} EUR`}
            />
            <Tooltip
              formatter={(value) => formatEuroFromCents(Number(value))}
              contentStyle={{ borderRadius: 12, borderColor: "#d5e8e2" }}
            />
            <Line
              type="monotone"
              dataKey="valueCents"
              stroke="#0f5a55"
              strokeWidth={3}
              dot={{ r: 3, fill: "#b76e79" }}
            />
          </LineChart>
        )}
      </ChartSurface>
    </div>
  );
}

export function AppointmentsBarWidget({
  series,
}: {
  series: ChartProps["appointmentsByStatus"];
}) {
  const formatted = series.map((item) => ({
    ...item,
    statusLabel: APPOINTMENT_STATUS_LABELS[item.status],
  }));

  return (
    <div className="rounded-3xl border border-[#e5edf5] bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-700">Terminstatus (aktiv)</p>
      <ChartSurface>
        {({ width, height }) => (
          <BarChart width={width} height={height} data={formatted}>
            <CartesianGrid stroke="#eef4f1" vertical={false} />
            <XAxis dataKey="statusLabel" tick={{ fill: "#64748b", fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} />
            <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#dbe6f2" }} />
            <Bar dataKey="count" radius={[8, 8, 0, 0]}>
              {formatted.map((item, index) => (
                <Cell
                  key={item.status}
                  fill={barColors[index % barColors.length]}
                />
              ))}
            </Bar>
          </BarChart>
        )}
      </ChartSurface>
    </div>
  );
}

export function InvoiceDonutWidget({ series }: { series: ChartProps["invoiceByStatus"] }) {
  const formatted = series.map((item) => ({
    ...item,
    statusLabel: INVOICE_STATUS_LABELS[item.status],
  }));

  return (
    <div className="rounded-3xl border border-[#eddde0] bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-700">Rechnungsstatus</p>
      <ChartSurface>
        {({ width, height }) => (
          <PieChart width={width} height={height}>
            <Pie
              data={formatted}
              dataKey="count"
              nameKey="statusLabel"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={86}
              paddingAngle={3}
            >
              {formatted.map((entry, index) => (
                <Cell
                  key={entry.status}
                  fill={donutColors[index % donutColors.length]}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#eddde0" }} />
          </PieChart>
        )}
      </ChartSurface>
    </div>
  );
}
