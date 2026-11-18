"""
Erzeugt die Daten für den DPM-Explorer aus dem Parquet-Export.

    python scripts/build_data.py            # Standard: AE + FINREP9, Release 4.4
    python scripts/build_data.py --raw data/raw/4.4 --out web/data

Ausgabe (JSON, wird von web/ geladen):
    meta.json            Module, Tabellen, Kennzahlen, Metamodell-Zählungen
    tables/<Code>.json   Layout eines Meldebogens inkl. Zellen, Datenpunkte, Regel-IDs
    rules.json           Validierungsregeln inkl. verbalisierter Fassung
    lineage.json         Verknüpfungen zwischen Tabellen über Regeln
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict

import duckdb

sys.path.insert(0, os.path.dirname(__file__))
from dpmxl import ParseError, Verbalizer, tcode  # noqa: E402

MODULES = {457: "AE", 462: "FINREP9"}  # ModuleVID -> Kürzel (aktuelle Versionen in Release 4.4)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default="data/raw/4.4")
    ap.add_argument("--out", default="web/data")
    args = ap.parse_args()

    con = duckdb.connect()
    for f in os.listdir(args.raw):
        if f.endswith(".parquet"):
            con.execute(f'create view "{f[:-8]}" as select * from read_parquet(\'{args.raw}/{f}\')')

    def rows(sql, *p):
        cur = con.execute(sql, list(p))
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]

    mv_list = ",".join(str(m) for m in MODULES)
    os.makedirs(f"{args.out}/tables", exist_ok=True)

    # ------------------------------------------------------------------ Release
    release = rows("select Code, Date from Release where IsCurrent")[0]

    # ------------------------------------------------------------------ Items / Properties
    names = {r["ItemID"]: (r["Name"] or "").strip() for r in rows("select ItemID, Name from Item")}
    sig = {}
    by_sig = {}
    for r in rows("select ItemID, Code, Signature from ItemCategory where EndReleaseID is null"):
        sig[r["ItemID"]] = r["Signature"] or r["Code"]
        for k in (r["Signature"], r["Code"]):
            if k:
                by_sig.setdefault(k, names.get(r["ItemID"]))
    dtypes = {r["DataTypeID"]: r["Name"] for r in rows("select DataTypeID, Name from DataType")}
    prop_dtype = {r["PropertyID"]: dtypes.get(r["DataTypeID"]) for r in rows("select PropertyID, DataTypeID from Property")}

    # ------------------------------------------------------------------ Module & Tabellen
    mods = rows(f"""select mv.ModuleVID, mv.Code, mv.Name, mv.Description, mv.FromReferenceDate, mv.ToReferenceDate,
                           f.Code fw, f.Name fwname
                    from ModuleVersion mv join Module m using(ModuleID) join Framework f using(FrameworkID)
                    where mv.ModuleVID in ({mv_list})""")
    tabs = rows(f"""select c.ModuleVID, c."Order" ord, tv.TableVID, tv.TableID, tv.Code, tv.Name, tv.Description,
                           tv.AbstractTableID, t.IsAbstract, t.HasOpenRows, t.HasOpenColumns, t.HasOpenSheets
                    from ModuleVersionComposition c join TableVersion tv using(TableVID) join "Table" t on t.TableID=tv.TableID
                    where c.ModuleVID in ({mv_list}) order by c.ModuleVID, c."Order" """)
    tab_by_vid = {t["TableVID"]: t for t in tabs}
    abstract_code = {t["TableID"]: t["Code"] for t in tabs if t["IsAbstract"]}

    # Labels auch für Tabellen außerhalb der Module (z. B. P_01.01 in Regeln)
    all_tv = rows("""select TableVID, Code, Name, StartReleaseID from TableVersion where EndReleaseID is null""")
    tv_for_code = {}
    for t in sorted(all_tv, key=lambda x: x["StartReleaseID"] or 0):
        tv_for_code[t["Code"]] = t
    for t in tabs:
        tv_for_code[t["Code"]] = t  # Modulversion hat Vorrang

    # ------------------------------------------------------------------ Regeln
    rule_rows = rows(f"""
        select ov.OperationVID, o.Code, o.Source, ov.Expression, ov.Description, ov.PreconditionOperationVID,
               pre.Expression pre_expr, oc.ModuleVID, os.Severity
        from OperationVersion ov join Operation o using(OperationID)
        join OperationScope os on os.OperationVID=ov.OperationVID
        join OperationScopeComposition oc using(OperationScopeID)
        left join OperationVersion pre on pre.OperationVID=ov.PreconditionOperationVID
        where oc.ModuleVID in ({mv_list}) and ov.EndReleaseID is null and os.IsActive and o.Type='validation'""")
    rules = {}
    for r in rule_rows:
        x = rules.setdefault(r["OperationVID"], {
            "id": r["OperationVID"], "code": r["Code"], "src": r["Source"], "expr": r["Expression"],
            "desc": (r["Description"] or "").strip(), "pre": r["pre_expr"], "sev": {}})
        x["sev"][MODULES[r["ModuleVID"]]] = r["Severity"]

    # Zellen je Regel (über Operatorbaum -> Operandenreferenz -> Ort)
    loc = rows(f"""
        select n.OperationVID, l.CellID, l."Table" tbl, l."Row" rw, l."Column" col, l.Sheet sh
        from OperandReferenceLocation l join OperandReference r using(OperandReferenceID)
        join OperationNode n on n.NodeID=r.NodeID
        where n.OperationVID in (select OperationVID from OperationVersion where EndReleaseID is null)""")
    cell_info = {}
    rule_cells = defaultdict(set)
    for l in loc:
        if l["OperationVID"] in rules:
            rule_cells[l["OperationVID"]].add(l["CellID"])
            cell_info[l["CellID"]] = [l["tbl"], l["rw"], l["col"], l["sh"]]

    # Tabellen, deren Kopfzeilen für Labels gebraucht werden
    needed = {t["Code"] for t in tabs}
    for r in rules.values():
        needed |= set(re.findall(r"\bt([A-Z][A-Za-z0-9_.]+)", r["expr"]))
    for ci in cell_info.values():
        needed.add(ci[0])
    needed_vids = [tv_for_code[c]["TableVID"] for c in needed if c in tv_for_code]

    hdr = rows(f"""
        select tvh.TableVID, tvh.HeaderID, tvh.ParentHeaderID, tvh."Order" ord, tvh.IsAbstract abs,
               h.Direction dir, h.IsKey key, hv.Code code, hv.Label label, hv.PropertyID prop,
               hv.SubCategoryVID subcat, hv.KeyVariableVID keyvar
        from TableVersionHeader tvh join Header h on h.HeaderID=tvh.HeaderID
        join HeaderVersion hv on hv.HeaderVID=tvh.HeaderVID
        where tvh.TableVID in ({",".join(map(str, needed_vids))})
        order by tvh.TableVID, h.Direction, tvh."Order" """)
    headers = defaultdict(list)
    for h in hdr:
        h["label"] = (h["label"] or "").strip()
        headers[h["TableVID"]].append(h)

    # Label-Lookup für Verbalisierung
    lab = {}
    lab_codes = {}
    for vid, hs in headers.items():
        by_id = {h["HeaderID"]: h for h in hs}
        code = next((c for c, t in tv_for_code.items() if t["TableVID"] == vid), None)
        for h in hs:
            axis = {"Y": "r", "X": "c", "Z": "s"}[h["dir"]]
            path, p = [], h
            while p:
                path.append(p["label"])
                p = by_id.get(p["ParentHeaderID"])
            if h["code"]:
                lab[(code, axis, h["code"])] = [h["label"], " › ".join(reversed(path)),
                                                path[1] if len(path) > 1 else None]
                lab_codes.setdefault((code, axis), []).append(h["code"])
        # mehrdeutige Bezeichnungen mit Elternbezeichnung ergänzen
        seen = defaultdict(int)
        for (c_, a_, _), v in lab.items():
            if c_ == code:
                seen[(a_, v[0])] += 1
        for (c_, a_, k_), v in list(lab.items()):
            if c_ == code:
                short = v[0]
                if seen[(a_, v[0])] > 1 and v[2]:
                    short = f"{v[2]} › {v[0]}"
                lab[(c_, a_, k_)] = (v[0], v[1], short)
    for k in lab_codes:
        lab_codes[k].sort()

    class Labels:
        def header(self, t, axis, c):
            return lab.get((t, axis, c))

        def codes(self, t, axis):
            return lab_codes.get((t, axis), [])

        def item(self, s):
            return by_sig.get(s)

        def prop(self, s):
            return by_sig.get(s)

        def table_name(self, t):
            tv = tv_for_code.get(t)
            return tv["Name"] if tv else None

    verb = Verbalizer(Labels())
    fails = 0
    for r in rules.values():
        try:
            r["verbal"] = verb.rule(r["expr"])
        except (ParseError, Exception) as e:  # noqa: BLE001
            fails += 1
            r["verbal"] = None
            r["verbal_error"] = str(e)
        if r["pre"]:
            try:
                r["pre_verbal"] = verb.precondition(r["pre"])
            except Exception:  # noqa: BLE001
                r["pre_verbal"] = None
        cells = sorted(rule_cells.get(r["id"], []))
        r["cells"] = cells
        r["tables"] = sorted({cell_info[c][0] for c in cells})
    print(f"Regeln: {len(rules)}, nicht verbalisiert: {fails}")

    # ------------------------------------------------------------------ Zellen & Variablen
    cells = rows(f"""
        select tvc.TableVID, tvc.CellID, tvc.CellCode, tvc.IsNullable, tvc.IsExcluded, tvc.IsVoid, tvc.Sign,
               tvc.VariableVID, c.RowID, c.ColumnID, c.SheetID
        from TableVersionCell tvc join Cell c using(CellID)
        where tvc.TableVID in ({",".join(str(t["TableVID"]) for t in tabs)})""")
    var_vids = {c["VariableVID"] for c in cells if c["VariableVID"]}
    vv = {r["VariableVID"]: r for r in rows(f"""
        select VariableVID, VariableID, PropertyID, ContextID, KeyID, SubCategoryVID
        from VariableVersion where VariableVID in ({",".join(map(str, var_vids))})""")}
    ctx_ids = {v["ContextID"] for v in vv.values() if v["ContextID"]}
    ctx = defaultdict(list)
    for r in rows(f"""select ContextID, PropertyID, ItemID from ContextComposition
                      where ContextID in ({",".join(map(str, ctx_ids))})"""):
        ctx[r["ContextID"]].append([names.get(r["PropertyID"]), sig.get(r["PropertyID"]),
                                    names.get(r["ItemID"]), sig.get(r["ItemID"])])
    subcats = {r["SubCategoryVID"]: r for r in rows("""
        select scv.SubCategoryVID, sc.Code, sc.Name from SubCategoryVersion scv join SubCategory sc using(SubCategoryID)""")}

    # Gleicher Datenpunkt in anderen Zellen
    cells_by_var = defaultdict(list)
    for c in cells:
        if c["VariableVID"]:
            cells_by_var[c["VariableVID"]].append(c["CellCode"])

    rules_by_cell = defaultdict(list)
    for r in rules.values():
        for cid in r["cells"]:
            rules_by_cell[cid].append(r["id"])

    cells_by_tab = defaultdict(list)
    for c in cells:
        cells_by_tab[c["TableVID"]].append(c)

    # ------------------------------------------------------------------ Tabellen schreiben
    meta_tables = defaultdict(list)
    written = set()
    for t in tabs:
        mod = MODULES[t["ModuleVID"]]
        entry = {"code": t["Code"], "name": t["Name"], "abstract": bool(t["IsAbstract"]),
                 "parent": abstract_code.get(t["AbstractTableID"])}
        if t["IsAbstract"]:
            meta_tables[mod].append(entry)
            continue
        hs = headers[t["TableVID"]]
        tcells = cells_by_tab[t["TableVID"]]
        used_vars = {}
        out_cells = []
        nrules = set()
        for c in tcells:
            v = vv.get(c["VariableVID"])
            if v and v["VariableVID"] not in used_vars:
                sc = subcats.get(v["SubCategoryVID"])
                used_vars[v["VariableVID"]] = {
                    "id": v["VariableID"],
                    "metric": [names.get(v["PropertyID"]), sig.get(v["PropertyID"]), prop_dtype.get(v["PropertyID"])],
                    "dims": ctx.get(v["ContextID"], []),
                    "enum": [sc["Code"], sc["Name"]] if sc else None,
                }
            rids = rules_by_cell.get(c["CellID"], [])
            nrules |= set(rids)
            out_cells.append({
                "id": c["CellID"], "code": c["CellCode"], "r": c["RowID"], "c": c["ColumnID"], "s": c["SheetID"],
                "excl": bool(c["IsExcluded"]), "void": bool(c["IsVoid"]), "nullable": bool(c["IsNullable"]),
                "sign": c["Sign"], "var": c["VariableVID"], "rules": rids,
                "same": [x for x in cells_by_var.get(c["VariableVID"], []) if x != c["CellCode"]],
            })
        doc = {
            "code": t["Code"], "name": t["Name"], "desc": t["Description"], "module": mod,
            "open": {"rows": bool(t["HasOpenRows"]), "cols": bool(t["HasOpenColumns"]), "sheets": bool(t["HasOpenSheets"])},
            "headers": [{
                "id": h["HeaderID"], "parent": h["ParentHeaderID"], "dir": h["dir"], "code": h["code"],
                "label": h["label"], "abs": bool(h["abs"]), "key": bool(h["key"]),
                "keyprop": [names.get(h["prop"]), sig.get(h["prop"])] if h["key"] and h["prop"] else None,
            } for h in hs],
            "cells": out_cells,
            "vars": used_vars,
        }
        fn = t["Code"]
        with open(f"{args.out}/tables/{fn}.json", "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
        written.add(t["Code"])
        entry.update({"cells": len(tcells), "rules": len(nrules)})
        meta_tables[mod].append(entry)

    # ------------------------------------------------------------------ Regeln & Lineage schreiben
    with open(f"{args.out}/rules.json", "w", encoding="utf-8") as f:
        json.dump({"rules": rules, "cells": {str(k): v for k, v in cell_info.items()}},
                  f, ensure_ascii=False, separators=(",", ":"))

    edges = defaultdict(list)
    for r in rules.values():
        ts = r["tables"]
        for i in range(len(ts)):
            for j in range(i + 1, len(ts)):
                edges[(ts[i], ts[j])].append(r["id"])
    lineage = {
        "nodes": [{"code": c, "name": (tv_for_code.get(c) or {}).get("Name"), "inModule": c in written,
                   "module": next((MODULES[t["ModuleVID"]] for t in tabs if t["Code"] == c), None)}
                  for c in sorted({c for e in edges for c in e} | written)],
        "edges": [{"a": a, "b": b, "rules": ids} for (a, b), ids in edges.items()],
    }
    with open(f"{args.out}/lineage.json", "w", encoding="utf-8") as f:
        json.dump(lineage, f, ensure_ascii=False, separators=(",", ":"))

    # ------------------------------------------------------------------ Suchindex (Zeilen/Spalten-Bezeichnungen)
    search = []
    for t in tabs:
        if t["IsAbstract"]:
            continue
        for h in headers[t["TableVID"]]:
            if h["label"] and h["code"]:
                search.append([t["Code"], {"Y": "r", "X": "c", "Z": "s"}[h["dir"]], h["code"], h["label"]])
    with open(f"{args.out}/search.json", "w", encoding="utf-8") as f:
        json.dump(search, f, ensure_ascii=False, separators=(",", ":"))

    # ------------------------------------------------------------------ Meta
    counts = {}
    for t in ["Framework", "Module", "ModuleVersion", "Table", "TableVersion", "Header", "HeaderVersion", "Cell",
              "TableVersionCell", "Variable", "VariableVersion", "Property", "Item", "Category", "SubCategory",
              "Context", "ContextComposition", "Operation", "OperationVersion", "OperationScope", "OperationNode",
              "OperandReference", "OperandReferenceLocation", "Release"]:
        counts[t] = con.execute(f'select count(*) from "{t}"').fetchone()[0]
    meta = {
        "release": release,
        "modules": [{"key": MODULES[m["ModuleVID"]], "code": m["Code"], "name": m["Name"], "framework": m["fw"],
                     "frameworkName": m["fwname"], "from": str(m["FromReferenceDate"] or ""),
                     "to": str(m["ToReferenceDate"] or ""), "tables": meta_tables[MODULES[m["ModuleVID"]]],
                     "rules": sum(1 for r in rules.values() if MODULES[m["ModuleVID"]] in r["sev"])}
                    for m in mods],
        "counts": counts,
    }
    meta["modules"].sort(key=lambda m: m["key"] != "FINREP9")
    with open(f"{args.out}/meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print(f"Tabellen geschrieben: {len(written)} -> {args.out}")


if __name__ == "__main__":
    main()
