# Bella CRM – Rechnungsregeln

## Zweck
Dieses Dokument definiert verbindliche Regeln für Rechnungslogik, Validierung, Vorschau/PDF und Änderungsprozesse.

## Kernregeln (aktuell verbindlich)
1. `customerId` ist auf App/API-Ebene für jede Rechnung erforderlich.
2. `appointmentId` ist optional.
3. „Freie Rechnung“ bedeutet: Rechnung **ohne Termin**, aber **mit Kundin**.
4. Produktverkäufe (z. B. Lash Shampoo) müssen ebenfalls einer Kundin zugeordnet sein.
5. Neue Create/Update-Flows ohne `customerId` müssen abgelehnt werden.

## Rechnungsnummer & Finalisierung
- Rechnungsnummer wird **erst bei Finalisierung** erzeugt.
- Entwürfe dürfen keine endgültige Rechnungsnummer verbrauchen.
- Entwurfsstatus und finaler Status müssen klar getrennt sein.

## Vorschau und PDF (Release-kritisch)
- Vorschau und PDF müssen dieselbe Datenquelle nutzen.
- Vorschau und PDF sollen dieselbe Layoutlogik teilen.
- Mismatch zwischen Vorschau und PDF ist ein Release-Blocker.
- A4-Layout muss stabil bleiben.
- Zielausbau: visuelle Regression/Snapshot-Tests für Rechnungsdokumente.

## §19 UStG / Kleinunternehmerregelung
Wenn Kleinunternehmerregelung aktiv ist:
- keine MwSt.-Zeilen anzeigen
- keine Umsatzsteuer berechnen
- klaren Hinweis anzeigen (z. B. „Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.“)

## Zahlungslogik
- Standard-Zahlungsart: **Barzahlung**
- Bei **Überweisung** müssen angezeigt werden:
  - Bankdaten (z. B. Kontoinhaber, IBAN, optional BIC)
  - Zahlungsziel-Hinweis: 10 Werktage

## Nach Finalisierung
- Finalisierte Rechnungen dürfen nicht stillschweigend verändert werden.
- Zahlungsstatus darf nach Finalisierung geändert werden.
- Interne Notizen dürfen geändert werden, sofern von Rechnungsinhalt getrennt.
- Für Inhaltskorrekturen langfristig bevorzugt:
  - Korrektur-/Storno-/Versionierungsprozess
  - statt direkter stiller Überschreibung

## Technischer Ist-Hinweis
- App/API erzwingt `customerId`.
- Datenbankschema kann `Invoice.customerId` aktuell noch nullable enthalten (Legacy-Kompatibilität).

## Langfristige Verbesserungen
- Legacy-Rechnungen ohne `customerId` bereinigen/migrieren.
- `Invoice.customerId` als harte DB-Constraint prüfen.
- Rechnungsnummernvergabe transaktionssicher machen.
- Race-prone `max(sequence)+1`-Ansätze vermeiden.
- Optional: dediziertes Counter-/Sequence-Modell für parallele Finalisierung.

## Invoice Status Felder – aktueller Stand und Konsolidierungshinweis
- `documentStatus` steuert den Dokumentzustand auf Belegebene (`DRAFT`, `FINAL`, `SENT`, `CANCELLED`).
  In der Update-Logik wird bei Finalisierung auf `FINAL` gesetzt, bei Entwurf auf `DRAFT`.
- `lifecycleStatus` steuert den Bearbeitungs-/Ablaufstatus (`ENTWURF`, `FINALISIERT`).
  Dieses Feld wird aktiv für Filter in Listen/Archiv genutzt und bei Finalisierung auf `FINALISIERT` gesetzt.
- Das einfache Feld `status` ist aktuell ein Legacy-Zahlungsanzeigestatus (`OFFEN`/`BEZAHLT`) und wird aus `paymentStatus` abgeleitet.
  Es beschreibt nicht den Dokument-Lifecycle.

Aktueller kanonischer Prüfpunkt für „ist die Rechnung finalisiert“ im Code:
- In `src/app/api/invoices/[id]/route.ts` gilt eine Rechnung als finalisiert, wenn
  `lifecycleStatus === FINALISIERT` **oder** `documentStatus` in `FINAL|SENT|CANCELLED` ist.

Hinweis zur Zukunft:
- Die drei Statusfelder sollten perspektivisch konsolidiert bzw. sauber voneinander abgeleitet werden,
  damit kein Status-Drift entsteht. Diese Konsolidierung ist **nicht** Teil des aktuellen Tasks.
