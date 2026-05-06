# Bella CRM – Deployment-Regeln

## Grundsatz
Kein Deployment ohne explizite Freigabe und ohne vorherige Verifikation.

## Verbindliche Sicherheitsregeln
- Kein Force Push
- Kein `git reset` für destruktive Rückbauten
- Keine destruktiven DB-Befehle (z. B. Reset/Force-Reset)
- Keine Secrets im Repository
- Keine Committe von `.env`-Dateien

## Pflicht-Checkliste vor Deployment
1. Arbeitsbaum sauber und nachvollziehbar
2. `npm run lint` erfolgreich
3. `npm run build` erfolgreich (mit korrekten ENV-Variablen)
4. Relevante Playwright-Checks für die geänderten Flows
5. Rechnungsvorschau/PDF-Konsistenz geprüft
6. Betroffene Kernseiten manuell geprüft (mind. Desktop + Tablet)

## ENV-Regeln
Benötigte Variablen (je nach Scope):
- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `STRIPE_ACTIVE` (falls Stripe-Pfad aktiv)
- `STRIPE_SECRET_KEY` (falls Stripe-Pfad aktiv)
- `E2E_BASE_URL` (für Prod/Preview-E2E)
- `CI` (CI-Laufkontext)
- `NODE_ENV` (Runtime/System)

Wichtig:
- Lokale `.env` ist kein Garant für Vercel-ENV.
- Vercel Preview und Production haben separate ENV-Konfiguration.
- `DATABASE_URL`/`DATABASE_URL_UNPOOLED` dürfen niemals im Clientcode landen.

## Preview vs Production
- Preview-Deployments und Production-Deployments getrennt behandeln.
- Erst Preview validieren, dann Production freigeben (wenn gefordert).
- Production nur mit expliziter Freigabe.

## Vercel/Neon/Prisma-Prüfpunkte
- Vercel-Projekt korrekt verlinkt
- Alle erforderlichen ENV-Variablen gesetzt
- Prisma-Client und Schema kompatibel zum Zielsystem
- Migrationspfad dokumentiert und sicher

## High-Level Rollback/Safety
- Änderungen klein und nachvollziehbar halten
- Deployment-Zeitpunkt und Commit-Referenz dokumentieren
- Bei Problemen auf letzten stabilen Zustand zurückgehen (ohne destruktive DB-Aktionen)

## Verbotene Aktionen ohne ausdrücklichen Auftrag
- Produktion deployen
- Migrationen erzwingen/resetten
- Secrets rotieren/offenlegen über Task-Ausgabe
