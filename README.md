# DPM-Plattform – DPM Explorer

Verbindet die EBA-DPM-Datenbank (DPM 2.0, Release 4.4) mit der gewohnten Sicht der Excel-Meldebögen.
Aktueller Umfang: **FINREP (IFRS 9)** und **Asset Encumbrance**.

## Ansichten

| Ansicht | Inhalt |
|---|---|
| **Meldebögen** | Templates im Excel-Look (Spaltenbuchstaben, Zeilennummern, Blattregister, graue Zellen). Klick auf eine Zelle zeigt Position, Datenpunkt (Kennzahl + Dimensionen), gleiche Datenpunkte in anderen Bögen und alle Validierungsregeln – **in Worten**, mit anklickbaren Zellbezügen. |
| **Lineage** | Tabellen-Zusammenhänge über gemeinsame Regeln und die Zell-Lineage einer gewählten Zelle (Zelle → Regeln → verknüpfte Zellen). |
| **Release-Vergleich** | In der Meldebogen-Ansicht „Änderungen seit …“ wählen: neue/entfallene Zellen, grau ↔ meldepflichtig, geänderte Datenpunkt-Definitionen (Kennzahl/Dimensionen), Vorzeichen, Bezeichnungen sowie neue, geänderte und entfallene Regeln – farbig im Bogen und als Änderungsliste. |
| **Datenpunkte** | Facettensuche über alle Datenpunkte nach Kennzahl und Merkmalen (z. B. *Counterparty sector = Households*), mit Sprung in die Zelle. |
| **Hierarchien** | Kategorien und Unterkategorien (Wertelisten und Summenhierarchien) als Baum, inkl. der daraus erzeugten Hierarchie-Regeln und der Meldebögen, die sie nutzen. |
| **DPM-Struktur** | Das Metamodell des DPM erklärt, mit Beispiel aus der gewählten Zelle. |

## Starten

Voraussetzung: Python 3.

```bash
cd web
python -m http.server 8000
```

Danach im Browser <http://localhost:8000> öffnen. Unter Windows reicht ein Doppelklick auf `start.bat`.

## Daten neu erzeugen

Die aufbereiteten Daten liegen bereits in `web/data/`. Nach einem neuen DPM-Export:

```bash
pip install -r requirements.txt
python scripts/build_data.py --raw data/raw/4.4 --out web/data
```

## Aufbau

```
data/raw/4.4/         Parquet-Export der DPM-Datenbank (eine Datei je Tabelle)
scripts/build_data.py Aufbereitung: Layout, Zellen, Datenpunkte, Regeln, Lineage -> JSON
scripts/dpmxl.py      Parser für DPM-XL und Verbalisierung der Regeln (Deutsch)
scripts/build_extras.py Release-Vergleich, Datenpunkt-Index, Hierarchien
web/                  Statische Web-App (kein Build-Schritt), Cytoscape für Graphen
```

## Hinweise zu den Daten

- Instructions und Rechtsgrundlagen sind in der EBA-Datenbank nicht befüllt (`Document`, `Subdivision`, `Reference` leer) und folgen in einem nächsten Schritt.
- Regeln: nur aktive Regeln der aktuellen Version (End-Release offen), Typ „validation“.
