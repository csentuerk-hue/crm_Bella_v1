const eurFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export function formatEuroFromCents(cents: number): string {
  return eurFormatter.format(cents / 100);
}

export function euroInputToCents(value: string | number): number {
  if (typeof value === "number") {
    return Math.round(value * 100);
  }

  const normalized = value.replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.round(parsed * 100);
}
