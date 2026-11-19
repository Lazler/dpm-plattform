"""
Kleiner DPM-XL-Parser und Verbalisierer.

Wandelt Ausdrücke wie
    with {tF_01.01, c0010, default: 0, interval: true}: {r0100} = {r0110} + {r0120}
in einen verständlichen deutschen Satz um, in dem Zellen mit ihren Zeilen- und
Spaltenbezeichnungen erscheinen.

Ausgabeformat ("Segmente"): Liste aus
    "Text"                                     -> normaler Text
    {"ref": {...}, "text": "...", "tip": "..."} -> Zellbezug (im UI als Chip)
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field


# --------------------------------------------------------------------------- Tokenizer

class ParseError(Exception):
    pass


@dataclass
class Tok:
    kind: str  # brace, bracket, num, str, id, op, kw, eof
    val: str


KEYWORDS = {"with", "if", "then", "else", "endif", "and", "or", "xor", "not",
            "group", "by", "in", "where", "true", "false", "null"}
OPS = ["<=", ">=", "!=", "<>", ":=", "<-", "=", "<", ">", "+", "-", "*", "/", "(", ")", ",", ":"]


def _capture(s: str, i: int, open_c: str, close_c: str) -> tuple[str, int]:
    depth, j, in_str = 0, i, False
    while j < len(s):
        ch = s[j]
        if ch == '"':
            in_str = not in_str
        elif not in_str:
            if ch == open_c:
                depth += 1
            elif ch == close_c:
                depth -= 1
                if depth == 0:
                    return s[i + 1:j], j + 1
        j += 1
    raise ParseError(f"nicht geschlossen: {open_c}")


def tokenize(s: str) -> list[Tok]:
    toks, i = [], 0
    while i < len(s):
        ch = s[i]
        if ch.isspace():
            i += 1
        elif ch == "{":
            inner, i = _capture(s, i, "{", "}")
            toks.append(Tok("brace", inner.strip()))
        elif ch == "[":
            inner, i = _capture(s, i, "[", "]")
            toks.append(Tok("bracket", inner.strip()))
        elif ch == '"':
            j = s.index('"', i + 1)
            toks.append(Tok("str", s[i + 1:j]))
            i = j + 1
        elif ch.isdigit():
            m = re.match(r"\d+(\.\d+)?", s[i:])
            toks.append(Tok("num", m.group(0)))
            i += len(m.group(0))
        elif ch.isalpha() or ch == "_":
            m = re.match(r"[A-Za-z_][A-Za-z0-9_.:\-]*", s[i:])
            w = m.group(0).rstrip("-")
            toks.append(Tok("kw" if w.lower() in KEYWORDS else "id", w.lower() if w.lower() in KEYWORDS else w))
            i += len(w)
        else:
            for op in OPS:
                if s.startswith(op, i):
                    toks.append(Tok("op", op))
                    i += len(op)
                    break
            else:
                raise ParseError(f"unbekanntes Zeichen {ch!r}")
    toks.append(Tok("eof", ""))
    return toks


# --------------------------------------------------------------------------- Zellbezüge

def _split_top(s: str) -> list[str]:
    parts, depth, cur, in_str = [], 0, "", False
    for ch in s:
        if ch == '"':
            in_str = not in_str
        if not in_str and ch in "([":
            depth += 1
        if not in_str and ch in ")]":
            depth -= 1
        if ch == "," and depth == 0 and not in_str:
            parts.append(cur.strip())
            cur = ""
        else:
            cur += ch
    if cur.strip():
        parts.append(cur.strip())
    return parts


def _axis_spec(comp: str, axis: str):
    """r0010 | r* | r0010-0030 | (r0010, r0020-0040) -> {'all':True} | {'items':[...]}"""
    comp = comp.strip()
    if comp.startswith("("):
        comp = comp[1:-1]
    items = []
    for p in [x.strip() for x in comp.split(",") if x.strip()]:
        p = p[1:] if p[0] == axis else p
        if p == "*":
            return {"all": True}
        if "-" in p:
            a, b = p.split("-", 1)
            items.append([a, b.lstrip(axis)])
        else:
            items.append(p)
    return {"items": items}


def parse_ref(inner: str) -> dict:
    ref: dict = {}
    for comp in _split_top(inner):
        low = comp.lower()
        if low.startswith("default") or low.startswith("interval"):
            if low.startswith("default"):
                ref["default"] = comp.split(":", 1)[1].strip()
            continue
        head = comp.lstrip("(").strip()
        if not head:
            continue
        if head.startswith("v_"):
            ref["tablevar"] = head[2:]
        elif head[0] == "t" and len(head) > 1 and head[1].isupper():
            ref["t"] = head[1:]
        elif head[0] in "rcs" and (len(head) == 1 or head[1].isdigit() or head[1] == "*"):
            ref[head[0]] = _axis_spec(comp, head[0])
        elif head.startswith("["):
            ref.setdefault("items", []).append(head.strip("[]"))
        else:
            ref.setdefault("other", []).append(comp)
    return ref


# --------------------------------------------------------------------------- Parser

class Parser:
    def __init__(self, toks: list[Tok]):
        self.t, self.i = toks, 0

    def peek(self, k=0):
        return self.t[self.i + k]

    def next(self):
        tok = self.t[self.i]
        self.i += 1
        return tok

    def accept(self, kind, val=None):
        tok = self.peek()
        if tok.kind == kind and (val is None or tok.val == val):
            self.i += 1
            return tok
        return None

    def expect(self, kind, val=None):
        tok = self.accept(kind, val)
        if not tok:
            raise ParseError(f"erwartet {val or kind}, gefunden {self.peek().val!r}")
        return tok

    # program := [with {partial} :] expr
    def program(self):
        scope = None
        if self.accept("kw", "with"):
            scope = parse_ref(self.expect("brace").val)
            self.expect("op", ":")
        node = self.expr()
        if self.peek().kind != "eof":
            raise ParseError(f"Rest nicht verarbeitet: {self.peek().val!r}")
        return {"scope": scope, "expr": node}

    def expr(self):
        return self.or_()

    def or_(self):
        n = self.and_()
        while self.peek().kind == "kw" and self.peek().val in ("or", "xor"):
            op = self.next().val
            n = {"op": op, "args": [n, self.and_()]}
        return n

    def and_(self):
        n = self.not_()
        while self.accept("kw", "and"):
            n = {"op": "and", "args": [n, self.not_()]}
        return n

    def not_(self):
        if self.accept("kw", "not"):
            return {"op": "not", "args": [self.not_()]}
        return self.comparison()

    def comparison(self):
        n = self.additive()
        tok = self.peek()
        if tok.kind == "op" and tok.val in ("=", "!=", "<>", "<", "<=", ">", ">="):
            self.next()
            op = "!=" if tok.val == "<>" else tok.val
            return {"op": op, "args": [n, self.additive()]}
        if self.accept("kw", "in"):
            s = self.expect("brace").val
            items = [x.strip().strip("[]") for x in _split_top(s)]
            return {"op": "in", "args": [n], "items": items}
        return n

    def additive(self):
        n = self.mult()
        while self.peek().kind == "op" and self.peek().val in ("+", "-"):
            op = self.next().val
            n = {"op": op, "args": [n, self.mult()]}
        return n

    def mult(self):
        n = self.unary()
        while self.peek().kind == "op" and self.peek().val in ("*", "/"):
            op = self.next().val
            n = {"op": op, "args": [n, self.unary()]}
        return n

    def unary(self):
        if self.accept("op", "+"):
            return self.unary()
        if self.accept("op", "-"):
            return {"op": "neg", "args": [self.unary()]}
        return self.postfix()

    def postfix(self):
        n = self.primary()
        while self.peek().kind == "bracket" and self.peek().val.lower().startswith("where"):
            cond_src = self.next().val[5:]
            cond = Parser(tokenize(cond_src)).expr()
            n = {"op": "where", "args": [n, cond]}
        return n

    def primary(self):
        tok = self.peek()
        if tok.kind == "brace":
            self.next()
            return {"ref": parse_ref(tok.val)}
        if tok.kind == "bracket":
            self.next()
            return {"item": tok.val}
        if tok.kind == "num":
            self.next()
            return {"num": tok.val}
        if tok.kind == "str":
            self.next()
            return {"str": tok.val}
        if tok.kind == "kw" and tok.val in ("true", "false", "null"):
            self.next()
            return {"lit": tok.val}
        if self.accept("kw", "if"):
            c = self.expr()
            self.expect("kw", "then")
            t = self.expr()
            e = None
            if self.accept("kw", "else"):
                e = self.expr()
            self.expect("kw", "endif")
            return {"op": "if", "args": [c, t] + ([e] if e else [])}
        if self.accept("op", "("):
            n = self.expr()
            self.expect("op", ")")
            return {"op": "paren", "args": [n]}
        if tok.kind == "id":
            self.next()
            if self.accept("op", "("):
                args, group = [], None
                if not self.accept("op", ")"):
                    args.append(self.expr())
                    while self.accept("op", ","):
                        args.append(self.expr())
                    if self.accept("kw", "group"):
                        self.expect("kw", "by")
                        group = [self.next().val]
                        while self.accept("op", ","):
                            group.append(self.next().val)
                    self.expect("op", ")")
                return {"fn": tok.val.lower(), "args": args, "group": group}
            return {"id": tok.val}
        raise ParseError(f"unerwartet: {tok.val!r}")


def parse(expr: str) -> dict:
    return Parser(tokenize(expr)).program()


# --------------------------------------------------------------------------- Verbalisierung

AXIS_WORD = {"r": ("Zeile", "Zeilen"), "c": ("Spalte", "Spalten"), "s": ("Blatt", "Blätter")}
GROUP_WORD = {"r": "je Zeile", "c": "je Spalte", "s": "je Blatt"}


def tcode(code: str) -> str:
    return code.replace("_", " ")


class Verbalizer:
    """
    labels: Objekt mit Methoden
        header(table, axis, code) -> (label, path) | None
        codes(table, axis)        -> sortierte Liste vorhandener Codes
        item(signature)           -> Name | None
        prop(signature)           -> Name | None
        table_name(table)         -> Name | None
    """

    def __init__(self, labels):
        self.L = labels

    # ---------------- Hilfen
    def _expand(self, table, axis, spec):
        if spec is None:
            return None
        if spec.get("all"):
            return "*"
        out = []
        avail = self.L.codes(table, axis) if table else []
        for it in spec["items"]:
            if isinstance(it, list):
                a, b = it
                rng = [c for c in avail if a <= c <= b]
                out.extend(rng if rng else [a, b])
            else:
                out.append(it)
        return out

    def _q(self, s):
        return f"„{s.strip()}“"

    def _axis_text(self, table, axis, codes, scope_ctx=False):
        sg, pl = AXIS_WORD[axis]
        if codes == "*":
            return f"jede {sg}" if axis != "s" else "jedes Blatt"
        labels = []
        for c in codes:
            h = self.L.header(table, axis, c) if table else None
            labels.append((c, (h[2] if len(h) > 2 else h[0]) if h else None, h[1] if h else None))
        tip = "\n".join(f"{axis}{c}: {p or l or '–'}" for c, l, p in labels)
        if len(labels) == 1:
            c, l, _ = labels[0]
            return (f"{self._q(l)} ({axis}{c})" if l else f"{axis}{c}"), tip
        if len(labels) <= 4 and all(l for _, l, _ in labels):
            parts = [f"{self._q(l)} ({axis}{c})" for c, l, _ in labels]
            return f"{pl} " + ", ".join(parts[:-1]) + " und " + parts[-1], tip
        return f"{len(labels)} {pl} ({axis}{labels[0][0]} … {axis}{labels[-1][0]})", tip

    def ref_seg(self, ref, scope):
        """Segment für einen Zellbezug; Komponenten aus 'with' werden nicht wiederholt."""
        scope = scope or {}
        if not scope.get("t"):
            ref = {**{k: v for k, v in scope.items() if k in ("r", "c", "s")}, **ref}
            scope = {}
        eff = {**scope, **{k: v for k, v in ref.items() if k in ("t", "r", "c", "s")}}
        table = eff.get("t")
        parts, tips, multi = [], [], False
        if "t" in ref and ref["t"] != scope.get("t") or ("t" in ref and not scope.get("t")):
            parts.append(tcode(ref["t"]))
        for axis in ("r", "c", "s"):
            if axis in ref:
                codes = self._expand(table, axis, ref[axis])
                if codes == "*" or (isinstance(codes, list) and len(codes) > 1):
                    multi = True
                res = self._axis_text(table, axis, codes)
                if isinstance(res, tuple):
                    parts.append(res[0])
                    tips.append(res[1])
                else:
                    parts.append(res)
        for it in ref.get("items", []):
            parts.append(self._q(self.L.item(it) or it))
        if not parts:
            parts.append("dieser Wert")
        # Ziel für Navigation (nur wenn eindeutig eine Zelle)
        nav = None
        if table:
            r = self._expand(table, "r", eff.get("r")) if eff.get("r") else None
            c = self._expand(table, "c", eff.get("c")) if eff.get("c") else None
            nav = {"t": table,
                   "r": r[0] if isinstance(r, list) and len(r) == 1 else None,
                   "c": c[0] if isinstance(c, list) and len(c) == 1 else None}
        tip_head = f"{tcode(table)} – {self.L.table_name(table) or ''}" if table else ""
        return {"ref": nav, "text": " · ".join(parts),
                "tip": "\n".join([tip_head] + [t for t in tips if t]).strip(),
                "multi": multi}

    # ---------------- Ausdrücke
    def v(self, n, scope, mode="must"):
        """mode: 'must' (Aussage einer Regel) | 'is' (Bedingung) | 'val' (Wert)"""
        if "ref" in n:
            ref = n["ref"]
            if "tablevar" in ref:
                return [{"ref": {"t": ref["tablevar"]}, "text": tcode(ref["tablevar"]),
                         "tip": self.L.table_name(ref["tablevar"]) or ""}]
            seg = self.ref_seg(ref, scope)
            if seg.pop("multi") and mode == "val_each":
                return ["jeder Wert in ", seg]
            return [seg]
        if "item" in n:
            return [self._q(self.L.item(n["item"]) or n["item"])]
        if "num" in n:
            return [n["num"]]
        if "str" in n:
            return ["leer" if n["str"] == "" else self._q(n["str"])]
        if "lit" in n:
            return [{"true": "wahr", "false": "falsch", "null": "leer"}[n["lit"]]]
        if "id" in n:
            return [self._q(self.L.prop(n["id"]) or n["id"])]
        if "fn" in n:
            return self.fn(n, scope)
        op, a = n["op"], n["args"]
        if op == "paren":
            inner = self.v(a[0], scope, mode)
            if self._simple(a[0]) or a[0].get("op") in ("+", "-", "paren", "=", "!=", "<", "<=", ">", ">=", "if"):
                return inner
            return ["("] + inner + [")"]
        if op in ("=", "!=", "<", "<=", ">", ">="):
            return self.cmp(op, a[0], a[1], scope, mode)
        if op == "in":
            names = ", ".join(self._q(self.L.item(i) or i) for i in n["items"])
            return self.v(a[0], scope, "val") + [(" muss einer dieser Werte sein: " if mode == "must"
                                                  else " einer dieser Werte ist: ") + names]
        if op in ("+", "-"):
            return self.additive(n, scope)
        if op in ("*", "/"):
            w = " mal " if op == "*" else " geteilt durch "
            return self.v(a[0], scope, "val") + [w] + self.v(a[1], scope, "val")
        if op == "neg":
            return ["minus "] + self.v(a[0], scope, "val")
        if op == "and":
            return self.v(a[0], scope, mode) + [" und "] + self.v(a[1], scope, mode)
        if op == "or":
            return self.v(a[0], scope, mode) + [" oder "] + self.v(a[1], scope, mode)
        if op == "xor":
            return ["entweder "] + self.v(a[0], scope, mode) + [" oder "] + self.v(a[1], scope, mode)
        if op == "not":
            return ["nicht ("] + self.v(a[0], scope, "is") + [")"]
        if op == "if":
            out = ["Wenn "] + self.v(a[0], scope, "is") + [", dann gilt: "] + self.v(a[1], scope, "must")
            if len(a) > 2:
                out += ["; sonst gilt: "] + self.v(a[2], scope, "must")
            return out
        if op == "where":
            return self.v(a[0], scope, "val") + [" (nur wo "] + self.v(a[1], scope, "is") + [")"]
        raise ParseError(f"unbekannter Operator {op}")

    def _simple(self, n):
        return "ref" in n or "num" in n or "fn" in n or "item" in n

    def fn(self, n, scope):
        name, args, group = n["fn"], n["args"], n.get("group")
        g = ""
        if group:
            g = " (" + ", ".join(GROUP_WORD.get(x, f"je {x}") for x in group) + ")"
        joined = lambda: sum(([" und "] + self.v(x, scope, "val") if i else self.v(x, scope, "val")
                              for i, x in enumerate(args)), [])
        if name == "sum":
            return ["Summe über "] + joined() + [g]
        if name == "count":
            return ["Anzahl der Werte in "] + joined() + [g]
        if name in ("max_aggr", "min_aggr"):
            w = "größter" if name == "max_aggr" else "kleinster"
            return [f"{w} Wert in "] + joined() + [g]
        if name in ("max", "min"):
            w = "Maximum" if name == "max" else "Minimum"
            return [f"{w} aus "] + joined()
        if name == "abs":
            return ["Betrag von "] + joined()
        if name == "isnull":
            return self.v(args[0], scope, "val") + [" leer ist"]
        if name == "not":
            return ["nicht ("] + self.v(args[0], scope, "is") + [")"]
        if name == "len":
            return ["Länge von "] + joined()
        if name == "match":
            return self.v(args[0], scope, "val") + [" dem Muster "] + self.v(args[1], scope, "val") + [" entspricht"]
        out = [f"{name}("]
        for i, x in enumerate(args):
            out += ([", "] if i else []) + self.v(x, scope, "val")
        return out + [")"]

    def additive(self, n, scope):
        terms = []

        def flat(x, sign):
            if x.get("op") in ("+", "-"):
                flat(x["args"][0], sign)
                flat(x["args"][1], sign if x["op"] == "+" else -sign)
            elif x.get("op") == "paren" and x["args"][0].get("op") in ("+", "-") and sign == 1:
                flat(x["args"][0], sign)
            elif x.get("op") == "neg":
                flat(x["args"][0], -sign)
            else:
                terms.append((sign, x))
        flat(n, 1)
        if all(s == 1 for s, _ in terms):
            out = ["Summe aus "]
            for i, (_, t) in enumerate(terms):
                if i:
                    out.append(" und " if i == len(terms) - 1 else ", ")
                out += self.v(t, scope, "val")
            return out
        out = []
        for i, (s, t) in enumerate(terms):
            if i:
                out.append(" plus " if s == 1 else " minus ")
            elif s == -1:
                out.append("minus ")
            out += self.v(t, scope, "val")
        return ["("] + out + [")"]

    CMP_MUST = {"=": (" muss gleich ", " sein"), "!=": (" darf nicht gleich ", " sein"),
                "<=": (" darf nicht größer sein als ", ""), ">=": (" darf nicht kleiner sein als ", ""),
                "<": (" muss kleiner sein als ", ""), ">": (" muss größer sein als ", "")}
    CMP_IS = {"=": (" gleich ", " ist"), "!=": (" ungleich ", " ist"), "<=": (" kleiner oder gleich ", " ist"),
              ">=": (" größer oder gleich ", " ist"), "<": (" kleiner als ", " ist"), ">": (" größer als ", " ist")}

    ART = [("Summe", "die Summe", "der Summe"), ("Betrag", "der Betrag", "dem Betrag"),
           ("Anzahl", "die Anzahl", "der Anzahl"), ("Maximum", "das Maximum", "dem Maximum"),
           ("Minimum", "das Minimum", "dem Minimum"), ("größter Wert", "der größte Wert", "dem größten Wert"),
           ("kleinster Wert", "der kleinste Wert", "dem kleinsten Wert"), ("Länge", "die Länge", "der Länge")]

    def _art(self, segs, dative):
        if segs and isinstance(segs[0], str):
            for w, nom, dat in self.ART:
                if segs[0].startswith(w):
                    return [(dat if dative else nom) + segs[0][len(w):]] + segs[1:]
        return segs

    def cmp(self, op, l, r, scope, mode):
        pre, post = (self.CMP_MUST if mode == "must" else self.CMP_IS)[op]
        left = self._art(self.v(l, scope, "val_each"), False)
        right = self._art(self.v(r, scope, "val"), op in ("=", "!="))
        return left + [pre] + right + [post]

    def scope_text(self, scope):
        if not scope or not scope.get("t"):
            return []
        t = scope.get("t")
        out = []
        if t:
            out.append({"ref": {"t": t}, "text": tcode(t), "tip": self.L.table_name(t) or ""})
        for axis in ("c", "r", "s"):
            if axis in scope:
                codes = self._expand(t, axis, scope[axis])
                res = self._axis_text(t, axis, codes)
                text, tip = res if isinstance(res, tuple) else (res, "")
                if codes == "*":
                    text = "für " + text
                elif isinstance(codes, list) and len(codes) == 1:
                    text = AXIS_WORD[axis][0] + " " + text
                else:
                    text = "für " + text
                out.append({"ref": None, "text": text, "tip": tip})
        res = []
        for i, seg in enumerate(out):
            if i:
                res.append(", ")
            res.append(seg)
        return ["In "] + res + [": "] if res else []

    def rule(self, expr: str):
        ast = parse(expr)
        body = self.v(ast["expr"], ast["scope"], "must")
        segs = self.scope_text(ast["scope"]) + body
        if segs:
            if isinstance(segs[-1], str) and not segs[-1].endswith("."):
                segs[-1] += "."
            else:
                segs.append(".")
        # Satzanfang groß
        if isinstance(segs[0], str) and segs[0]:
            segs[0] = segs[0][0].upper() + segs[0][1:]
        return _merge(segs)

    def precondition(self, expr: str):
        ast = parse(expr)
        return _merge(self.v(ast["expr"], ast["scope"], "is"))


def _merge(segs):
    out = []
    for s in segs:
        if s == "" or s is None:
            continue
        if isinstance(s, str) and out and isinstance(out[-1], str):
            out[-1] += s
        else:
            out.append(s)
    return out


# --------------------------------------------------------------------------- Kanonische Form

def canonical(expr: str) -> str:
    """Schreibweisen-unabhängige Form einer Regel: 'with'-Scope in die Zellbezüge gezogen, Reihenfolge
    kommutativer Operanden (+, =, und, oder, Mengen) sortiert, Klammern und 'interval' ignoriert.
    Zwei Regeln mit gleicher kanonischer Form prüfen inhaltlich dasselbe."""
    ast = parse(expr)
    scope = {k: v for k, v in (ast["scope"] or {}).items() if k in ("t", "r", "c", "s", "default")}

    def axis(spec):
        if spec is None:
            return "-"
        if spec.get("all"):
            return "*"
        return ",".join(sorted("-".join(x) if isinstance(x, list) else x for x in spec["items"]))

    def ref(r):
        if "tablevar" in r:
            return f"v({r['tablevar']})"
        e = {**scope, **r}
        return "{" + "|".join([e.get("t", "-"), axis(e.get("r")), axis(e.get("c")), axis(e.get("s")),
                               str(e.get("default", "")).strip('"'), ",".join(sorted(r.get("items", [])))]) + "}"

    def terms(n, sign, out):
        if n.get("op") in ("+", "-"):
            terms(n["args"][0], sign, out)
            terms(n["args"][1], sign if n["op"] == "+" else -sign, out)
        elif n.get("op") == "paren":
            terms(n["args"][0], sign, out)
        elif n.get("op") == "neg":
            terms(n["args"][0], -sign, out)
        else:
            out.append(("+" if sign > 0 else "-") + c(n))
        return out

    def flat(n, op, out):
        if n.get("op") == op:
            for a in n["args"]:
                flat(a, op, out)
        elif n.get("op") == "paren":
            flat(n["args"][0], op, out)
        else:
            out.append(c(n))
        return out

    def c(n):
        if "ref" in n:
            return ref(n["ref"])
        if "item" in n:
            return f"[{n['item']}]"
        for k in ("num", "str", "lit", "id"):
            if k in n:
                return f"{k}:{n[k]}"
        if "fn" in n:
            return f"{n['fn']}(" + ";".join(c(a) for a in n["args"]) + (f"|{','.join(n['group'])}" if n.get("group") else "") + ")"
        op, a = n["op"], n["args"]
        if op == "paren":
            return c(a[0])
        if op in ("+", "-", "neg"):
            return "(" + "".join(sorted(terms(n, 1, []))) + ")"
        if op in ("and", "or"):
            return f"{op}(" + ";".join(sorted(flat(n, op, []))) + ")"
        if op in ("=", "!="):
            return op.join(sorted([c(a[0]), c(a[1])]))
        if op in (">=", ">", "<=", "<"):  # a >= b  ==  b <= a
            mirror = {">=": "<=", ">": "<"}
            if op in mirror:
                return f"{c(a[1])}{mirror[op]}{c(a[0])}"
            return f"{c(a[0])}{op}{c(a[1])}"
        if op == "in":
            return f"{c(a[0])} in [{','.join(sorted(n['items']))}]"
        return f"{op}(" + ";".join(c(x) for x in a) + ")"

    return c(ast["expr"])
