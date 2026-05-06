# AGENTS.md — Bella CRM

## Mission

Bella CRM ist ein Beauty-/Studio-CRM für eine Soloselbstständige.
Das Produkt soll hochwertig, klar, platzsparend, alltagstauglich und tabletfreundlich wirken.

Arbeite immer so, dass bestehende Kernfunktionen erhalten bleiben, aber die sichtbare Struktur konsequent verbessert wird.
Kein Demo-Verhalten. Kein vorsichtiges Mini-Restyling, wenn ein echter Layout-Umbau gefordert ist.

---

## Product context

Die App ist kein generisches Agentur-CRM.
Sie ist ein CRM für ein Beauty-Studio.

Verwende in UI, Komponenten und Benennungen bevorzugt Begriffe wie:
- Kundinnen
- Termine
- Rechnungen
- Behandlungen
- Bestand
- Marketing
- Berichte
- Einstellungen
- Studio

Vermeide als Hauptsprache:
- Leads
- Funnels
- Sales pipeline
- Team performance
- Agents

Hinweis:
Die Nutzerin ist soloselbstständig.
Mitarbeiter-/Teamfunktionen dürfen bestehende Logik behalten, aber nicht als Hauptbereich im UI priorisiert werden.

---

## Global execution rules

1. Keine Parallel-App bauen  
Nutze die bestehende App-Struktur, bestehende Datenquellen, bestehende Routing-Logik und bestehende Kernkomponenten weiter.

2. Keine Fake-UI bauen  
Keine funktionslosen Kacheln, keine statischen Demo-Daten als Ersatz für echte bestehende Daten.

3. Keine kosmetische Scheinlösung  
Wenn ein Layout-Umbau verlangt wird, reichen Farben, Padding, Kartenstil oder Sidebar-Politur allein nicht aus.

4. Bestehende Kernlogik erhalten  
Insbesondere:
- Navigation
- Routing
- aktive Zustände
- Kundinnen-Suche
- Bearbeiten
- Archivieren
- Termine
- Rechnungen
- Speichern
- Drucken
- Statusänderungen

5. Erst analysieren, dann umbauen  
Vor größeren UI-Änderungen immer zuerst:
- globale Shell finden
- Layout-Dateien identifizieren
- betroffene Seiten finden
- Datenquellen prüfen
- dann erst implementieren

6. Änderungen validieren  
Nach Umsetzung immer Build, Navigation und betroffene Kernseiten prüfen.
Codex soll Terminal/Build/Test-Schritte aktiv nutzen, um Änderungen zu validieren. :contentReference[oaicite:1]{index=1}

---

## Mandatory workflow for layout tasks

Bei jeder Aufgabe, die Navigation, Shell, Dashboard, Kundinnen-Seite oder Seitenaufbau betrifft, gilt dieser Ablauf zwingend:

### Phase 1 — Analyse
Identifiziere zuerst:
- globale App-Shell
- Root-/Layout-Dateien
- Sidebar-/Navigation-Dateien
- Seiten-Dateien
- Datenquellen / Hooks / Queries / Mutations
- bestehende Modals / Panels / Detailbereiche

### Phase 2 — Plan
Lege vor Implementierung fest:
- welche Dateien geändert werden
- welche Komponenten refaktoriert werden
- welche neuen Komponenten wirklich nötig sind
- wie bestehende Funktionen erhalten bleiben
- welche Tests danach laufen müssen

### Phase 3 — Implementierung
Setze erst danach um.

### Phase 4 — Validierung
Prüfe danach:
- Build erfolgreich
- Navigation intakt
- betroffene Seiten rendern korrekt
- Kernfunktionen weiter nutzbar
- kein rein kosmetischer Output

### Phase 5 — Abschlussbericht
Gib immer konkret aus:
- geänderte Dateien
- neue Komponenten
- refaktorierte Komponenten
- erhaltene Funktionen
- getestete Workflows
- offene Punkte

---

## Mandatory workflow for invoice tasks

Bei allen Aufgaben rund um Rechnung, Vorschau, Druck, Bearbeitung:

1. Vorschau ist Standardansicht
2. Bearbeitung nur nach aktivem Klick auf "Bearbeiten"
3. Zeige sofort verständliche Daten:
- Kundinnenname
- Leistung / Behandlung
- Rechnungsnummer
- Datum
4. Keine technischen IDs als primäre Nutzeranzeige
5. Druckfunktion darf nicht verschlechtert werden
6. Vorschau und Druckansicht müssen konsistent sein
7. Keine unnötigen Footer-Hinweise oder generischen Platzhalter im Rechnungsdokument

---

## Mandatory global navigation rules

Die linke CRM-Navigation ist global und auf allen CRM-Seiten identisch.

### Pflichtregeln
- immer feste linke Leiste
- immer sehr schmal
- Logo oben
- darunter nur Icon-/Kachel-Navigation
- kein sichtbarer Text in der Leiste
- kein Text rechts neben Icons
- kein Text unter Icons in der Leiste
- keine hybride Icon-Text-Sidebar
- keine breite Standard-Sidebar

### Erlaubt
- Tooltip bei Hover
- aktiven Zustand klar hervorheben
- Platzierung aktiver Seitentitel außerhalb der Leiste

### Nicht erlaubt
- pro Seite andere Sidebar
- pro Seite andere Breite
- Textnavigation in der Leiste
- Aufgabe als erledigt markieren, wenn die Navigation nur etwas hübscher wurde

### Definition of done für Navigation
Eine Navigationsaufgabe ist erst erledigt, wenn:
- die Leiste global identisch bleibt
- sie icon-only ist
- sie platzsparend ist
- aktive Zustände funktionieren
- Routing korrekt weiterläuft

---

## Mandatory customer page layout rules

Die Kundinnen-Seite darf nicht frei interpretiert werden.

Pflichtlayout:

### 1. Linke innere Spalte
Kundinnenliste mit:
- Live-Suche oben
- filterbarer Liste darunter
- aktive Kundin sichtbar markiert
- scannbare Einträge

### 2. Mittlere Hauptspalte
Kundinnenprofil mit:
- Profil/Kopfbereich oben
- direkt darunter sichtbare Aktions-Icons
- darunter Notiz, Inhalte, Verlauf, relevante Daten

### 3. Rechte Spalte
Feste Info-Seite / Infoleiste mit:
- Zusatzinfos
- Status
- Termine
- Rechnungsinfos
- Meta-Daten
- sonstige nützliche CRM-Infos

### Nicht erlaubt
- reine Standardtabelle als Hauptansicht
- nur optisch verbesserte Tabelle
- fehlende rechte Info-Spalte
- fehlende Aktions-Icons unter dem Profil
- freie Interpretation in nur 1 oder 2 Spalten

### Definition of done für Kundinnen-Seite
Die Kundinnen-Seite ist erst erledigt, wenn:
- links Liste mit Live-Suche existiert
- Mitte Profilbereich existiert
- Aktions-Icons direkt unter dem Profil sitzen
- darunter Notiz/Inhalte sichtbar sind
- rechts feste Info-Spalte existiert
- die Seite nicht mehr wie eine Standardtabelle wirkt

---

## Refactoring policy

Bevor neue Komponenten erstellt werden:
1. prüfe, ob eine bestehende Komponente refaktoriert werden kann
2. dupliziere keine Datenlogik
3. dupliziere keine Routing-Logik
4. erhalte nützliche bestehende Komponenten, wenn sinnvoll

Neue Komponenten nur erstellen, wenn:
- die bestehende Struktur den Zielaufbau wirklich behindert
- eine Wiederverwendung unklar oder unwartbar wäre

---

## Testing and validation

Nach jeder relevanten Änderung ausführen, sofern im Repo vorhanden:
- Install-/Build-Befehl
- Lint
- Test- oder Typprüfung
- relevanten Dev-Flow prüfen

Zusätzlich manuell validieren:
- Sidebar global sichtbar
- Navigation funktioniert
- Kundinnen-Seite korrekt aufgebaut
- Suche funktioniert
- Bearbeiten funktioniert
- Archivieren funktioniert
- Rechnungsvorschau / Druck weiter nutzbar, falls betroffen

OpenAI empfiehlt, Codex zur Validierung Terminal und Skripte nutzen zu lassen; außerdem funktionieren klare Evaluations-/Scoring-Schleifen besser bei schwierigen Aufgaben. :contentReference[oaicite:2]{index=2}

---

## Completion rules

Eine Aufgabe gilt NICHT als erledigt, wenn:
- nur Styling geändert wurde
- die globale Shell gleich geblieben ist
- die linke Leiste noch sichtbaren Text enthält
- die Kundinnen-Seite weiter hauptsächlich tabellarisch ist
- die rechte Info-Spalte fehlt
- Aktions-Icons nicht direkt unter dem Profil sitzen
- Build oder Navigation nicht geprüft wurden

Eine Aufgabe gilt ERST als erledigt, wenn:
- die sichtbare Struktur dem geforderten Aufbau entspricht
- die Kernfunktionen intakt bleiben
- Validierung durchgeführt wurde
- ein klarer Abschlussbericht vorliegt

---

## Required final report format

Antworte nach Umsetzung immer mit:

1. Geänderte Dateien
2. Neu erstellte Komponenten
3. Refaktorierte bestehende Komponenten
4. Erhaltene Kernfunktionen
5. Durchgeführte Validierungen
6. Offene Punkte / Risiken
7. Manuelle Testschritte für den Nutzer

## UI replacement rule

Wenn die sichtbare Oberfläche trotz Änderungen noch weitgehend wie der alte Stand aussieht, gilt die Aufgabe nicht als Refactor, sondern als fehlgeschlagene UI-Ersetzung.

In diesem Fall:
- die alte sichtbare Struktur nicht weiter polieren
- die UI-Komposition neu aufbauen
- bestehende Logik darunter weiterverwenden
- sichtbare Shell, Navigation und Seitenaufbau aktiv ersetzen

Für Bella CRM gilt:
- globale linke Navigation ist icon-only ohne sichtbaren Text
- die Kundinnen-Seite ist kein Tabellen-Refactor, sondern ein echter 3-Bereich-Arbeitsbereich