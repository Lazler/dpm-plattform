"""
Zusatzauswertungen für den DPM Explorer:

    build_diffs        Release-Vergleich (Zellen, Datenpunkte, Bezeichnungen, Regeln) je Basis-Release
    build_datapoints   Index aller Datenpunkte nach Kennzahl und Dimensionen (Datenpunkt-Suche)
    build_hierarchies  Kategorien/Unterkategorien als Bäume inkl. Verwendung (Hierarchien)
"""
from __future__ import annotations

import json
import re
from collections import defaultdict

OP_SYMBOL = {2: "+", 5: "−", 13: "=", 14: "≤", 15: "≥", 18: ">", 19: "<", 20: "≠"}


def _norm(expr):
    return re.sub(r"\s+", "", expr or "")


def _dump(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


# ============================================================================ Release-Vergleich

def build_diffs(c):
    con, rows, out = c["con"], c["rows"], c["out"]
    modules = c["modules"]  # ModuleVID -> Kürzel
    names, sig, verb = c["names"], c["sig"], c["verb"]
    cur_rules = c["rules"]

    con.execute("create or replace temp table rr as select ReleaseID, Code, Date, Type, "
                "row_number() over (order by Date) rk from Release")
    rel = rows("select * from rr order by rk")
    cur = next(r for r in rel if r["ReleaseID"] == c["release_id"])
    bases = [r for r in rel if r["Type"] == "module" and r["rk"] < cur["rk"]]
    mod_ids = rows(f"select distinct ModuleID, ModuleVID from ModuleVersion where ModuleVID in ({','.join(map(str, modules))})")
    mod_key = {m["ModuleID"]: modules[m["ModuleVID"]] for m in mod_ids}
    mid_list = ",".join(str(m) for m in mod_key)

    def valid(alias, rk):
        return (f"(select rk from rr where ReleaseID={alias}.StartReleaseID) <= {rk} and "
                f"({alias}.EndReleaseID is null or (select rk from rr where ReleaseID={alias}.EndReleaseID) > {rk})")

    def state(rk):
        mvs = rows(f"select ModuleVID, ModuleID from ModuleVersion mv where ModuleID in ({mid_list}) and {valid('mv', rk)}")
        if not mvs:
            return None
        mvl = ",".join(str(m["ModuleVID"]) for m in mvs)
        mv_key = {m["ModuleVID"]: mod_key[m["ModuleID"]] for m in mvs}
        con.execute(f"""create or replace temp table tvsel as
            select distinct tv.TableVID, tv.TableID, tv.Code, tv.Name from ModuleVersionComposition c
            join TableVersion tv on tv.TableID=c.TableID join "Table" t on t.TableID=tv.TableID
            where c.ModuleVID in ({mvl}) and not t.IsAbstract and {valid('tv', rk)}""")
        tables = {r["Code"]: r for r in rows("select * from tvsel")}
        cells = defaultdict(dict)
        for r in rows("""
            select tv.Code tcode, tvc.CellID, tvc.IsExcluded excl, tvc.Sign sign, tvc.IsNullable nul,
                   vv.PropertyID prop, vv.ContextID ctx, vv.SubCategoryVID sub, vv.KeyID key, tvc.VariableVID var,
                   hr.Code r, hc.Code c, hs.Code s
            from tvsel tv join TableVersionCell tvc using(TableVID) join Cell ce using(CellID)
            left join TableVersionHeader tr on tr.TableVID=tv.TableVID and tr.HeaderID=ce.RowID
            left join HeaderVersion hr on hr.HeaderVID=tr.HeaderVID
            left join TableVersionHeader tc on tc.TableVID=tv.TableVID and tc.HeaderID=ce.ColumnID
            left join HeaderVersion hc on hc.HeaderVID=tc.HeaderVID
            left join TableVersionHeader ts on ts.TableVID=tv.TableVID and ts.HeaderID=ce.SheetID
            left join HeaderVersion hs on hs.HeaderVID=ts.HeaderVID
            left join VariableVersion vv on vv.VariableVID=tvc.VariableVID"""):
            cells[r["tcode"]][(r["r"] or "", r["c"] or "", r["s"] or "")] = r
        labels = defaultdict(dict)
        for r in rows("""select tv.Code tcode, h.Direction d, hv.Code code, hv.Label label
                         from tvsel tv join TableVersionHeader tvh using(TableVID)
                         join Header h on h.HeaderID=tvh.HeaderID join HeaderVersion hv on hv.HeaderVID=tvh.HeaderVID
                         where hv.Code is not null"""):
            labels[r["tcode"]][({"Y": "r", "X": "c", "Z": "s"}[r["d"]], r["code"])] = (r["label"] or "").strip()
        rules = {}
        for r in rows(f"""
            select o.Code, ov.OperationVID vid, ov.Expression expr, oc.ModuleVID mv, os.Severity sev
            from OperationVersion ov join Operation o using(OperationID)
            join OperationScope os on os.OperationVID=ov.OperationVID
            join OperationScopeComposition oc using(OperationScopeID)
            where oc.ModuleVID in ({mvl}) and os.IsActive and o.Type='validation' and {valid('ov', rk)}"""):
            x = rules.setdefault(r["Code"], {"vid": r["vid"], "expr": r["expr"], "sev": {}})
            x["sev"][mv_key[r["mv"]]] = r["sev"]
        return {"tables": tables, "cells": cells, "labels": labels, "rules": rules}

    any_code = {}
    for r in rows("select ItemID, Signature, Code, EndReleaseID from ItemCategory order by EndReleaseID nulls last"):
        any_code.setdefault(r["ItemID"], r["Signature"] or r["Code"])

    def code_of(i):
        return any_code.get(i) or names.get(i) or i

    now = state(cur["rk"])
    os_ = __import__("os")
    os_.makedirs(f"{out}/diff", exist_ok=True)
    cur_by_code = {r["code"]: r for r in cur_rules.values()}
    index = []
    written = {}
    for f in os_.listdir(f"{out}/diff"):
        os_.remove(f"{out}/diff/{f}")

    for b in bases:
        old = state(b["rk"])
        if not old:
            continue
        # Tabellen der alten Regeln (für Zuordnung entfallener/geänderter Regeln)
        old_vids = [r["vid"] for k, r in old["rules"].items() if k not in cur_by_code or _norm(r["expr"]) != _norm(cur_by_code[k]["expr"])]
        old_tabs = defaultdict(set)
        if old_vids:
            for r in rows(f"""select distinct n.OperationVID vid, l."Table" t
                              from OperandReferenceLocation l join OperandReference r using(OperandReferenceID)
                              join OperationNode n on n.NodeID=r.NodeID
                              where n.OperationVID in ({','.join(map(str, old_vids))})"""):
                old_tabs[r["vid"]].add(r["t"])
        all_ctx_ids = {x["ctx"] for st in (old, now) for t in st["cells"].values() for x in t.values() if x["ctx"]}
        ctx = defaultdict(list)
        ctx_key = defaultdict(list)
        for r in rows(f"select ContextID, PropertyID, ItemID from ContextComposition where ContextID in ({','.join(map(str, all_ctx_ids))})"):
            ctx[r["ContextID"]].append([names.get(r["PropertyID"]), names.get(r["ItemID"])])
            ctx_key[r["ContextID"]].append((code_of(r["PropertyID"]), code_of(r["ItemID"])))

        def sem(x):
            """inhaltlicher Schlüssel eines Datenpunkts: Kennzahl + Dimensionen über Codes"""
            return (code_of(x["prop"]), tuple(sorted(ctx_key.get(x["ctx"], []))))

        T = {}
        S = defaultdict(int)
        for code, tnow in now["tables"].items():
            e = {"st": "same", "cells": {}, "removed": [], "labels": [], "dp": {}, "rules": {"add": [], "del": [], "chg": []}}
            if code not in old["tables"]:
                e["st"] = "new"
                S["tables_new"] += 1
            cn, co = now["cells"][code], old["cells"].get(code, {})
            ln, lo = now["labels"][code], old["labels"].get(code, {})
            if e["st"] != "new":
                for k, x in cn.items():
                    y = co.get(k)
                    types = []
                    if not y:
                        if not x["excl"]:
                            types.append("new")
                    else:
                        if y["excl"] and not x["excl"]:
                            types.append("opened")
                        elif x["excl"] and not y["excl"]:
                            types.append("greyed")
                        if not x["excl"] and not y["excl"]:
                            if sem(x) != sem(y):
                                types.append("dp")
                                e["dp"][x["CellID"]] = [names.get(y["prop"]), ctx.get(y["ctx"], [])]
                            if (x["sign"] or "") != (y["sign"] or ""):
                                types.append("sign")
                    if types:
                        e["cells"][x["CellID"]] = types
                        for t_ in types:
                            S["cells_" + t_] += 1
                for k, y in co.items():
                    if k not in cn and not y["excl"]:
                        e["removed"].append([k[0], k[1], k[2], lo.get(("r", k[0]), ""), lo.get(("c", k[1]), ""), lo.get(("s", k[2]), "")])
                        S["cells_removed"] += 1
                for k, lab in ln.items():
                    if k in lo and lo[k] != lab:
                        e["labels"].append([k[0], k[1], lo[k], lab])
                        S["labels"] += 1
            T[code] = e

        for k, r in now["rules"].items():
            cr = cur_by_code.get(k)
            if not cr:
                continue
            o = old["rules"].get(k)
            if not o:
                for t in cr["tables"]:
                    if t in T:
                        T[t]["rules"]["add"].append(cr["id"])
                S["rules_add"] += 1
            elif _norm(o["expr"]) != _norm(r["expr"]):
                for t in set(cr["tables"]) | old_tabs.get(o["vid"], set()):
                    if t in T:
                        T[t]["rules"]["chg"].append({"id": cr["id"], "old": o["expr"]})
                S["rules_chg"] += 1
        for k, o in old["rules"].items():
            if k in now["rules"]:
                continue
            try:
                vb = verb.rule(o["expr"])
            except Exception:  # noqa: BLE001
                vb = None
            item = {"code": k, "expr": o["expr"], "verbal": vb, "sev": o["sev"]}
            for t in old_tabs.get(o["vid"], set()):
                if t in T:
                    T[t]["rules"]["del"].append(item)
            S["rules_del"] += 1

        removed_tables = [[k, v["Name"]] for k, v in old["tables"].items() if k not in now["tables"]]
        S["tables_removed"] = len(removed_tables)
        res = {}
        for code, e in T.items():
            changed = e["cells"] or e["removed"] or e["labels"] or any(e["rules"].values())
            if e["st"] == "new" or changed:
                if e["st"] != "new":
                    e["st"] = "changed"
                    S["tables_changed"] += 1
                res[code] = e
        doc = {"base": {"code": b["Code"], "date": str(b["Date"])}, "cur": {"code": cur["Code"]},
               "summary": dict(S), "removedTables": removed_tables, "tables": res}
        # identische Vergleiche (z. B. 3.4 und 3.5) nur einmal speichern
        key = json.dumps([doc["summary"], removed_tables, res], sort_keys=True, default=str)
        same = written.get(key)
        if not same:
            written[key] = b["Code"]
            _dump(f"{out}/diff/{b['Code']}.json", doc)
        index.append({"code": b["Code"], "date": str(b["Date"]), "summary": dict(S), "file": same or b["Code"]})
        print(f"  Vergleich {b['Code']} -> {cur['Code']}: {dict(S)}")
    _dump(f"{out}/diff/index.json", list(reversed(index)))


# ============================================================================ Datenpunkte

def build_datapoints(c):
    names, sig = c["names"], c["sig"]
    props, items, pidx, iidx = [], [], {}, {}

    def P(i):
        if i not in pidx:
            pidx[i] = len(props)
            props.append([names.get(i), sig.get(i), c["prop_dtype"].get(i)])
        return pidx[i]

    def I(i):
        if i not in iidx:
            iidx[i] = len(items)
            items.append([names.get(i), sig.get(i)])
        return iidx[i]

    vars_ = {}
    for cell in c["cells"]:
        if cell["IsExcluded"] or not cell["VariableVID"]:
            continue
        v = c["vv"].get(cell["VariableVID"])
        if not v:
            continue
        parts = [x.strip() for x in (cell["CellCode"] or "").strip("{}").split(",")]
        cc = {x[0]: x[1:] for x in parts[1:] if x and x[0] in "rcs"}
        loc = [parts[0], cc.get("r", ""), cc.get("c", ""), cc.get("s", "")]
        if v["VariableVID"] not in vars_:
            vars_[v["VariableVID"]] = [P(v["PropertyID"]),
                                       [[P(p), I(i)] for p, i in c["ctx_raw"].get(v["ContextID"], [])], []]
        vars_[v["VariableVID"]][2].append(loc)
    _dump(f"{c['out']}/datapoints.json", {"props": props, "items": items, "vars": list(vars_.values())})
    print(f"  Datenpunkte: {len(vars_)}")


# ============================================================================ Hierarchien

def build_hierarchies(c):
    rows, names, sig = c["rows"], c["names"], c["sig"]
    used_props = set()
    for v in c["vv"].values():
        for p, _ in c["ctx_raw"].get(v["ContextID"], []):
            used_props.add(p)
    pc = rows("select PropertyID, CategoryID from PropertyCategory where EndReleaseID is null")
    cat_props = defaultdict(set)
    for r in pc:
        if r["PropertyID"] in used_props:
            cat_props[r["CategoryID"]].add(r["PropertyID"])
    used_subvids = {v["SubCategoryVID"] for v in c["vv"].values() if v["SubCategoryVID"]}
    used_subvids |= {h["subcat"] for hs in c["headers"].values() for h in hs if h["subcat"]}
    sub_rows = rows("""select scv.SubCategoryVID vid, sc.SubCategoryID sid, sc.CategoryID cat, sc.Code, sc.Name, sc.Description
                       from SubCategoryVersion scv join SubCategory sc using(SubCategoryID) where scv.EndReleaseID is null""")
    cats_needed = set(cat_props) | {s["cat"] for s in sub_rows if s["vid"] in used_subvids}
    cats = {r["CategoryID"]: r for r in rows("select * from Category")}
    sci = defaultdict(list)
    for r in rows('select * from SubCategoryItem order by SubCategoryVID, "Order"'):
        sci[r["SubCategoryVID"]].append(r)

    # Regeln je Unterkategorie (EBA-Beschreibung "Generated by subcategory(ies): X, Y")
    rules_by_sub = defaultdict(list)
    for r in c["rules"].values():
        m = re.search(r"subcategor(?:y|ies)\(?i?e?s?\)?:\s*([^.]+)", r["desc"] or "", re.I)
        if m:
            for code in [x.strip() for x in m.group(1).split(",")]:
                rules_by_sub[code].append(r["id"])
    # Verwendung in Tabellen (Kopfzeilen mit Unterkategorie, Datenpunkte mit Werteliste)
    used_in = defaultdict(set)
    vid_to_code = {t["TableVID"]: t["Code"] for t in c["tabs"]}
    for vid, hs in c["headers"].items():
        if vid in vid_to_code:
            for h in hs:
                if h["subcat"]:
                    used_in[h["subcat"]].add(vid_to_code[vid])
    for cell in c["cells"]:
        v = c["vv"].get(cell["VariableVID"])
        if v and v["SubCategoryVID"]:
            used_in[v["SubCategoryVID"]].add(vid_to_code.get(cell["TableVID"]))

    out = []
    for cid in sorted(cats_needed, key=lambda x: (cats[x]["Name"] or "") if x in cats else ""):
        cat = cats.get(cid)
        if not cat:
            continue
        subs = []
        for s in [s for s in sub_rows if s["cat"] == cid]:
            its = sci.get(s["vid"], [])
            if not its:
                continue
            pos = {it["ItemID"]: i for i, it in enumerate(its)}
            items = [[(it["Label"] or names.get(it["ItemID"]) or "").strip(), sig.get(it["ItemID"]),
                      pos.get(it["ParentItemID"]), OP_SYMBOL.get(it["ArithmeticOperatorID"] or it["ComparisonOperatorID"])]
                     for it in its]
            subs.append({"code": s["Code"], "name": (s["Name"] or "").strip(), "desc": (s["Description"] or "").strip(),
                         "items": items, "rules": rules_by_sub.get(s["Code"], []),
                         "tables": sorted(t for t in used_in.get(s["vid"], set()) if t),
                         "hier": any(i[2] is not None for i in items)})
        subs.sort(key=lambda s: (not s["hier"], not s["rules"], s["code"]))
        if not subs:
            continue
        out.append({"code": cat["Code"], "name": (cat["Name"] or "").strip(), "desc": (cat["Description"] or "").strip(),
                    "enum": bool(cat["IsEnumerated"]),
                    "props": sorted({names.get(p) for p in cat_props.get(cid, set()) if names.get(p)}), "subs": subs})
    _dump(f"{c['out']}/hierarchies.json", out)
    print(f"  Hierarchien: {len(out)} Kategorien, {sum(len(x['subs']) for x in out)} Unterkategorien")
