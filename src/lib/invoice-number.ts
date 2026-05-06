export function deriveCustomerInitials(name: string): string {
  const cleaned = name
    .trim()
    .split(/\s+/)
    .map((chunk) => chunk.replace(/[^\p{L}]/gu, ""))
    .filter(Boolean);

  if (cleaned.length === 0) {
    return "XX";
  }

  if (cleaned.length === 1) {
    const single = cleaned[0].slice(0, 2).toUpperCase();
    return single.padEnd(2, "X");
  }

  const first = cleaned[0].charAt(0);
  const last = cleaned[cleaned.length - 1].charAt(0);
  return `${first}${last}`.toUpperCase();
}

export function formatInvoiceNumber(
  sequence: number,
  issueDate: Date,
  _customerInitials?: string,
  prefix = "BBS",
): string {
  const year = issueDate.getFullYear();
  const padded = sequence.toString().padStart(4, "0");
  const normalizedPrefix = prefix.trim().toUpperCase() || "BBS";
  return `${normalizedPrefix}-${year}-${padded}`;
}
