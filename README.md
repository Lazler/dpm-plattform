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

## Bedienung

- **Startseite** mit Kennzahlen je Modul, Release-Änderungen und Einstieg in alle Ansichten.
- **Excel-Verhalten:** fixierte Kopfzeilen und Zeilenspalten, Blattregister, Zoom, Statusleiste.
- **Regel-Ebene** umschaltbar: aus · Fehler-Marker · Heatmap (Anzahl Regeln je Zelle).
- **Detailpanel** mit Reitern: Überblick · Regeln (kompakt, aufklappbar) · Zusammenhänge · Änderungen.
- **Export:** aktueller Bogen als CSV für Excel (je Zelle: Bezeichnungen, Datenpunkt, Dimensionen, Regeln in Worten).
- **Suche:** gleiche Bezeichnungen werden zusammengefasst; `Alt+Enter` öffnet sie als Datenpunkt-Suche.
- **Tastatur:** `/` Suche · Pfeiltasten/Tab Zelle wechseln · `Enter` Details · `Esc` schließen ·
  `Strg+F` im Bogen suchen · `Strg+C` Zellbezug kopieren · `Strg+Bild↑/↓` Blatt wechseln.
- **Browser-Verlauf und Links:** Zurück/Vor funktioniert, jede Zelle hat eine teilbare URL (z. B. `#/F_01.01?r=0110&c=0010`).

## Starten

Voraussetzung: Python 3. Einmalig:

```bash
pip install -r requirements.txt
```

Danach unter Windows Doppelklick auf `start.bat`, sonst:

```bash
python scripts/dev.py
```

Das Skript erzeugt beim ersten Start (und wenn sich Rohdaten oder Skripte ändern) die Daten in `web/data/`,
startet einen lokalen Server und öffnet <http://localhost:8000>. `--rebuild` erzwingt einen Neubau.

Die erzeugten Daten liegen bewusst **nicht** im Git-Repository; sie entstehen lokal bzw. in GitHub Actions.

## Tests

```bash
python -m pytest -q tests           # Parser & Verbalisierung
node tests/smoke.cjs                 # Oberfläche (benötigt Playwright und erzeugte Daten)
```

GitHub Actions führt beides bei jedem Pull Request aus (`.github/workflows/ci.yml`).

## Betrieb in Azure

Siehe [`docs/azure.md`](docs/azure.md): Azure Static Web Apps mit Entra-ID-Login, Deployment über
`.github/workflows/deploy-azure.yml` (aktiv, sobald das Secret `AZURE_STATIC_WEB_APPS_API_TOKEN` hinterlegt ist).

## Aufbau

```
data/raw/4.4/               Parquet-Export der DPM-Datenbank (eine Datei je Tabelle)
scripts/build_data.py       Aufbereitung: Layout, Zellen, Datenpunkte, Regeln, Lineage -> JSON
scripts/build_extras.py     Release-Vergleich, Datenpunkt-Index, Hierarchien
scripts/dpmxl.py            Parser für DPM-XL und Verbalisierung der Regeln (Deutsch)
scripts/import_instructions.py  Import der Instructions aus Word (Tabellen und Freitext)
scripts/dev.py              lokaler Start (Daten erzeugen + Server)
tests/                      Unit-Tests und Rauchtest der Oberfläche
web/                        Statische Web-App (kein Build-Schritt), Cytoscape für Graphen
web/staticwebapp.config.json  Login, Caching und Sicherheits-Header für Azure Static Web Apps
docs/azure.md               Betriebskonzept und Kosten in Azure
```

## Hinweise zu den Daten

- Instructions sind in der EBA-Datenbank nicht befüllt (`Document`, `Subdivision`, `Reference` leer). Sie werden aus den Word-Annexen importiert: Dateien nach `data/instructions/<Release>/` legen, siehe [`docs/instructions.md`](docs/instructions.md).
- Regeln: nur aktive Regeln der aktuellen Version (End-Release offen), Typ „validation“.
