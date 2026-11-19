"""
Import der EBA-Instructions aus Word-Dateien (.docx) und Verknüpfung mit Bögen, Zeilen und Spalten.

    python scripts/import_instructions.py data/instructions/4.4 --meta web/data/meta.json --out web/data/instructions.json

Unterstützte Formen (beliebig gemischt, auch innerhalb einer Datei):

1. Tabellen (z. B. Asset Encumbrance, COREP):
       | Row / Column | Legal references and instructions |
       | 0010         | Carrying amount ... Article 100 CRR ... |
   Die Achse kommt aus der Kopfzeile ("Row", "Column", "Zeile", "Spalte") oder aus der letzten Überschrift
   ("Instructions concerning rows").

2. Freitext (z. B. FINREP Annex V): nummerierte Absätze, die Bögen und Positionen im Text nennen:
       "12. In template 4.3.1, columns 010 to 030 shall include ..."
   Bezüge werden per Muster erkannt; fehlt der Bogen im Absatz, gilt der zuletzt genannte Bogen (Kontext).

Jede Verknüpfung trägt eine Konfidenz (hoch / mittel / niedrig) und die Erkennungsart, damit Fachleute im
Explorer sehen, was sicher und was nur aus dem Kontext abgeleitet ist. Nicht zuordenbare Absätze bleiben
erhalten (Bogen-Ebene bzw. "offen") – das ist der Einstiegspunkt für eine spätere KI-gestützte Zuordnung.
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import json
import os
import re
from dataclasses import dataclass, field

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

# Kurzcodes der Asset-Encumbrance-Bögen (ergänzt um Codes aus den Bogennamen der DPM-Datenbank)
AE_ALIASES = {
    "AE-ASS": "F_32.01", "AE-COL": "F_32.02", "AE-NPL": "F_32.03", "AE-SOU": "F_32.04",
    "AE-MAT": "F_33.00", "AE-CONT": "F_34.00", "AE-CB": "F_35.00", "AE-ADV1": "F_36.01", "AE-ADV2": "F_36.02",
    "AE-ADV-1": "F_36.01", "AE-ADV-2": "F_36.02",
}

RE_FCODE = re.compile(r"\b([FA])\s?(\d{1,2})\.(\d{2})(?:\.(\d))?(?:\.([a-z]))?\b")
RE_TEMPLATE = re.compile(r"\btemplates?\s+(?:F\s?)?(\d{1,2})\.(\d{1,2})(?:\.(\d))?(?:\.([a-z]))?\b", re.I)
RE_ALIAS = re.compile(r"\b(AE-[A-Z]+(?:-?\d)?)\b")
CODE = r"\d{3,4}"
RE_AXIS = re.compile(
    rf"\b(rows?|columns?|sheets?|zeilen?|spalten?)\s+((?:{CODE}(?:\s*(?:-|–|to|bis|and|und|or|oder|,)\s*)?)+)", re.I)
RE_HEADING_AXIS = re.compile(r"\b(rows?|columns?|sheets?|zeilen|spalten)\b", re.I)
RE_LEGAL = re.compile(
    r"(Articles?\s+\d+[a-z]?(?:\(\d+\))*(?:\([a-z]\))?(?:\s+(?:and|to)\s+\d+[a-z]?)?\s+(?:of\s+)?(?:the\s+)?"
    r"(?:CRR|CRD|Regulation\s+\(EU\)\s+(?:No\s+)?\d+/\d+|Directive\s+\d+/\d+/EU|BRRD)"
    r"|\b(?:IFRS|IAS)\s?\d+(?:\.[A-Z]?\d+[A-Z]?)*(?:\([a-z]\))?"
    r"|Annex\s+[IVX]+(?:,?\s+Part\s+\d+)?(?:,?\s+paragraphs?\s+\d+(?:\s*(?:-|to|and)\s*\d+)?)?)",
    re.I)
RE_NUM = re.compile(r"^\s*(\d{1,3}[a-z]?)[.)]\s+")


def norm_code(c: str) -> str:
    c = c.strip()
    return c.zfill(4) if c.isdigit() else c


def axis_of(word: str):
    w = word.lower()
    if w.startswith(("row", "zeile")):
        return "r"
    if w.startswith(("col", "spalte")):
        return "c"
    if w.startswith(("sheet", "blatt")):
        return "s"
    return None


def parse_codes(s: str):
    """'010 to 030, 050 and 060' -> [['0010','0030'], '0050', '0060']"""
    s = re.sub(r"\s*(?:to|bis|–)\s*", "-", s)
    out = []
    for part in re.split(r"\s*(?:,|and|und|or|oder|;)\s*", s):
        part = part.strip()
        if not part:
            continue
        m = re.fullmatch(rf"({CODE})\s*-\s*({CODE})", part)
        if m:
            out.append([norm_code(m.group(1)), norm_code(m.group(2))])
        elif re.fullmatch(CODE, part):
            out.append(norm_code(part))
    return out


def iter_blocks(doc):
    """Absätze und Tabellen in Dokumentreihenfolge."""
    body = doc.element.body
    for child in body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            yield Paragraph(child, doc)
        elif tag == "tbl":
            yield Table(child, doc)


def cell_text(cell):
    return "\n".join(p.text.strip() for p in cell.paragraphs if p.text.strip())


@dataclass
class Ctx:
    table: str | None = None
    axis: str | None = None
    path: list = field(default_factory=list)


class Importer:
    def __init__(self, known_tables: set[str], aliases: dict[str, str]):
        self.known = known_tables
        self.aliases = aliases
        self.items = []
        self.stats = {"absaetze": 0, "tabellenzeilen": 0, "verknuepft": 0, "nur_bogen": 0, "offen": 0}

    # ------------------------------------------------------------- Bogen-Erkennung
    def resolve(self, code):
        """F_32.02 -> F_32.02 (abstrakt, gilt für .a/.b) · F_4.3.1 -> F_04.03.1"""
        if code in self.known:
            return code
        kids = [k for k in self.known if k.startswith(code + ".")]
        return code if kids else None

    def tables_in(self, text):
        found = []
        for m in RE_FCODE.finditer(text):
            code = f"{m.group(1)}_{int(m.group(2)):02d}.{m.group(3)}" + (f".{m.group(4)}" if m.group(4) else "") + (f".{m.group(5)}" if m.group(5) else "")
            r = self.resolve(code)
            if r:
                found.append(r)
        for m in RE_TEMPLATE.finditer(text):
            code = f"F_{int(m.group(1)):02d}.{int(m.group(2)):02d}" + (f".{m.group(3)}" if m.group(3) else "") + (f".{m.group(4)}" if m.group(4) else "")
            r = self.resolve(code)
            if r:
                found.append(r)
        for m in RE_ALIAS.finditer(text):
            r = self.aliases.get(m.group(1).upper())
            if r and self.resolve(r):
                found.append(self.resolve(r))
        return list(dict.fromkeys(found))

    # ------------------------------------------------------------- Speichern
    def add(self, doc_id, ctx, text, label=None, num=None, links=None, how="text"):
        text = text.strip()
        if not text:
            return
        links = links or []
        if links:
            self.stats["verknuepft"] += 1
        elif ctx.table:
            links = [{"t": ctx.table, "ax": None, "codes": [], "conf": "niedrig", "how": "Kontext (Überschrift)"}]
            self.stats["nur_bogen"] += 1
        else:
            self.stats["offen"] += 1
        iid = hashlib.sha1(f"{doc_id}|{len(self.items)}|{text[:80]}".encode()).hexdigest()[:10]
        self.items.append({
            "id": iid, "doc": doc_id, "sec": " › ".join(ctx.path[-3:]), "num": num, "label": label,
            "text": text, "legal": list(dict.fromkeys(x.strip() for x in RE_LEGAL.findall(text)))[:12],
            "links": links, "src": how,
        })

    # ------------------------------------------------------------- Absätze
    def paragraph(self, doc_id, ctx, p):
        text = p.text.strip()
        if not text:
            return
        style = (p.style.name if p.style is not None else "") or ""
        is_heading = style.lower().startswith(("heading", "überschrift", "title")) or (
            len(text) < 140 and not RE_NUM.match(text) and not text.endswith((".", ":", ";")) and
            all(r.bold for r in p.runs if r.text.strip()) and any(r.text.strip() for r in p.runs))
        tabs = self.tables_in(text)
        if is_heading:
            lvl = re.search(r"(\d+)", style)
            level = int(lvl.group(1)) if lvl else len(ctx.path) + 1
            ctx.path = ctx.path[:max(0, level - 1)] + [text]
            if tabs:
                ctx.table, ctx.axis = tabs[0], None
            m = RE_HEADING_AXIS.search(text)
            if m and not RE_AXIS.search(text):
                ctx.axis = axis_of(m.group(1))
            return
        self.stats["absaetze"] += 1
        num = RE_NUM.match(text).group(1) if RE_NUM.match(text) else None
        links = []
        axes = [(axis_of(m.group(1)), parse_codes(m.group(2))) for m in RE_AXIS.finditer(text)]
        axes = [(a, c) for a, c in axes if a and c]
        if tabs:
            for t in tabs:
                if axes:
                    for a, c in axes:
                        links.append({"t": t, "ax": a, "codes": c, "conf": "hoch", "how": "Bogen und Position im Text"})
                else:
                    links.append({"t": t, "ax": None, "codes": [], "conf": "hoch", "how": "Bogen im Text"})
            ctx.table = tabs[-1]
        elif axes and ctx.table:
            for a, c in axes:
                links.append({"t": ctx.table, "ax": a, "codes": c, "conf": "mittel", "how": "Position im Text, Bogen aus Kontext"})
        self.add(doc_id, ctx, text, num=num, links=links)

    # ------------------------------------------------------------- Tabellen
    def table(self, doc_id, ctx, tbl):
        rows = tbl.rows
        if not rows:
            return
        head = [cell_text(c) for c in rows[0].cells]
        head_axis = None
        for h in head[:2]:
            m = RE_HEADING_AXIS.search(h or "")
            if m:
                head_axis = axis_of(m.group(1))
                break
        start = 1 if head_axis or any(re.search(r"instruction|reference|erläuterung", h or "", re.I) for h in head) else 0
        axis = head_axis or ctx.axis or "r"
        # Tabelle selbst kann den Bogen nennen (z. B. Titelzeile)
        for h in head:
            t = self.tables_in(h or "")
            if t:
                ctx.table = t[0]
        for row in rows[start:]:
            cells = [cell_text(c) for c in row.cells]
            # verbundene Zellen liefern Duplikate
            cells = [c for i, c in enumerate(cells) if i == 0 or c != cells[i - 1]]
            if not cells:
                continue
            codes = parse_codes(cells[0]) if re.match(rf"^\s*{CODE}", cells[0] or "") else []
            text = "\n".join(cells[1:] if codes else cells).strip()
            if not text:
                continue
            self.stats["tabellenzeilen"] += 1
            first, _, rest = text.partition("\n")
            label = first if rest and len(first) < 200 else None
            body = rest if label else text
            links = []
            if codes and ctx.table:
                links.append({"t": ctx.table, "ax": axis, "codes": codes, "conf": "hoch", "how": "Tabelle (Code-Spalte)"})
            elif codes:
                links = []  # Codes ohne bekannten Bogen -> offen
            self.add(doc_id, ctx, body, label=label, num=cells[0] if codes else None, links=links, how="tabelle")

    # ------------------------------------------------------------- Datei
    def run(self, path):
        doc = Document(path)
        doc_id = os.path.splitext(os.path.basename(path))[0]
        ctx = Ctx()
        n0 = len(self.items)
        for block in iter_blocks(doc):
            if isinstance(block, Paragraph):
                self.paragraph(doc_id, ctx, block)
            else:
                self.table(doc_id, ctx, block)
        return {"id": doc_id, "file": os.path.basename(path), "items": len(self.items) - n0,
                "title": (doc.core_properties.title or doc_id)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", help="Ordner mit .docx-Dateien oder einzelne Datei")
    ap.add_argument("--meta", default="web/data/meta.json")
    ap.add_argument("--out", default="web/data/instructions.json")
    a = ap.parse_args()
    meta = json.load(open(a.meta, encoding="utf-8"))
    known = {t["code"] for m in meta["modules"] for t in m["tables"]}
    aliases = dict(AE_ALIASES)
    for m in meta["modules"]:
        for t in m["tables"]:
            for al in re.findall(r"\(([A-Z]+-[A-Z0-9-]+)\)", t["name"]):
                aliases[al] = t["code"]
    files = sorted(glob.glob(os.path.join(a.src, "*.docx"))) if os.path.isdir(a.src) else [a.src]
    files = [f for f in files if not os.path.basename(f).startswith("~$")]
    imp = Importer(known, aliases)
    docs = [imp.run(f) for f in files]
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump({"docs": docs, "items": imp.items, "stats": imp.stats}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Instructions: {len(files)} Datei(en), {len(imp.items)} Einträge, {imp.stats}")


if __name__ == "__main__":
    main()
