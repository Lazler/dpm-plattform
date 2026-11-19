# Instructions (Word-Dateien der EBA)

Hier die Word-Dateien (`.docx`) mit den Instructions ablegen – je Release ein Unterordner, z. B.:

```
data/instructions/4.4/Annex V - FINREP instructions.docx
data/instructions/4.4/Annex XVII - Asset encumbrance instructions.docx
```

Beim nächsten `start.bat` / `python scripts/dev.py` (bzw. in GitHub Actions) werden sie automatisch eingelesen
(`scripts/import_instructions.py`) und im Explorer pro Zeile, Spalte und Bogen angezeigt.

- **Tabellen** (z. B. Asset Encumbrance: „Rows | Legal references and instructions“) werden über die Code-Spalte zugeordnet.
- **Freitext** (z. B. FINREP Annex V) wird über Bezüge im Text zugeordnet („template 4.3.1, columns 010 to 030“);
  fehlt der Bogen im Absatz, gilt der zuletzt genannte Bogen bzw. die Überschrift.
- Jede Zuordnung hat eine Konfidenz (hoch / mittel / niedrig) – im Explorer sichtbar.

Ältere `.doc`-Dateien bitte vorher in Word als `.docx` speichern. PDFs werden noch nicht unterstützt.
