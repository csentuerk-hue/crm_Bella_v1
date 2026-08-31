# Bella CRM – Testregeln

## Ziel
Tests sichern reale Studio-Workflows ab (Kundinnen, Termine, Rechnungen, Archiv, PDF) und dürfen nicht nur „grün“ werden, sondern müssen das beabsichtigte Produktverhalten verifizieren.

## Pflicht-Checks vor Abschluss eines Tasks
1. `npm run lint`
2. `npm run build` (wenn notwendige ENV-Variablen verfügbar sind)
3. `npm run db:generate` nach Prisma-/Schema-nahen Änderungen
4. Relevante Playwright-Spezifikationen für den geänderten Bereich

## Playwright-Strategie
- Fokus auf Kernabläufe:
  - Zugriffsschutz/Login/Logout
  - Kundin anlegen/bearbeiten/suchen
  - Termin anlegen und Statuswechsel
  - Rechnung aus Termin
  - Freie Rechnung (ohne Termin, aber mit Kundin)
  - Rechnungsarchiv-Suche und Statuspflege
  - Vorschau und PDF
- Lokale Playwright-Läufe verwenden ausschließlich fest definierte E2E-Testzugangsdaten aus `playwright.config.ts`; diese Werte sind keine Production-Secrets.
- Die regulären Fachtests laufen mit einer signierten Test-Session.
- `tests/auth-access.spec.ts` läuft bewusst ohne vorab gesetzte Session und prüft die Schutzgrenze selbst.

## Zugriffsschutz-Checks
- Nicht authentifizierte CRM-Seiten müssen nach `/login` umleiten.
- Direkte nicht authentifizierte API-Aufrufe müssen `401` liefern.
- Falsches Passwort darf kein Session-Cookie erzeugen.
- Erfolgreicher Login muss ein signiertes `HttpOnly`-Cookie erzeugen.
- Logout muss die Session entfernen und weitere API-Aufrufe wieder blockieren.
- Auth-Tests dürfen nicht durch globale Test-Bypässe oder deaktivierte Production-Schutzlogik „grün“ gemacht werden.

## E2E-Isolation (verbindlich)
- Keine global geteilten Testdaten ohne eindeutige Marker.
- Cleanup-Routinen dürfen nur testmarkierte Daten entfernen.
- Keine stillen Seiteneffekte auf globale Einstellungen in Paralleltests.
- Konfliktanfällige Specs bis zur Isolation mit `--workers=1` ausführen.

## Bekannter aktueller Risiko-Hinweis
- Isolierte/serielle Läufe können erfolgreich sein, während parallele Läufe interferieren (DB/Settings/Cleanup).
- Dieses Risiko ist bekannt und darf nicht ignoriert werden.

## Testanpassungen
- Tests nicht abschwächen, nur um grün zu werden.
- Teständerungen nur, wenn Erwartungen veraltet sind und nicht mehr dem gewollten Bella-CRM-Verhalten entsprechen.

## Visuelle Verifikation
- UI-Änderungen:
  - Desktop-Screenshots erforderlich
  - Tablet-Screenshots erforderlich
- Mobile-Screenshots zusätzlich, wenn Mobile-Layout verändert wurde

## Rechnung/PDF-Qualität
- Vorschau und PDF müssen logisch und visuell konsistent bleiben.
- A4-Layout-Stabilität vor Freigabe prüfen.
- Preview/PDF-Mismatch gilt als Release-Blocker.
- Zielausbau: visuelle Regression/Snapshot-Strategie für Rechnungsdokumente.

## Empfohlene Befehle (gezielt statt breit)
- Einzelne Spezifikation:
```bash
npx playwright test tests/<datei>.spec.ts --workers=1
```
- Zugriffsschutz gezielt:
```bash
npx playwright test tests/auth-access.spec.ts --project=auth --workers=1
```
- Relevante Teilmenge:
```bash
npx playwright test tests/spec-a.spec.ts tests/spec-b.spec.ts
```
- Gesamt-E2E (nur wenn sinnvoll/stabil):
```bash
npm run test:e2e
```

## Was vor Release nicht ignoriert werden darf
- Lint-/Build-Fehler
- Server-/Client-Datenflussfehler
- API-Fehlerfälle ohne saubere JSON-Antworten
- Vorschau/PDF-Inkonsistenzen
- Ungesicherte oder unklare Datenlöschpfade in Tests
- Authentifizierungs- oder Session-Bypässe im Produktivpfad
