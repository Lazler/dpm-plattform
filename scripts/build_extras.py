"""
Zusatzauswertungen für den DPM Explorer:

    build_diffs        Release-Vergleich (Zellen, Datenpunkte, Bezeichnungen, Regeln) je Basis-Release
    build_datapoints   Index aller Datenpunkte nach Kennzahl und Dimensionen (Datenpunkt-Suche)
    build_hierarchies  Kategorien/Unterkategorien als Bäume inkl. Verwendung (Hierarchien)
"""
from __future__ import annotations

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from dpmxl import canonical, parse  # noqa: E402
from collections import defaultdict

OP_SYMBOL = {2: "+", 5: "−", 13: "=", 14: "≤", 15: "≥", 18: ">", 19: "<", 20: "≠"}


CONTENT = {"new", "opened", "greyed", "dp", "sign"}  # dptech/dpmod gelten als technisch


SYNONYMS = [("real estate", "immovable property"), ("recognised", "recognized"), ("encumberance", "encumbrance")]


def _plain(s):
    s = re.sub(r"[\s\-–_/,.;:()]+", " ", (s or "").lower()).strip()
    for a_, b_ in SYNONYMS:
        s = s.replace(a_, b_)
    return s


def _sim(a, b):
    a, b = _plain(a), _plain(b)
    if not a or not b:
        return 0.0
    if a in b or b in a:
        return 0.9
    tail = lambda t: t.split(" ", 1)[-1]  # "x. y" -> "y"
    from difflib import SequenceMatcher
    return max(SequenceMatcher(None, a, b).ratio(), SequenceMatcher(None, tail(a), b).ratio())


def _metric(s):
    return _plain(re.sub(r"\((flow|stock)\)", "", s or "", flags=re.I))


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

        def dp_kind(x, y):
            """dptech = nur Bezeichnungen (Dimension/Wert umbenannt) · dpmod = Modellierung (Dimension nur
            ergänzt oder nur entfallen) · dp = inhaltlich (Wert ausgetauscht oder Kennzahl geändert)"""
            on, nn = ctx.get(y["ctx"], []), ctx.get(x["ctx"], [])
            same_metric = _metric(names.get(y["prop"])) == _metric(names.get(x["prop"]))
            ren = [[p_, q_] for p_, i_ in on for q_, j_ in nn if _plain(i_) == _plain(j_) and p_ != q_]
            ro = [i for _, i in on if _plain(i) not in {_plain(j) for _, j in nn}]
            rn = [j for _, j in nn if _plain(j) not in {_plain(i) for _, i in on}]
            for i in list(ro):  # ähnlich lautende Werte = Umbenennung
                best = max(rn, key=lambda j: _sim(i, j), default=None)
                if best is not None and _sim(i, best) >= 0.6:
                    ren.append([i, best])
                    ro.remove(i)
                    rn.remove(best)
            if not same_metric:
                return "dp", ren
            if not ro and not rn:
                return "dptech", ren
            if not ro or not rn:
                return "dpmod", ren
            return "dp", ren

        def sem(x):
            """inhaltlicher Schlüssel eines Datenpunkts: Kennzahl + Dimensionen über Codes"""
            return (code_of(x["prop"]), tuple(sorted(ctx_key.get(x["ctx"], []))))

        T = {}
        S = defaultdict(int)
        for code, tnow in now["tables"].items():
            e = {"st": "same", "cells": {}, "removed": [], "labels": [], "dp": {},
                 "rules": {"add": [], "del": [], "chg": [], "ren": [], "fmt": [], "sev": []}}
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
                                kind, ren = dp_kind(x, y)
                                types.append(kind)
                                e["dp"][x["CellID"]] = [names.get(y["prop"]), ctx.get(y["ctx"], []), ren]
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
                        tech = _plain(lo[k]) == _plain(lab)
                        e["labels"].append([k[0], k[1], lo[k], lab, tech])
                        S["labels_tech" if tech else "labels"] += 1
            T[code] = e

        def canon(expr):
            try:
                return canonical(expr)
            except Exception:  # noqa: BLE001
                return _norm(expr)

        now_c = {k: canon(r["expr"]) for k, r in now["rules"].items()}
        old_c = {k: canon(o["expr"]) for k, o in old["rules"].items()}
        gone_by_canon = defaultdict(list)
        for k in old["rules"]:
            if k not in now["rules"]:
                gone_by_canon[old_c[k]].append(k)
        renamed_old = set()

        def put(tabs, key, val):
            for t in tabs:
                if t in T:
                    T[t]["rules"][key].append(val)

        for k, r in now["rules"].items():
            cr = cur_by_code.get(k)
            if not cr:
                continue
            o = old["rules"].get(k)
            if not o:
                cand = [x for x in gone_by_canon.get(now_c[k], []) if x not in renamed_old]
                if cand:  # gleiche Logik unter neuem Regelcode
                    renamed_old.add(cand[0])
                    put(cr["tables"], "ren", {"id": cr["id"], "old": cand[0]})
                    S["rules_ren"] += 1
                    o = old["rules"][cand[0]]
                else:
                    put(cr["tables"], "add", cr["id"])
                    S["rules_add"] += 1
                    continue
            elif _norm(o["expr"]) != _norm(r["expr"]):
                tabs = set(cr["tables"]) | old_tabs.get(o["vid"], set())
                if old_c[k] == now_c[k]:
                    put(tabs, "fmt", {"id": cr["id"], "old": o["expr"]})
                    S["rules_fmt"] += 1
                else:
                    put(tabs, "chg", {"id": cr["id"], "old": o["expr"]})
                    S["rules_chg"] += 1
            sev = {m: [o["sev"][m], s_] for m, s_ in r["sev"].items() if o["sev"].get(m) and o["sev"][m] != s_}
            if sev:
                put(cr["tables"], "sev", {"id": cr["id"], "ch": sev})
                S["rules_sev"] += 1
        for k, o in old["rules"].items():
            if k in now["rules"] or k in renamed_old:
                continue
            try:
                vb = verb.rule(o["expr"])
            except Exception:  # noqa: BLE001
                vb = None
            put(old_tabs.get(o["vid"], set()), "del", {"code": k, "expr": o["expr"], "verbal": vb, "sev": o["sev"]})
            S["rules_del"] += 1

        removed_tables = [[k, v["Name"]] for k, v in old["tables"].items() if k not in now["tables"]]
        S["tables_removed"] = len(removed_tables)
        res = {}
        for code, e in T.items():
            content = (any(set(ts) & CONTENT for ts in e["cells"].values()) or e["removed"]
                       or any(not lab[4] for lab in e["labels"])
                       or any(e["rules"][k] for k in ("add", "del", "chg", "sev")))
            tech = e["cells"] or e["labels"] or e["rules"]["ren"] or e["rules"]["fmt"]
            if e["st"] == "new" or content or tech:
                if e["st"] != "new":
                    e["st"] = "changed" if content else "tech"
                    S["tables_changed" if content else "tables_tech"] += 1
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
    eqrules = equation_rules(c)
    _dump(f"{c['out']}/hierarchies.json", {"cats": out, "eqrules": eqrules})
    print(f"  Summenbeziehungen mit Regeln verknüpft: {len(eqrules)} Gleichungen, {sum(len(v['r']) for v in eqrules.values())} Regelbezüge")
    print(f"  Hierarchien: {len(out)} Kategorien, {sum(len(x['subs']) for x in out)} Unterkategorien")


# ============================================================================ Regeln -> Summenbeziehungen

def _nrm(s):
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def eq_key(parent, kids):
    return _nrm(parent) + "=" + "+".join(sorted(_nrm(k) for k in kids))


def equation_rules(c):
    """Ordnet Summenregeln der Gleichung zu, die sie prüfen: Bei 'A = B + C + …' unterscheiden sich die Datenpunkte
    von A und B, C, … in genau einer Dimension. Deren Werte bilden die Gleichung (z. B. Total = Central banks + …)."""
    names = c["names"]
    dims_of_var = {}
    for vid, v in c["vv"].items():
        d = {names.get(p): names.get(i) for p, i in c["ctx_raw"].get(v["ContextID"], [])}
        dims_of_var[vid] = d
    cell_dims, cols_of = {}, defaultdict(set)
    for cell in c["cells"]:
        if cell["IsExcluded"] or not cell["VariableVID"]:
            continue
        parts = [x.strip() for x in (cell["CellCode"] or "").strip("{}").split(",")]
        cc = {x[0]: x[1:] for x in parts[1:] if x and x[0] in "rcs"}
        key = (parts[0], cc.get("r", ""), cc.get("c", ""), cc.get("s", ""))
        cell_dims[key] = dims_of_var.get(cell["VariableVID"], {})
        cols_of[parts[0]].add(cc.get("c", ""))

    def codes(spec):
        if spec is None:
            return [""]
        if spec.get("all"):
            return None
        out = []
        for x in spec["items"]:
            out.extend(x if isinstance(x, list) else [x])
        return out

    def single(n):
        while n.get("op") == "paren":
            n = n["args"][0]
        return n.get("ref")

    def terms(n, out):
        while n.get("op") == "paren":
            n = n["args"][0]
        if n.get("op") in ("+", "-"):
            terms(n["args"][0], out)
            terms(n["args"][1], out)
        elif n.get("op") == "neg":
            terms(n["args"][0], out)
        else:
            out.append(single(n))
        return out

    res = defaultdict(set)
    labels = {}
    for r in c["rules"].values():
        try:
            ast = parse(r["expr"])
        except Exception:  # noqa: BLE001
            continue
        e = ast["expr"]
        while e.get("op") == "paren":
            e = e["args"][0]
        if e.get("op") != "=":
            continue
        left, right = single(e["args"][0]), terms(e["args"][1], [])
        if not left or len(right) < 2 or not all(right):
            left, right = single(e["args"][1]), terms(e["args"][0], [])
            if not left or len(right) < 2 or not all(right):
                continue
        scope = ast["scope"] or {}
        refs = [{**scope, **x} for x in [left] + right]
        t = refs[0].get("t")
        if not t or any(x.get("t") != t for x in refs):
            continue
        # eine konkrete Spalte/Zeile wählen, in der alle Bezüge existieren
        found = None
        for col in (codes(refs[0].get("c")) or sorted(cols_of[t])):
            ds = []
            for x in refs:
                rr, ss = codes(x.get("r")), codes(x.get("s"))
                if not rr or len(rr) != 1 or (ss and len(ss) != 1):
                    ds = None
                    break
                cc_ = codes(x.get("c"))
                ds.append(cell_dims.get((t, rr[0], col if cc_ is None or len(cc_) != 1 else cc_[0], (ss or [""])[0])))
            if ds and all(ds):
                found = ds
                break
        if not found:
            continue
        par, kids = found[0], found[1:]
        diff = {p for k in kids for p in set(par) | set(k) if par.get(p) != k.get(p)}
        if len(diff) != 1:
            continue
        p = diff.pop()
        if not all(k.get(p) for k in kids):
            continue
        # fehlt die Dimension beim Gesamtwert, ist es die Summe über alle Teile ("Gesamt")
        key = eq_key(par.get(p) or "", [k[p] for k in kids])
        labels[key] = (p, par.get(p) or "", sorted({k[p] for k in kids}))
        res[key].add(r["id"])
    return {k: {"dim": labels[k][0], "p": labels[k][1], "k": labels[k][2], "r": sorted(v)} for k, v in res.items()}
