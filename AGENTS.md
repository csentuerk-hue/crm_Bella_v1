# AGENTS.md — Bella CRM

## Pflicht: Erst Dokumentation lesen
Vor jeder Implementierung diese Dateien lesen:
- [PROJECT_PROFILE.md](C:\Users\CSent\Desktop\bella-crm-git-check\PROJECT_PROFILE.md)
- [TESTING.md](C:\Users\CSent\Desktop\bella-crm-git-check\TESTING.md)
- [DEPLOYMENT.md](C:\Users\CSent\Desktop\bella-crm-git-check\DEPLOYMENT.md)
- [docs/invoice-rules.md](C:\Users\CSent\Desktop\bella-crm-git-check\docs\invoice-rules.md)
- [docs/privacy-media-consent.md](C:\Users\CSent\Desktop\bella-crm-git-check\docs\privacy-media-consent.md)

## Projektleitplanken (kurz)
- Bella CRM ist ein studio-spezifisches Beauty-CRM, keine generische SaaS-Oberfläche.
- Sichtbare UI-Sprache ist Deutsch.
- Designrichtung: ruhig, elegant, praktisch; Petrol/Teal + Roségold/Kupfer.
- Bestehende Kernlogik nur mit klarem Auftrag ändern.
- Keine Broad Refactors ohne Begründung und Verifikation.

## Sicherheitsregeln
- Keine Secrets committen (`.env*` mit echten Werten verboten).
- Keine serverseitigen Secrets im Client verfügbar machen.
- Keine destruktiven DB-Befehle ohne expliziten Auftrag.
- Kein Deployment ohne explizite Freigabe.

## Arbeitsmodus
- Klein, nachvollziehbar, verifizierbar arbeiten.
- Vor größeren Änderungen zuerst betroffene Dateien/Flows analysieren.
- Nach Änderungen immer mindestens Lint; Build/Tests gemäß [TESTING.md](C:\Users\CSent\Desktop\bella-crm-git-check\TESTING.md).
