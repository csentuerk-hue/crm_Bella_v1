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
- Kundinnenverwaltung
- Terminplanung (inkl. Kalender/Kanban)
- Rechnungsworkflow (Erstellung, Vorschau, PDF, Finalisierung)
- Rechnungsarchiv (Suche/Filter/Status)
- Einstellungen (Studio-/Rechnungsdaten)
- Medienfreigabe-Status
- Bestand (produktbezogene Erweiterungen)
- Marketing/Berichte (modular ausbaubar)

## Bekannte technische Risiken (aktueller Stand)
- E2E-Parallelität: Isolierte Tests können grün sein, parallele Läufe können sich gegenseitig beeinflussen (DB/Settings/Cleanup).
- Rechnungsnummernlogik: Langfristig transaktionssicher absichern (keine race-prone Sequenzlogik).
- Legacy-Daten: Datenbank kann nullable `Invoice.customerId` für Altbestände enthalten; App/API erzwingt bereits `customerId`.

## Zukunftsanforderungen für produktiven Betrieb
- Zugriffsschutz/Authentifizierung vor realem Live-Betrieb mit Kundinnendaten
- Klare Rollen-/Sicherheitsstrategie (mindestens Single-Admin-Login als Startpunkt)
- Verbesserte Testisolation für stabile Parallel-E2E
- Visuelle Regression für Rechnungsvorschau/PDF

## Verbindliche Referenzdokumente
- [TESTING.md](C:\Users\CSent\Desktop\bella-crm-git-check\TESTING.md)
- [DEPLOYMENT.md](C:\Users\CSent\Desktop\bella-crm-git-check\DEPLOYMENT.md)
- [docs/invoice-rules.md](C:\Users\CSent\Desktop\bella-crm-git-check\docs\invoice-rules.md)
- [docs/privacy-media-consent.md](C:\Users\CSent\Desktop\bella-crm-git-check\docs\privacy-media-consent.md)
