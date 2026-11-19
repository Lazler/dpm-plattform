"""Tests für den Instructions-Import mit synthetischen Word-Dateien (Texte frei erfunden, keine EBA-Originale)."""
import json
import os
import subprocess
import sys

import pytest

docx = pytest.importorskip("docx")

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from import_instructions import Importer, parse_codes  # noqa: E402

KNOWN = {"F_01.01", "F_04.03.1", "F_18.00", "F_18.00.a", "F_18.00.b", "F_32.01", "F_32.02", "F_32.02.a", "F_32.02.b"}


def finrep_doc(path):
    d = docx.Document()
    d.add_heading("Part 2 – Template related instructions", 1)
    d.add_heading("Breakdown of financial assets by instrument (F 04.03.1)", 2)
    d.add_paragraph("12. In template 4.3.1, columns 010 to 030 shall include the gross carrying amount as defined in IFRS 9.5.4.1.")
    d.add_paragraph("13. Rows 0050 and 0060 shall include debt securities held by the institution, see Article 4(1) CRR.")
    d.add_paragraph("14. General remark without explicit position.")
    d.add_heading("Performing and non-performing exposures (F 18.00)", 2)
    d.add_paragraph("15. Column 0010 of template F 18.00 shall report the gross carrying amount (Annex V, Part 2, paragraph 34).")
    d.save(path)


def ae_doc(path):
    d = docx.Document()
    d.add_heading("F 32.01 – Assets of the reporting institution (AE-ASS)", 1)
    d.add_heading("Instructions concerning specific rows", 2)
    t = d.add_table(rows=3, cols=2)
    t.rows[0].cells[0].text, t.rows[0].cells[1].text = "Rows", "Legal references and instructions"
    t.rows[1].cells[0].text = "010"
    t.rows[1].cells[1].text = "Assets of the reporting institution\nArticle 100 CRR. Total assets as reported in the balance sheet."
    t.rows[2].cells[0].text = "030-050"
    t.rows[2].cells[1].text = "Equity instruments\nDescription for a range of rows."
    d.add_heading("AE-COL template: collateral", 1)
    d.add_heading("Instructions concerning columns", 2)
    t2 = d.add_table(rows=2, cols=2)
    t2.rows[0].cells[0].text, t2.rows[0].cells[1].text = "Columns", "Legal references and instructions"
    t2.rows[1].cells[0].text = "0010"
    t2.rows[1].cells[1].text = "Fair value of encumbered collateral received\nShort description."
    d.save(path)


def run(tmp_path, maker):
    p = tmp_path / "doc.docx"
    maker(p)
    imp = Importer(KNOWN, {"AE-ASS": "F_32.01", "AE-COL": "F_32.02"})
    imp.run(str(p))
    return imp


def test_codes():
    assert parse_codes("010 to 030, 050 and 060") == [["0010", "0030"], "0050", "0060"]
    assert parse_codes("0010-0030") == [["0010", "0030"]]


def test_finrep_freitext(tmp_path):
    imp = run(tmp_path, finrep_doc)
    it = {i["num"]: i for i in imp.items}
    l12 = it["12"]["links"][0]
    assert l12["t"] == "F_04.03.1" and l12["ax"] == "c" and l12["codes"] == [["0010", "0030"]] and l12["conf"] == "hoch"
    l13 = it["13"]["links"][0]
    assert l13["t"] == "F_04.03.1" and l13["ax"] == "r" and l13["codes"] == ["0050", "0060"] and l13["conf"] == "mittel"
    assert it["14"]["links"][0]["ax"] is None and it["14"]["links"][0]["conf"] == "niedrig"
    l15 = it["15"]["links"][0]
    assert l15["t"] == "F_18.00" and l15["ax"] == "c" and l15["codes"] == ["0010"]
    assert any("IFRS 9.5.4.1" in x for x in it["12"]["legal"])
    assert any("Article 4(1) CRR" in x for x in it["13"]["legal"])


def test_ae_tabellen(tmp_path):
    imp = run(tmp_path, ae_doc)
    by_label = {i["label"]: i for i in imp.items}
    a = by_label["Assets of the reporting institution"]["links"][0]
    assert a == {"t": "F_32.01", "ax": "r", "codes": ["0010"], "conf": "hoch", "how": "Tabelle (Code-Spalte)"}
    b = by_label["Equity instruments"]["links"][0]
    assert b["codes"] == [["0030", "0050"]]
    c = by_label["Fair value of encumbered collateral received"]["links"][0]
    assert c["t"] == "F_32.02" and c["ax"] == "c"


def test_cli(tmp_path):
    src = tmp_path / "in"
    src.mkdir()
    ae_doc(src / "ae.docx")
    finrep_doc(src / "finrep.docx")
    meta = tmp_path / "meta.json"
    meta.write_text(json.dumps({"modules": [{"tables": [{"code": c, "name": "x"} for c in KNOWN]}]}))
    out = tmp_path / "instructions.json"
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "import_instructions.py"), str(src), "--meta", str(meta), "--out", str(out)], check=True)
    data = json.loads(out.read_text())
    assert len(data["docs"]) == 2 and data["stats"]["tabellenzeilen"] == 3
