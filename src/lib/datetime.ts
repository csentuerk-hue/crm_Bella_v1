import { format } from "date-fns";
import { de } from "date-fns/locale";

export function formatDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return format(date, "dd.MM.yyyy HH:mm", { locale: de });
}

export function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return format(date, "dd.MM.yyyy", { locale: de });
}
