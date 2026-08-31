# Bella CRM – Projektprofil

## Zweck
Bella CRM ist ein maßgeschneidertes CRM für das Beauty-/Lash-Studio **Bella by Sobiella**.  
Das System unterstützt den Studio-Alltag von der Kundinnenpflege über Terminplanung bis zur Rechnungsabwicklung und Nachverfolgung.

## Zielnutzerin
- Primär: Soloselbstständige Studioinhaberin
- Fokus: Schnelle, sichere, nachvollziehbare tägliche Arbeitsabläufe
- Hauptgeräte: Desktop und Tablet (Mobile darf nicht unbrauchbar sein)

## Daten- und Risikoprofil
- Verarbeitet geschäftsrelevante und personenbezogene Daten:
  - Kundinnenstammdaten
  - Termine
  - Rechnungen und Zahlungsstatus
  - Einwilligungen (z. B. Medienfreigabe)
- Diese Daten sind **nicht** Demo-Daten und müssen als echte Betriebsdaten behandelt werden.

## Tech-Stack
- Next.js
- React
- Tailwind CSS
- Prisma
- Neon Postgres
- Vercel
- Playwright
- Deutsche UI

## Architekturleitbild
- Modularer Monolith (keine unnötigen Microservices)
- Klare Modulgrenzen:
  - Kundinnen
  - Termine/Kalender/Kanban
  - Rechnungen
  - Rechnungsarchiv
  - Einstellungen
  - Medienfreigabe
  - Bestand
  - Marketing
  - Berichte
- Bestehende Datenflüsse nur mit expliziter Begründung ändern.
- Keine breiten Refactors ohne klaren Auftrag.

## Marken- und UX-Richtung
- Sprache in der UI: Deutsch
- Stil: Petrol/Teal mit Roségold-/Kupfer-Akzenten
- Wirkung: ruhig, elegant, studio-spezifisch, praktisch
- Vermeiden:
  - generische SaaS-Optik
  - überladene Dashboard-Karten
  - unnötige Erklärungstexte unter Navigationselementen

## Primärer Studio-Workflow
**Anfrage → Kundinnenprofil → Termin → Behandlung → Status „erledigt“ → Rechnung → Zahlungsstatus → Archiv → Refill/Follow-up**

## Kernmodule (Ist + Zielbild)
- Single-Admin-Zugriffsschutz (Login/Logout, signierte Session)
- Kundinnenverwaltung
- Terminplanung (inkl. Kalender/Kanban)
- Rechnungsworkflow (Erstellung, Vorschau, PDF, Finalisierung)
- Rechnungsarchiv (Suche/Filter/Status)
- Einstellungen (Studio-/Rechnungsdaten)
- Medienfreigabe-Status
- Bestand (produktbezogene Erweiterungen)
- Marketing/Berichte (modular ausbaubar)

## Zugriffsschutz (aktueller Startpunkt)
- Ein Studio-Admin; noch keine Mehrbenutzer-/Rollenverwaltung.
- Passwort und Signatur-Secret kommen ausschließlich aus Server-ENV.
- Session wird als signiertes `HttpOnly`-Cookie gespeichert und läuft nach 12 Stunden ab.
- Nicht authentifizierte Seiten werden auf `/login` umgeleitet.
- Nicht authentifizierte API-Aufrufe liefern `401`.
- Produktivbetrieb ohne gültige Auth-Konfiguration bleibt mit `503` geschlossen.

## Bekannte technische Risiken (aktueller Stand)
- E2E-Parallelität: Isolierte Tests können grün sein, parallele Läufe können sich gegenseitig beeinflussen (DB/Settings/Cleanup).
- Rechnungsnummernlogik: Langfristig transaktionssicher absichern (keine race-prone Sequenzlogik).
- Legacy-Daten: Datenbank kann nullable `Invoice.customerId` für Altbestände enthalten; App/API erzwingt bereits `customerId`.
- Der Single-Admin-Login ist bewusst klein gehalten; für spätere Mitarbeiterkonten braucht es Rollen-/Benutzerverwaltung und eine erneute Sicherheitsprüfung.

## Zukunftsanforderungen für produktiven Betrieb
- Klare Rollen-/Sicherheitsstrategie, sobald mehr als ein Studio-Admin benötigt wird
- Verbesserte Testisolation für stabile Parallel-E2E
- Visuelle Regression für Rechnungsvorschau/PDF

## Verbindliche Referenzdokumente
- [AGENTS.md](./AGENTS.md)
- [TESTING.md](./TESTING.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [docs/invoice-rules.md](./docs/invoice-rules.md)
- [docs/privacy-media-consent.md](./docs/privacy-media-consent.md)
