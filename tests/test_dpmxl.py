"""Tests für Parser und Verbalisierung der DPM-XL-Regeln (laufen ohne Datenbank)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

import pytest  # noqa: E402

from dpmxl import Verbalizer, parse  # noqa: E402

LABELS = {
    ("F_01.01", "r", "0100"): ("Financial assets designated at FVTPL", "Total assets › Financial assets designated at FVTPL", "Financial assets designated at FVTPL"),
    ("F_01.01", "r", "0110"): ("Equity instruments", "… › Equity instruments", "Equity instruments"),
    ("F_01.01", "r", "0120"): ("Debt securities", "… › Debt securities", "Debt securities"),
    ("F_01.01", "r", "0130"): ("Loans and advances", "… › Loans and advances", "Loans and advances"),
    ("F_01.01", "c", "0010"): ("Carrying amount", "Carrying amount", "Carrying amount"),
}


class Labels:
    def header(self, t, axis, c):
        return LABELS.get((t, axis, c))

    def codes(self, t, axis):
        return sorted(c for (tt, a, c) in LABELS if tt == t and a == axis)

    def item(self, s):
        return {"eba_qAS:qx2004": "IFRS"}.get(s)

    def prop(self, s):
        return None

    def table_name(self, t):
        return "Balance Sheet Statement" if t == "F_01.01" else None


def text(segs):
    return "".join(s if isinstance(s, str) else s["text"] for s in segs)


V = Verbalizer(Labels())


def test_summenregel_mit_scope():
    out = text(V.rule("with {tF_01.01, c0010, default: 0, interval: true}: {r0100} = {r0110} + {r0120} + {r0130}"))
    assert out.startswith("In F 01.01, Spalte „Carrying amount“ (c0010): ")
    assert "muss gleich der Summe aus" in out
    assert "„Equity instruments“ (r0110)" in out and "„Loans and advances“ (r0130)" in out
    assert out.endswith("sein.")


def test_vergleich_und_artikel():
    out = text(V.rule("with {default: 0}: sum({tF_01.01, (r0110, r0120), c0010}) <= {tF_01.01, r0100, c0010}"))
    assert out.startswith("Die Summe über")
    assert "darf nicht größer sein als" in out


def test_vorzeichenregel_mehrere_zeilen():
    out = text(V.rule("with {tF_01.01, c0010, default: null, interval: false}: {(r0110, r0120, r0130)} >= 0"))
    assert "jeder Wert in" in out and "darf nicht kleiner sein als 0" in out


def test_wenn_dann_mit_item():
    out = text(V.rule('with {interval: true}: if ( {tF_00.01, r0010, c0010, default: ""} = [eba_qAS:qx2004] ) then ( {tF_01.01, r0100, c0010} >= 0 ) endif'))
    assert out.startswith("Wenn ") and "gleich „IFRS“ ist" in out and "dann gilt:" in out


def test_vorbedingung():
    out = text(V.precondition("{v_F_18.00} and ( {v_F_04.09} or {v_F_04.10} )"))
    assert out == "F 18.00 und (F 04.09 oder F 04.10)"


def test_navigation_auf_einzelzelle():
    segs = V.rule("with {tF_01.01, c0010}: {r0100} = {r0110}")
    refs = [s["ref"] for s in segs if isinstance(s, dict) and s.get("ref") and s["ref"].get("r")]
    assert {"t": "F_01.01", "r": "0110", "c": "0010"} in refs


@pytest.mark.parametrize("expr", [
    "with {tF_20.01, c*, default: 0, interval: true}: {r0175} = sum ({r0176-0178} group by c)",
    "with {default: 0}: sum ({tC_09.01.a, r0095} [ where CEG = [eba_GA:qx2014] ]) = sum ({tC_07.00.a, r0020} [ where qEBB in {[eba_qEC:qx2037]}])",
    "with {tF_18.00.b, (c0130, c0150), default: 0, interval: true}: abs({r0226}) >= abs({r0920})",
    "{tF_01.01, r0100, c0010} != 0 and not(isnull({tF_01.01, r0110, c0010}))",
])
def test_parser_akzeptiert_typische_ausdruecke(expr):
    parse(expr)
    assert text(V.rule(expr))
