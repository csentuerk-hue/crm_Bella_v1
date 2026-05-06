# PLAN.md — Bella CRM

## Ziel

Bella CRM soll einen klaren, modernen und platzsparenden CRM-Aufbau bekommen.

Diese Umbauphase umfasst:

1. Eine globale linke Icon-/Kachelleiste ohne sichtbaren Text
2. Eine überarbeitete Kundinnen-Seite mit festem 3-Bereich-Aufbau
3. Erhalt aller bestehenden Kernfunktionen

---

## Pflichtstruktur

### Globale linke Leiste
- fest links
- sehr schmal
- Logo oben
- darunter nur Icons / Kacheln
- kein Text in der Leiste
- auf allen CRM-Seiten identisch

### Kundinnen-Seite
- links: Live-Suche + Kundinnenliste
- mitte: Profilbereich
- direkt darunter: Aktions-Icons
- darunter: Notiz / Inhalte / Verlauf
- rechts: feste Info-Spalte

---

## Phase 1 — Analyse
Vor Änderungen identifizieren:
- globale Shell / Layout-Datei
- Sidebar / Navigation
- Kundinnen-Seite
- Datenquellen / Hooks / Queries / Mutations
- Such-, Bearbeiten- und Archivieren-Logik

Ausgeben:
- welche Datei die Shell bestimmt
- welche Datei die Navigation bestimmt
- welche Datei die Kundinnen-Seite bestimmt

---

## Phase 2 — Plan
Vor Implementierung festlegen:
- welche Dateien geändert werden
- welche Komponenten refaktoriert werden
- welche neuen Komponenten nötig sind
- wie die globale Leiste technisch auf allen Seiten erhalten bleibt
- wie der 3-Bereich-Aufbau umgesetzt wird

---

## Phase 3 — Globale Leiste umsetzen
Pflicht:
- feste globale linke Leiste
- icon-only
- kein sichtbarer Text
- gleiche Leiste auf allen CRM-Seiten
- aktive Zustände funktionieren
- Routing bleibt intakt

---

## Phase 4 — Kundinnen-Seite umbauen
Pflicht:
- links Kundinnenliste mit Live-Suche
- mitte Profilbereich
- direkt darunter Aktions-Icons
- darunter Notiz/Inhalte/Verlauf
- rechts feste Info-Spalte

Nicht zulässig:
- nur optisch verbesserte Tabelle
- fehlende rechte Info-Spalte
- fehlende Aktions-Icons unter dem Profil

---

## Phase 5 — Validierung
Prüfen:
- Build erfolgreich
- Navigation funktioniert
- linke Leiste bleibt global identisch
- kein Text in der linken Leiste
- Live-Suche funktioniert
- Kundin auswählen funktioniert
- Bearbeiten funktioniert
- Archivieren funktioniert
- Kundinnen-Seite wirkt nicht mehr wie Standardtabelle

---

## Erfolgskriterien

Die Aufgabe ist erst fertig, wenn:
- die linke Leiste global gleich bleibt
- die Leiste rein icon-only ist
- die Kundinnen-Seite exakt links / mitte / rechts aufgebaut ist
- die Aktions-Icons direkt unter dem Profil sitzen
- die rechte Info-Spalte vorhanden ist
- bestehende Kernfunktionen weiter laufen

---

## Abschlussbericht

Nach Umsetzung immer ausgeben:
1. Geänderte Dateien
2. Neue Komponenten
3. Refaktorierte Komponenten
4. Wie die globale Icon-Leiste umgesetzt wurde
5. Wie die Kundinnen-Seite in links / mitte / rechts umgesetzt wurde
6. Welche Funktionen getestet wurden
7. Offene Punkte
8. Was man manuell prüfen soll

## Zusatzregel für diese Umbauphase

Wenn das sichtbare Ergebnis nach der Umsetzung noch weitgehend wie der alte UI-Stand aussieht, muss die UI-Komposition aktiv neu aufgebaut werden statt weiter vorsichtig refaktoriert zu werden.

Für diese Phase ist ausdrücklich ein sichtbarer UI-Neuaufbau geschuldet:
- alte breite Sidebar ersetzen
- globale icon-only Leiste sichtbar durchsetzen
- tabellarische Kundinnen-Darstellung als Hauptansicht ablösen
- 3-Bereich-Aufbau sichtbar herstellen