# Bella CRM – Zugriffsschutz

## Aktueller Scope
Der aktuelle Zugriffsschutz ist bewusst als **Single-Admin-Login** umgesetzt. Er schützt das bestehende Studio-CRM, ohne Kundinnen-, Termin- oder Rechnungsdatenmodelle zu verändern.

## Server-Konfiguration
Pflicht für Production:
- `CRM_ADMIN_PASSWORD`: mindestens 12 Zeichen, stark und einzigartig
- `CRM_AUTH_SECRET`: mindestens 32 zufällige Zeichen

Beide Werte bleiben ausschließlich serverseitig und dürfen nie als `NEXT_PUBLIC_*` verfügbar gemacht werden.

## Session
- Cookie: `bella_crm_session`
- signiert mit HMAC-SHA256
- zufälliger Nonce pro Anmeldung
- Laufzeit: 12 Stunden
- `HttpOnly`
- `SameSite=Lax`
- `Secure` in Production

## Zugriffspfad
- `/login` ist ohne Session erreichbar.
- `/api/auth/login` nimmt das Passwort serverseitig entgegen.
- Erfolgreiche Anmeldung setzt die signierte Session.
- `/api/auth/logout` entfernt die Session.
- Andere Seiten benötigen eine gültige Session und werden sonst nach `/login` umgeleitet.
- Andere API-Routen benötigen eine gültige Session und liefern sonst `401`.

## Fail closed
Wenn die Auth-Konfiguration in Production fehlt oder die Mindestanforderungen nicht erfüllt, darf das CRM **nicht offen weiterlaufen**. Der Proxy liefert stattdessen `503`.

## Sicherheitsgrenzen
- Keine Passwörter oder Secrets im Repository, Browser-Code oder Logs.
- Kein Auth-Bypass im Production-Pfad.
- Passwortvergleich erfolgt serverseitig mit konstantzeitlichem Hashvergleich.
- Falsche Logins erhalten zusätzlich eine kurze Verzögerung, um triviale Brute-Force-Versuche zu verlangsamen.
- Der aktuelle Login ersetzt keine zukünftige Benutzer-/Rollenverwaltung, falls Mitarbeiterkonten benötigt werden.

## Release-Check
Vor Production müssen mindestens geprüft werden:
1. unangemeldete CRM-Seite → Login
2. unangemeldete API → `401`
3. falsches Passwort → keine Session
4. korrektes Passwort → CRM erreichbar
5. Session-Cookie ist `HttpOnly`
6. Logout → Session entfernt
7. Production ohne Auth-ENV → `503`, nicht offener CRM-Zugriff
