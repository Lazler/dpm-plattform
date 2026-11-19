# Neues DPM-Release einspielen

Ziel: Ein neues EBA-Release (z. B. 4.5) erscheint – der Explorer passt sich ohne Code-Änderung an.

## Ablauf

1. **Export:** Die neue Access-Datenbank wie bisher mit dem Export-Skript nach Parquet exportieren
   (eine Datei je Tabelle, inkl. `manifest.json`).
2. **Ablegen:** Ordner `data/raw/<Release>/` anlegen (z. B. `data/raw/4.5/`) und die Parquet-Dateien hineinlegen.
   Optional die Word-Instructions nach `data/instructions/<Release>/`.
3. **Prüfen lassen:** Auf einem neuen Branch committen und einen Pull Request gegen `main` öffnen.
   - GitHub Actions baut die Daten aus dem **jüngsten** Ordner unter `data/raw`, führt Tests und den Oberflächentest aus.
   - Mit hinterlegtem Azure-Token entsteht automatisch eine **Testumgebung** mit eigener URL (Link im Pull Request).
4. **Fachlich prüfen:** In der Testumgebung u. a. Startseite (Änderungen seit dem Vorgänger-Release),
   Release-Vergleich je Bogen und Stichproben von Zellen ansehen.
5. **Freigeben:** Pull Request mergen → Produktivumgebung wird aktualisiert, Testumgebung entfernt.

Lokal geht Schritt 3 auch ohne GitHub: `start.bat` bzw. `python scripts/dev.py` erkennt den neuen Ordner und baut neu.

## Was automatisch passiert

| Bereich | Verhalten bei neuem Release |
|---|---|
| Release-Ordner | jüngster Ordner unter `data/raw` wird verwendet (numerisch sortiert: 4.10 > 4.9) |
| Module | aktuelle Modulversion je Modulcode (`FINREP9`, `AE`) wird aus der Datenbank ermittelt |
| Bögen, Zellen, Regeln, Hierarchien | vollständig neu aus den Daten erzeugt |
| Release-Vergleich | Vergleich gegen **alle** früheren Releases der Datenbank, inkl. Trennung technisch / inhaltlich |
| Instructions | Import aus `data/instructions/<Release>/`, sonst aus `data/instructions/` |

## Weitere Module aufnehmen

`python scripts/build_data.py --modules FINREP9,AE,<weiterer Modulcode>` – bzw. den Eintrag in `MODULE_CODES`
in `scripts/build_data.py` ergänzen. Die Oberfläche passt Modulauswahl, Inhaltsverzeichnis und Suche automatisch an.

## Grenzen (Stand heute)

- Der Export Access → Parquet läuft noch auf eurem Rechner (Windows-ODBC-Treiber). Ein Upload im Browser mit
  serverseitiger Konvertierung ist Teil der späteren Admin-Funktion (siehe `docs/azure.md`, Stufe 2).
- Jedes Release liegt mit ca. 110 MB Parquet im Git. Ab dem zweiten Release besser Git LFS oder Azure Blob Storage.
- Ändert die EBA das Datenbankschema (neue/umbenannte Tabellen oder Spalten), muss die Aufbereitung angepasst
  werden; der Build bricht dann mit einer klaren Fehlermeldung ab, statt still falsche Daten zu erzeugen.
