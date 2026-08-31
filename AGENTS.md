# AGENTS.md — Bella CRM

Diese Datei enthält verbindliche Arbeitsregeln für Codex und andere Coding-Agenten im Repository.

## 1. Vor jeder Implementierung lesen
Vor Änderungen mindestens diese Dateien lesen, soweit der Task den Bereich betrifft:
- [PROJECT_PROFILE.md](./PROJECT_PROFILE.md)
- [TESTING.md](./TESTING.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [docs/invoice-rules.md](./docs/invoice-rules.md) bei Rechnungen, Zahlungen, PDF oder Archiv
- [docs/privacy-media-consent.md](./docs/privacy-media-consent.md) bei Kundinnen-, Medien- oder Consent-Flows

Wenn Dokumentation und bestehender Code widersprüchlich wirken, den Konflikt nicht stillschweigend „auflösen“. Die relevante Abweichung im Arbeitsergebnis klar benennen und nur das ändern, was vom Task gedeckt ist.

## 2. Produktkontext
Bella CRM ist ein maßgeschneidertes CRM für das Beauty-/Lash-Studio **Bella by Sobiella** und keine generische SaaS-Anwendung.

Primärer Workflow:
**Anfrage → Kundinnenprofil → Termin → Behandlung → erledigt → Rechnung → Zahlungsstatus → Archiv → Refill/Follow-up**

Kernmodule:
- Kundinnen
- Termine / Kalender / Kanban
- Rechnungen
- Rechnungsarchiv
- Einstellungen
- Medienfreigabe
- Bestand
- Marketing / Berichte

## 3. Tech-Stack und Architektur
Aktueller Stack:
- Next.js 16 / React 19
- TypeScript
- Tailwind CSS 4
- Prisma 6
- Neon Postgres
- Vercel
- Playwright

Architekturleitbild:
- Modularer Monolith
- Keine unnötigen Microservices
- Bestehende Modulgrenzen respektieren
- Vor neuen Abstraktionen zuerst vorhandene Komponenten, Utilities und Patterns prüfen
- Keine Broad Refactors ohne klaren Nutzen und expliziten Scope

## 4. UX- und Markenregeln
- Sichtbare UI-Sprache: **Deutsch**
- Stil: ruhig, elegant, studio-spezifisch und praktisch
- Markenrichtung: Petrol/Teal mit Roségold-/Kupfer-Akzenten
- Hauptgeräte: Desktop und Tablet
- Mobile darf nicht unbrauchbar werden
- Keine generische SaaS-Optik
- Keine unnötigen Dashboard-Karten oder Erklärungstexte
- Bestehende Designsystem- und Komponentenentscheidungen bevorzugen
- UI-Änderungen immer auf Desktop und Tablet prüfen; Mobile zusätzlich bei betroffenem Layout

### 4a. Installierte Design-Skills und Priorität
Projektlokal installierte Codex-Skills unter `.agents/skills/` dürfen für UI-Arbeit verwendet werden. Ihre Regeln ergänzen dieses Repository, überschreiben aber niemals die Bella-spezifischen Produkt-, Daten-, Rechnungs-, Sicherheits- oder Deployment-Regeln.

Priorität bei Konflikten:
1. Funktionalität, Datenintegrität, Rechnungsregeln, Datenschutz und bestehender Studio-Workflow
2. Diese `AGENTS.md`, `PROJECT_PROFILE.md` und das vorhandene Bella-Designsystem
3. `impeccable` für Audit, Polish, Hardening, Responsive, Accessibility, UX-Klarheit und Designsystem-Treue
4. `redesign-existing-projects` für gezielte Verbesserungen bestehender Oberflächen ohne Rewrite
5. `emil-design-eng`, `animate`, `review-animations`, `improve-animations`, `find-animation-opportunities` für zweckmäßige Motion und Mikrointeraktionen
6. `gpt-taste` nur bei ausdrücklich gewünschter kreativer/experimenteller Gestaltung; seine Marketing-, AIDA-, GSAP-, Scroll-Pinning- und Cinematic-Regeln sind **nicht** Standard für CRM-Arbeitsoberflächen

Zusätzliche Leitplanken:
- Bella CRM ist überwiegend **Operate UI**: Arbeitsgeschwindigkeit, Lesbarkeit und klare Zustände schlagen Show-Effekte.
- Häufig verwendete Aktionen nicht unnötig animieren oder verlangsamen.
- Keine neue Motion-/GSAP-Abhängigkeit allein wegen eines Skills hinzufügen; zuerst prüfen, ob CSS/React/Tailwind ausreichen.
- Bestehende Brandfarben, Typografie, Komponenten und Interaktionsmuster bewahren, sofern der Task keinen Redesign-Auftrag enthält.
- Impeccable-Hook-Funde sind Hinweise zur Prüfung; sie berechtigen nicht zu unrelated Refactors oder automatischen Änderungen außerhalb des Tasks.

## 5. Daten- und Sicherheitsregeln
Bella CRM verarbeitet echte personenbezogene und geschäftsrelevante Daten. Deshalb:
- Kundinnen-, Termin-, Rechnungs- und Consent-Daten nie wie Demo-Daten behandeln
- Keine echten Betriebsdaten löschen, überschreiben oder massenhaft verändern, sofern der Task das nicht ausdrücklich verlangt
- Keine destruktiven DB-Befehle ohne expliziten Auftrag
- Kein `prisma migrate reset`, kein Force-Reset und kein unkontrolliertes `db push` gegen produktionsnahe Daten
- Keine Secrets committen
- Keine `.env`-Dateien mit echten Werten committen
- Serverseitige Secrets niemals in Client-Code oder Browser-Bundles exponieren
- Bestehende Löschschutz- und Archivlogik nicht umgehen
- Datenbankänderungen klein, nachvollziehbar und migrationsfähig halten

## 6. Prisma- und Datenbankregeln
Bei Schema-/DB-Änderungen:
1. Bestehende Relationen und `onDelete`-Semantik prüfen
2. Auswirkungen auf Legacy-Daten berücksichtigen
3. Keine Constraints verschärfen, solange Bestandsdaten nicht geprüft/migriert sind
4. Nach Prisma-Änderungen `npm run db:generate` ausführen
5. Migrationen niemals erzwingen oder Produktion zurücksetzen
6. Änderungen an Rechnungsnummern-/Sequenzlogik besonders kritisch prüfen; race-prone `max(sequence)+1`-Logik nicht neu einführen

Bekannte Besonderheit:
- `Invoice.customerId` kann im DB-Schema aus Legacy-Gründen nullable sein, obwohl App/API neue Rechnungen einer Kundin zuordnen müssen.

## 7. Rechnungsregeln — releasekritisch
Für alle Rechnungsänderungen ist [docs/invoice-rules.md](./docs/invoice-rules.md) maßgeblich.

Insbesondere:
- Neue Rechnungen benötigen auf App/API-Ebene eine `customerId`
- `appointmentId` bleibt optional
- Freie Rechnung = ohne Termin, aber mit Kundin
- Endgültige Rechnungsnummer erst bei Finalisierung
- Entwürfe dürfen keine finale Rechnungsnummer verbrauchen
- Finalisierte Rechnungen nicht stillschweigend inhaltlich überschreiben
- Zahlungsstatus darf separat gepflegt werden
- §19-UStG-Verhalten erhalten
- Vorschau und PDF müssen logisch und visuell konsistent bleiben
- Preview/PDF-Mismatch ist ein Release-Blocker
- A4-Stabilität erhalten

Die vorhandenen Rechnungsstatusfelder (`documentStatus`, `lifecycleStatus`, Legacy-`status`) nicht beiläufig konsolidieren. Nur mit eigenem Auftrag ändern.

## 8. Datenschutz und Medienfreigabe
Für Medien-/Consent-Flows gilt [docs/privacy-media-consent.md](./docs/privacy-media-consent.md).

Grundsätze:
- Medienfreigabe standardmäßig **Nein**
- CRM-Eintrag bedeutet keine automatische Medienfreigabe
- Unklarer Status wird wie keine Freigabe behandelt
- Widerruf muss nachvollziehbar sein und zukünftige Nutzung blockieren können
- Geschäfts- und Rechnungsdaten nicht automatisch wegen Consent-Widerruf löschen

## 9. Arbeitsmodus für Codex
Vor dem Coden:
1. Task und betroffene Flows identifizieren
2. Relevante Dateien und vorhandene Patterns lesen
3. Bestehende Implementierung bevorzugt erweitern statt parallel neu bauen
4. Risiko für Kundendaten, Rechnungen, Auth, DB und Deployment prüfen

Während der Implementierung:
- Kleine, fokussierte Änderungen bevorzugen
- Keine unrelated Cleanup-Refactors
- Keine Abhängigkeiten hinzufügen, wenn vorhandene Mittel ausreichen
- TypeScript-Typen nicht mit unnötigem `any` umgehen
- API-Fehlerfälle mit sauberen, erwartbaren Antworten behandeln
- Bestehende Kernlogik nur ändern, wenn der Task dies erfordert

Nach der Implementierung:
- Geänderte Dateien kurz zusammenfassen
- Risiken/Abweichungen nennen
- Ausgeführte Tests mit Ergebnis nennen
- Nicht ausgeführte Checks mit Grund nennen
- Keine Behauptung „fertig“ oder „grün“, wenn Tests nicht tatsächlich ausgeführt wurden

## 10. Pflicht-Checks
Grundsätzlich vor Abschluss:
1. `npm run lint`
2. `npm run build`, wenn notwendige ENV-Variablen verfügbar sind
3. `npm run db:generate` nach Prisma-/Schema-nahen Änderungen
4. Relevante Playwright-Spezifikationen für den geänderten Bereich

Bei konfliktanfälligen E2E-Tests bevorzugt seriell:
```bash
npx playwright test tests/<datei>.spec.ts --workers=1
```

Tests niemals abschwächen, nur damit sie grün werden.

## 11. Deployment-Regeln
[DEPLOYMENT.md](./DEPLOYMENT.md) ist verbindlich.

Ohne ausdrückliche Freigabe:
- kein Production-Deployment
- keine erzwungenen Migrationen
- keine destruktiven DB-Aktionen
- kein Force Push
- keine Secret-Rotation oder Offenlegung

Preview und Production getrennt behandeln. Erst verifizieren, dann ggf. Production freigeben.

## 12. Git- und Änderungsdisziplin
- Keine fremden/unrelated Änderungen überschreiben
- Keine destruktiven Git-Kommandos zur Bequemlichkeit
- Commits/PRs sollen einen klaren Scope haben
- Größere Features möglichst in nachvollziehbare Teiländerungen zerlegen
- Bei bestehendem PR/Branch dessen Scope respektieren

## 13. Definition of Done
Ein Task gilt erst als abgeschlossen, wenn:
- der gewünschte Flow implementiert ist
- bestehende Kernfunktionen nicht unnötig verändert wurden
- relevante Sicherheits-/Datenrisiken geprüft wurden
- Pflicht-Checks soweit technisch möglich ausgeführt wurden
- UI bei sichtbaren Änderungen auf den relevanten Viewports geprüft wurde
- Rechnungsänderungen Preview/PDF nicht auseinanderlaufen lassen
- Ergebnis, Tests und offene Risiken nachvollziehbar dokumentiert sind
