# Instructions anbinden – Konzept

## Ausgangslage

Die EBA veröffentlicht die Instructions als Word-Annexe – je Framework unterschiedlich aufgebaut:

| Form | Beispiel | Zuordnung |
|---|---|---|
| **Tabellen** je Bogen: „Row/Column \| Legal references and instructions“ | Asset Encumbrance, COREP | eindeutig über die Code-Spalte |
| **Freitext** mit nummerierten Absätzen und Bezügen im Text | FINREP Annex V („template 4.3.1, columns 010 to 030 …“) | über Muster im Text, sonst über Kontext |
| **Allgemeine Abschnitte** ohne Positionsbezug | Definitionen, Konsolidierungskreis | Bogen- oder Framework-Ebene |

## Stufe 1 – regelbasiert (umgesetzt: `scripts/import_instructions.py`)

1. Word-Datei in Dokumentreihenfolge lesen (Absätze **und** Tabellen).
2. Kontext mitführen: aktueller Bogen (aus Überschriften, „F 32.01“, „template 4.3.1“, Kurzcodes wie „AE-ASS“) und
   aktuelle Achse („Instructions concerning rows/columns“).
3. Tabellenzeilen: Code-Spalte → Zeile/Spalte (inkl. Bereiche „030-050“). Konfidenz **hoch**.
4. Freitext: Bezüge „row(s)/column(s) 010 to 030, 050 and 060“ erkennen; Bogen im Absatz → **hoch**,
   Bogen nur aus Kontext → **mittel**, gar kein Positionsbezug → Bogen-Ebene **niedrig**.
5. Rechtsgrundlagen herausziehen (Artikel CRR/CRD, IFRS/IAS-Paragraphen, Annex-Verweise).
6. 3-stellige Codes der Annexe (010) werden auf die 4-stelligen DPM-Codes (0010) normalisiert.

Ergebnis: `web/data/instructions.json` – jeder Absatz mit Quelle, Gliederung, Text, Rechtsgrundlagen und
Verknüpfungen samt Konfidenz. Der Explorer zeigt sie im Reiter **Instructions** je Zelle (Zeile · Spalte · Bogen).

## Stufe 2 – KI-gestützte Zuordnung (später)

Für alles, was Stufe 1 nicht sicher zuordnet (Konfidenz mittel/niedrig, „offen“):

1. **Kandidaten bilden** (deterministisch): Bogen aus Kontext, Zeilen/Spalten, deren Bezeichnungen im Absatz vorkommen.
2. **KI-Vorschlag** (Azure OpenAI): Absatz + Kandidaten mit Bezeichnungen → strukturierte Antwort
   `{bogen, achse, codes, begruendung}`. Keine freie Erfindung: nur Codes aus der Kandidatenliste sind zulässig.
3. **Prüfen** gegen das DPM (existiert der Code?) und Konfidenz „KI-Vorschlag“.
4. **Freigabe** im Admin-Bereich durch Fachleute; Korrekturen werden gespeichert und beim nächsten Release
   wiederverwendet (gleicher Absatztext → gleiche Zuordnung).

Zusätzlich sinnvoll:
- **Release-Vergleich der Instructions:** Absätze über Nummer und Textähnlichkeit zuordnen, Änderungen als
  redaktionell oder inhaltlich einstufen (KI), im Release-Vergleich des Explorers anzeigen.
- **Stabile Schlüssel:** Verknüpfungen hängen an Bogen-/Zeilen-/Spalten-Codes, nicht an DPM-IDs – sie überleben
  neue Releases.
- **MCP-Server:** `explain_cell` liefert die Instructions mit Quelle und Absatznummer, damit Antworten belegbar sind.
