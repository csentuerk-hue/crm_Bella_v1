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
7. Zugriffsschutz geprüft: ohne Session kein CRM-/API-Zugriff, Login/Logout funktionieren

## ENV-Regeln
Benötigte Variablen (je nach Scope):
- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `CRM_ADMIN_PASSWORD` (Produktivbetrieb: Pflicht, mindestens 12 Zeichen)
- `CRM_AUTH_SECRET` (Produktivbetrieb: Pflicht, mindestens 32 zufällige Zeichen)
- `STRIPE_ACTIVE` (falls Stripe-Pfad aktiv)
- `STRIPE_SECRET_KEY` (falls Stripe-Pfad aktiv)
- `E2E_BASE_URL` (für Prod/Preview-E2E)
- `CI` (CI-Laufkontext)
- `NODE_ENV` (Runtime/System)

Wichtig:
- Lokale `.env` ist kein Garant für Vercel-ENV.
- Vercel Preview und Production haben separate ENV-Konfiguration.
- `DATABASE_URL`/`DATABASE_URL_UNPOOLED` dürfen niemals im Clientcode landen.
- `CRM_ADMIN_PASSWORD` und `CRM_AUTH_SECRET` dürfen niemals als `NEXT_PUBLIC_*` gesetzt werden.
- Fehlen die Auth-Variablen im Produktivbetrieb oder sind sie zu kurz, muss das CRM mit `503` geschlossen bleiben statt offen auszuliefern.
- Rotation von `CRM_AUTH_SECRET` macht bestehende Sitzungen sofort ungültig.

## Zugriffsschutz vor Production
- Single-Admin-Login ist der aktuelle Startpunkt; keine Benutzer-/Rollenverwaltung vortäuschen.
- Starkes, einzigartiges Admin-Passwort verwenden.
- `CRM_AUTH_SECRET` zufällig generieren und getrennt vom Passwort verwalten.
- Login-Seite, direkte API-Aufrufe ohne Session und Logout vor Freigabe testen.
- Die Session wird in einem signierten `HttpOnly`-Cookie gehalten; Secrets dürfen nicht in Browser-Code oder Logs ausgegeben werden.

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
