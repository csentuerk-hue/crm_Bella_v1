# Bella by Sobiella CRM

Alltagstaugliches CRM fuer Beauty-Studios mit:
- Kundinnenverwaltung (Suche, Bearbeitung, Archivierung)
- Terminplanung (Liste + Kanban Drag-and-Drop)
- Rechnungen mit fortlaufender Nummer, Vorschaupflicht und PDF-Export (A4, Wasserzeichen, Logo)
- Dashboard mit klickbaren Kennzahlen und interaktiven Detailansichten
- Single-User-Arbeitsmodus fuer eine Inhaberin (ohne Rollenwechsel)
- Stripe-Integration vorbereitet (deaktiviert)

## Tech Stack
- Next.js 16 (App Router) + TypeScript
- Prisma Client (PostgreSQL / Supabase / Neon kompatibel)
- Recharts fuer Analytics Widgets
- pdf-lib fuer Rechnungs-PDF
- Playwright fuer E2E Smoke Tests

## Start Lokal
1. Abhaengigkeiten installieren:
```bash
npm install
```

2. ENV-Datei lokal anlegen:
```bash
cp .env.example .env
```

3. Werte in `.env` mit deinen echten Daten fuellen (z. B. aus Supabase oder Neon):
```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:6543/postgres?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require
```

Wichtig: `.env` niemals committen.

4. Datenbank-Migrationen anwenden:
```bash
npm run db:init
```

5. Entwicklungsserver starten:
```bash
npm run dev
```

6. App oeffnen:
```text
http://localhost:3000
```

## Wichtige Workflows
- Rechnungserstellung immer aus Termin oder Rechnungsseite starten.
- Jede Rechnung wird zuerst als Vorschau geoeffnet (`/invoices/[id]/preview`).
- Druck und Download sind nur in der Vorschau verlinkt.
- Alle Kernfunktionen sind im Einzelplatzbetrieb ohne Rollenfilter verfuegbar.

## E2E Tests
```bash
npm run test:e2e
```

## Umgebungsvariablen
Siehe `.env.example`:
- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `STRIPE_ACTIVE`
- `STRIPE_SECRET_KEY`

## Deployment
- Zielplattform: Vercel
- Vor dem Deploy in Vercel dieselben Postgres-ENV-Variablen setzen.
- Das Build-Script fuehrt `prisma migrate deploy` automatisch aus.
