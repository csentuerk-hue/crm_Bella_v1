export type AppointmentServiceOption = {
  value: string;
  defaultPriceCents: number;
};

const SERVICE_PRESETS: AppointmentServiceOption[] = [
  { value: "Refill", defaultPriceCents: 59_00 },
  { value: "1:1", defaultPriceCents: 89_00 },
  { value: "Volume", defaultPriceCents: 109_00 },
  { value: "Individuell", defaultPriceCents: 0 },
];

const FALLBACK_SERVICE_COLOR = "#5B6F6A";

const SERVICE_COLORS: Record<string, string> = {
  refill: "#4FC3F7",
  "1:1": "#0F766E",
  volume: "#7C3AED",
  "neuset 1:1": "#0F766E",
  volumenset: "#7C3AED",
};

export const APPOINTMENT_SERVICE_OPTIONS = SERVICE_PRESETS;

export function findServicePreset(service: string | null | undefined) {
  if (!service) {
    return null;
  }

  const normalized = service.trim().toLowerCase();
  return (
    SERVICE_PRESETS.find((option) => option.value.toLowerCase() === normalized) ??
    null
  );
}

export function getServiceBadgeClass(_service: string | null | undefined) {
  void _service;
  return "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em]";
}

export function getServiceColor(service: string | null | undefined) {
  if (!service) {
    return FALLBACK_SERVICE_COLOR;
  }
  const normalized = service.trim().toLowerCase();
  return SERVICE_COLORS[normalized] ?? FALLBACK_SERVICE_COLOR;
}

export function getServiceBadgeStyle(service: string | null | undefined) {
  const color = getServiceColor(service);
  return {
    borderColor: `${color}66`,
    backgroundColor: `${color}14`,
    color,
  };
}

export function getServiceDotStyle(service: string | null | undefined) {
  return {
    backgroundColor: getServiceColor(service),
  };
}
