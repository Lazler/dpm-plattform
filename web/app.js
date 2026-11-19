// DPM Explorer – Meldebögen, Regeln, Lineage, Datenpunkte, Hierarchien und DPM-Struktur
// Reines ES-Modul ohne Build-Schritt. Daten kommen aus ./data (siehe scripts/build_data.py).

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tc = (code) => (code || "").replace(/_/g, " ");
const fmt = (n) => Number(n || 0).toLocaleString("de-DE");
const fetchJSON = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + ": " + r.status); return r.json(); });

const MOD_LABEL = { FINREP9: "FINREP (IFRS 9)", AE: "Asset Encumbrance" };
const SRC_LABEL = {
  hierarchy: "Summenregel", sign: "Vorzeichen", user_defined: "Fachliche Regel",
  variant: "Variante", existence: "Existenz", property_constraint: "Werte-Einschränkung",
};
const DTYPE = {
  monetary: "Geldbetrag", decimal: "Dezimalzahl", integer: "Ganzzahl", percentage: "Prozentsatz", boolean: "Ja/Nein",
  true: "nur „wahr“", date: "Datum", "date time": "Datum/Uhrzeit", enumeration: "Aufzählung (Werteliste)",
  "string (non empty)": "Text", "string (including empty string)": "Text (auch leer)", URI: "URI", ordinals: "Ordinalzahl",
};
const SIGN = { positive: "positiv (≥ 0)", negative: "negativ (≤ 0)" };

const PREF = (() => { try { return JSON.parse(localStorage.getItem("dpmx") || "{}"); } catch { return {}; } })();
const savePref = () => { try { localStorage.setItem("dpmx", JSON.stringify(PREF)); } catch { /* ohne Speicher weiter */ } };

const S = {
  meta: null, rules: null, ruleCells: null, lineage: null, search: null, lab: null,
  mod: PREF.mod || "FINREP9", doc: null, docs: new Map(), sheet: null, sel: null,
  view: null, ruleFilter: "all", cellRules: null, dtab: "ov", openRules: new Set(),
  layer: PREF.layer || "marker", zoom: PREF.zoom || 1, tocOpen: PREF.tocOpen !== false,
  collapsed: new Set(PREF.collapsed || []),
  diff: null, diffIdx: [], cmpTypes: new Set(),
  dp: null, dpf: { metric: null, dims: new Map(), text: "", mods: new Set(["FINREP9", "AE"]), open: new Set() },
  hier: null, hi: { cat: null, sub: null, hit: null, filter: "" },
  find: { hits: [], i: -1 },
  linMode: "focus", linMods: new Set(["FINREP9", "AE"]), linRule: null, linFocus: null,
};

// ------------------------------------------------------------------ Start
init().catch((e) => {
  console.error(e);
  document.body.innerHTML = `<pre style="padding:20px">Fehler beim Laden: ${esc(e.message)}\n\nBitte die App über einen Webserver öffnen (siehe README).</pre>`;
});

async function init() {
  $("#start").innerHTML = '<div class="empty">Lade Daten …</div>';
  setViewClass("start");
  const [meta, rules, lineage, search, diffIdx] = await Promise.all([
    fetchJSON("data/meta.json"), fetchJSON("data/rules.json"), fetchJSON("data/lineage.json"), fetchJSON("data/search.json"),
    fetchJSON("data/diff/index.json").catch(() => []),
  ]);
  S.inst = await fetchJSON("data/instructions.json").catch(() => ({ docs: [], items: [] }));
  S.instBy = new Map();
  for (const it of S.inst.items) for (const l of it.links) {
    if (!S.instBy.has(l.t)) S.instBy.set(l.t, []);
    S.instBy.get(l.t).push([it, l]);
  }
  S.meta = meta; S.rules = rules.rules; S.ruleCells = rules.cells; S.lineage = lineage; S.search = search; S.diffIdx = diffIdx;
  S.lab = new Map(search.map((h) => [`${h[0]}|${h[1]}|${h[2]}`, h[3]]));
  S.cellRules = new Map();
  for (const r of Object.values(S.rules)) for (const c of r.cells) {
    if (!S.cellRules.has(c)) S.cellRules.set(c, []);
    S.cellRules.get(c).push(r.id);
  }
  if (!S.meta.modules.some((m) => m.key === S.mod)) S.mod = S.meta.modules[0].key;
  $("#rel").textContent = `Release ${meta.release.Code}`;
  $$("#views button").forEach((b) => b.onclick = () => setView(b.dataset.view));
  $("#brand").onclick = () => setView("start");
  $("#dclose").onclick = () => { $("#details").hidden = true; selectCell(null); };
  initSearch(); initTooltips(); initCompare(); initRibbon(); initKeys();
  renderModSel();
  window.addEventListener("popstate", route);
  window.addEventListener("hashchange", route);
  await route();
}

// ------------------------------------------------------------------ Navigation
function nav(hash, push) {
  if (location.hash === hash) return;
  try { push ? history.pushState(null, "", hash) : history.replaceState(null, "", hash); } catch { /* eingebettete Ansicht ohne Verlauf */ }
}
function sheetHash() {
  if (!S.doc) return "#/";
  const p = new URLSearchParams();
  if (S.sel) { const c = cellCodes(S.doc, S.sel); if (c.r) p.set("r", c.r); if (c.c) p.set("c", c.c); if (c.s) p.set("s", c.s); }
  return `#/${S.doc.code}${p.toString() ? "?" + p : ""}`;
}
function parseHash() {
  const m = location.hash.match(/^#\/([^?]+)(?:\?(.*))?$/);
  if (!m) return {};
  const p = new URLSearchParams(m[2] || "");
  return { t: decodeURIComponent(m[1]), r: p.get("r"), c: p.get("c"), s: p.get("s") };
}
let routing = null;
async function route() {
  const h = location.hash;
  if (routing === h) return;
  routing = h;
  try { await doRoute(h); } finally { routing = null; }
}
async function doRoute(h) {
  if (h.startsWith("#/")) {
    const x = parseHash();
    setView("sheet", { noHash: true, skipOpen: true });
    if (x.t && (!S.doc || x.t !== S.doc.code)) await openTable(x.t, x, { noHash: true });
    else if (x.t && S.doc) {
      const cell = findCell(S.doc, x);
      if (cell && cell !== S.sel) selectCell(cell, true, true);
    } else if (!S.doc) await openTable(firstTable(S.mod), {}, { noHash: true });
  } else if (h.startsWith("#!")) setView(h.slice(2), { noHash: true });
  else setView("start", { noHash: true });
}

function setViewClass(v) {
  $$("#views button").forEach((b) => b.classList.toggle("on", b.dataset.view === v));
  $$(".view").forEach((s) => s.classList.toggle("on", s.id === "view-" + v));
}
function setView(v, opt = {}) {
  const changed = S.view !== v;
  S.view = v;
  setViewClass(v);
  hideTip();
  if (!opt.noHash) nav(v === "sheet" ? sheetHash() : `#!${v}`, changed);
  if (v === "start") renderStart();
  if (v === "sheet" && !S.doc && !opt.skipOpen) openTable(firstTable(S.mod), {}, { noHash: opt.noHash });
  if (v === "sheet" && S.doc) requestAnimationFrame(applyFreeze);
  if (v === "lineage") renderLineage();
  if (v === "model") renderModel();
  if (v === "dp") renderDP();
  if (v === "hier") renderHier();
}

const modTables = (m) => S.meta.modules.find((x) => x.key === m).tables;
const firstTable = (m) => modTables(m).find((t) => !t.abstract).code;
const moduleOf = (code) => S.meta.modules.find((m) => m.tables.some((t) => t.code === code && !t.abstract))?.key;
const tableName = (code) => S.meta.modules.flatMap((m) => m.tables).find((t) => t.code === code)?.name
  || (S.lineage.nodes.find((x) => x.code === code) || {}).name || "";

// ------------------------------------------------------------------ Startseite
function renderStart() {
  const M = S.meta;
  const cur = M.release;
  const idx = S.diffIdx;
  const sumTxt = (d) => {
    const s = d.summary, parts = [];
    const nt = (s.tables_changed || 0) + (s.tables_new || 0);
    if (!nt && !s.rules_add && !s.rules_del && !s.rules_chg) return "keine Änderungen an FINREP/AE";
    if (s.tables_new) parts.push(`${s.tables_new} neue Bögen`);
    if (s.tables_changed) parts.push(`${s.tables_changed} Bögen geändert`);
    const r = [s.rules_add && `${s.rules_add} neu`, s.rules_chg && `${s.rules_chg} geändert`, s.rules_del && `${s.rules_del} entfallen`].filter(Boolean);
    if (r.length) parts.push(`Regeln: ${r.join(", ")}`);
    return parts.join(" · ");
  };
  const modCards = M.modules.map((m) => {
    const tabs = m.tables.filter((t) => !t.abstract);
    const cells = tabs.reduce((a, t) => a + (t.cells || 0), 0);
    return `<div class="card"><h3>${esc(MOD_LABEL[m.key] || m.name)}</h3>
      <div class="sub">${esc(m.framework)} · Modul ${esc(m.code)} · Stichtage ab ${esc(m.from)}</div>
      <div class="kpis"><div class="kpi"><b>${fmt(tabs.length)}</b><span>Meldebögen</span></div>
        <div class="kpi"><b>${fmt(cells)}</b><span>Zellen</span></div>
        <div class="kpi"><b>${fmt(m.rules)}</b><span>aktive Regeln</span></div></div>
      <div class="acts"><button class="btn" data-open="${m.key}">Meldebögen öffnen</button>
        <button class="btn sec" data-dp="${m.key}">Datenpunkte durchsuchen</button></div></div>`;
  }).join("");
  const how = [
    ["sheet", "▦", "Meldebögen wie in Excel", "Klick auf eine Zelle zeigt Datenpunkt, Dimensionen und alle Validierungsregeln – in verständlichen Sätzen."],
    ["lineage", "⇄", "Lineage", "Wie hängen Bögen und Zellen über Regeln zusammen? Bogen in den Fokus nehmen oder einer Zelle folgen."],
    ["dp", "⌕", "Datenpunkte", "Alle Zellen mit bestimmten Merkmalen finden, z. B. Sektor = Households und Kennzahl = Gross carrying amount."],
    ["hier", "⌗", "Hierarchien", "Wertelisten und Summenhierarchien der Dimensionen – und die Regeln, die daraus entstehen."],
    ["model", "◈", "DPM-Struktur", "Wie ist das Data Point Model aufgebaut? Erklärt am Beispiel deiner gewählten Zelle."],
    ["compare", "Δ", "Release-Vergleich", "In der Meldebogen-Ansicht „Änderungen seit …“ wählen: neue Zellen, Regeln, Bezeichnungen."],
  ].map(([v, ic, t, p]) => `<div class="card" data-go="${v}"><div class="ic">${ic}</div><b>${esc(t)}</b><p>${esc(p)}</p></div>`).join("");
  $("#start").innerHTML = `
    <h1>DPM Explorer</h1>
    <p class="lead">Die EBA-Datenbank (DPM 2.0) in der Sprache der Meldebögen: Templates im Excel-Look, Datenpunkte mit ihren Dimensionen, Validierungsregeln in Worten und die Zusammenhänge zwischen allem.</p>
    <div class="cards">${modCards}
      <div class="card"><h3>Release ${esc(cur.Code)}</h3><div class="sub">aktuelles Release vom ${esc(cur.Date)}</div>
        <ul class="chlist">${idx.slice(0, 4).map((d) => `<li><b>seit ${esc(d.code)}:</b> ${esc(sumTxt(d))} <button class="lnk" data-cmp="${esc(d.code)}">ansehen</button></li>`).join("")}</ul>
        <div class="sub" style="margin:10px 0 0">Instructions: ${S.inst.items.length ? `${fmt(S.inst.items.length)} Einträge aus ${S.inst.docs.length} Word-Dokument(en)` : "noch keine Word-Dateien importiert"}</div></div>
    </div>
    <div class="sh">Was du hier tun kannst</div>
    <div class="how">${how}</div>
    <div class="sh">Tastatur</div>
    <div class="card keys"><kbd>/</kbd> Suche · <kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> Zelle wechseln · <kbd>Enter</kbd> Details · <kbd>Esc</kbd> schließen ·
      <kbd>Strg</kbd>+<kbd>F</kbd> im Bogen suchen · <kbd>Strg</kbd>+<kbd>C</kbd> Zellbezug kopieren · <kbd>Strg</kbd>+<kbd>Bild↑/↓</kbd> Blatt wechseln</div>`;
  $$("#start [data-open]").forEach((b) => b.onclick = () => { S.mod = b.dataset.open; renderModSel(); openTable(firstTable(S.mod)); setView("sheet"); });
  $$("#start [data-dp]").forEach((b) => b.onclick = () => { S.dpf.mods = new Set([b.dataset.dp]); setView("dp"); });
  $$("#start [data-cmp]").forEach((b) => b.onclick = async () => { $("#cmpsel").value = b.dataset.cmp; await setCompare(b.dataset.cmp); $("#cmponly").checked = true; setView("sheet"); renderToc(); });
  $$("#start [data-go]").forEach((c) => c.onclick = () => {
    if (c.dataset.go === "compare") { setView("sheet"); $("#cmpsel").focus(); } else setView(c.dataset.go);
  });
}

// ------------------------------------------------------------------ Modul & Inhaltsverzeichnis
function renderModSel() {
  $("#modsel").innerHTML = S.meta.modules.map((m) =>
    `<button data-m="${m.key}" class="${m.key === S.mod ? "on" : ""}" title="${esc(m.name)} – ${m.tables.filter((t) => !t.abstract).length} Bögen, ${m.rules} Regeln">${esc(MOD_LABEL[m.key] || m.key)}</button>`).join("");
  $$("#modsel button").forEach((b) => b.onclick = () => { S.mod = b.dataset.m; PREF.mod = S.mod; savePref(); renderModSel(); openTable(firstTable(S.mod)); });
  $("#tocfilter").oninput = renderToc;
  $("#toc").hidden = !S.tocOpen;
  renderToc();
}

function renderToc() {
  const f = $("#tocfilter").value.trim().toLowerCase();
  const tabs = modTables(S.mod);
  const only = S.diff && $("#cmponly").checked;
  const match = (x) => (!only || (diffInfo(x.code) && (S.diff.tables[x.code].st === "new" || diffInfo(x.code).content)))
    && (!f || (x.code + " " + tc(x.code) + " " + x.name).toLowerCase().includes(f));
  const groupOf = (t) => t.abstract ? (tabs.find((k) => k.parent === t.code)?.group || t.group) : t.group;
  const groups = [];
  for (const t of tabs) {
    if (t.parent && tabs.some((x) => x.code === t.parent)) continue;
    const g = groupOf(t);
    let grp = groups.find((x) => x.g === g);
    if (!grp) groups.push(grp = { g, items: [], n: 0 });
    if (t.abstract) {
      const kids = tabs.filter((x) => x.parent === t.code && match(x));
      if (!kids.length) continue;
      grp.items.push(`<div class="it par" title="${esc(t.name)}"><b>${esc(tc(t.code))}</b><span class="nm">${esc(t.name)}</span></div>`);
      for (const k of kids) grp.items.push(tocItem(k, true));
      grp.n += kids.length;
    } else if (match(t)) { grp.items.push(tocItem(t)); grp.n++; }
  }
  const html = groups.filter((g) => g.n).map((g) => {
    const closed = S.collapsed.has(g.g) && !f;
    return `<div class="tg ${closed ? "closed" : ""}" data-g="${esc(g.g)}"><span class="car">▾</span>${esc(g.g.replace("FinRep - ", "FINREP – ").replace(" - ", " – "))}<span class="n">${g.n}</span></div>${closed ? "" : g.items.join("")}`;
  }).join("");
  $("#toclist").innerHTML = html || '<div class="empty">Kein Treffer</div>';
  $$("#toclist .it:not(.par)").forEach((el) => el.onclick = () => openTable(el.dataset.t));
  $$("#toclist .tg").forEach((el) => el.onclick = () => {
    S.collapsed.has(el.dataset.g) ? S.collapsed.delete(el.dataset.g) : S.collapsed.add(el.dataset.g);
    PREF.collapsed = [...S.collapsed]; savePref(); renderToc();
  });
}
const tocItem = (t, child) => `<div class="it ${child ? "child" : ""} ${S.doc?.code === t.code ? "on" : ""}" data-t="${t.code}" title="${esc(tc(t.code) + " – " + t.name)}">
  <b>${esc(tc(t.code))}</b><span class="nm">${esc(t.name)}</span>${changeBadge(t.code)}</div>`;

function renderTabs() {
  const doc = S.doc, tabs = modTables(S.mod).filter((t) => !t.abstract), i = tabs.findIndex((t) => t.code === doc?.code);
  $("#shcode").textContent = tc(doc.code);
  $("#shname").textContent = doc.name;
  $("#shmod").textContent = `${MOD_LABEL[doc.module] || doc.module} · ${tabs[i]?.group?.replace("FinRep - ", "FINREP – ") || ""}`;
  const prev = tabs[(i - 1 + tabs.length) % tabs.length], next = tabs[(i + 1) % tabs.length];
  $("#prevt").title = `Vorheriger Bogen: ${tc(prev.code)} (Strg+Bild↑)`; $("#prevt").onclick = () => openTable(prev.code);
  $("#nextt").title = `Nächster Bogen: ${tc(next.code)} (Strg+Bild↓)`; $("#nextt").onclick = () => openTable(next.code);
}

// ------------------------------------------------------------------ Ribbon, Zoom, Suche im Bogen
function initRibbon() {
  $("#toctoggle").onclick = () => { S.tocOpen = !S.tocOpen; PREF.tocOpen = S.tocOpen; savePref(); $("#toc").hidden = !S.tocOpen; requestAnimationFrame(applyFreeze); };
  const setLayer = (l) => {
    S.layer = l; PREF.layer = l; savePref();
    $$("#layer button").forEach((b) => b.classList.toggle("on", b.dataset.l === l));
    if (S.doc) { const sel = S.sel; renderGrid(); if (sel) selectCell(sel, false, true); }
  };
  $$("#layer button").forEach((b) => b.onclick = () => setLayer(b.dataset.l));
  $$("#layer button").forEach((b) => b.classList.toggle("on", b.dataset.l === S.layer));
  const setZoom = (z) => {
    S.zoom = Math.max(0.7, Math.min(1.4, Math.round(z * 10) / 10)); PREF.zoom = S.zoom; savePref();
    document.documentElement.style.setProperty("--z", S.zoom);
    $("#zval").textContent = Math.round(S.zoom * 100) + " %";
    requestAnimationFrame(applyFreeze);
  };
  $("#zminus").onclick = () => setZoom(S.zoom - 0.1);
  $("#zplus").onclick = () => setZoom(S.zoom + 0.1);
  setZoom(S.zoom);
  $("#copyref").onclick = copyRef;
  $("#export").onclick = exportCsv;
  if (document.getElementById("demoflag")) $("#export").hidden = true; // in eingebetteten Demos sind Downloads gesperrt
  const fi = $("#find");
  fi.oninput = () => runFind(fi.value);
  fi.onkeydown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); }
    if (e.key === "Escape") { fi.value = ""; runFind(""); $("#gridwrap").focus(); }
  };
}

function runFind(q) {
  $$("#gridwrap .found").forEach((x) => x.classList.remove("found", "cur"));
  S.find = { hits: [], i: -1 };
  q = q.trim().toLowerCase();
  if (!q) { $("#findinfo").textContent = ""; return; }
  S.find.hits = $$("#gridwrap td.rl, #gridwrap td.h, #gridwrap td.rc, #gridwrap td.hc").filter((td) => td.textContent.toLowerCase().includes(q));
  S.find.hits.forEach((td) => td.classList.add("found"));
  $("#findinfo").textContent = S.find.hits.length ? `${S.find.hits.length} Treffer` : "kein Treffer";
  stepFind(1);
}
function stepFind(d) {
  const F = S.find;
  if (!F.hits.length) return;
  F.hits[F.i]?.classList.remove("cur");
  F.i = (F.i + d + F.hits.length) % F.hits.length;
  const td = F.hits[F.i];
  td.classList.add("cur");
  td.scrollIntoView({ block: "center", inline: "nearest" });
  $("#findinfo").textContent = `${F.i + 1} von ${F.hits.length}`;
}

// Export des aktuellen Bogens: eine Zeile je Zelle mit Datenpunkt und Regeln (Excel-kompatibel)
function exportCsv() {
  const doc = S.doc;
  if (!doc) return;
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Bogen", "Zeile", "Zeilenbezeichnung", "Spalte", "Spaltenbezeichnung", "Blatt", "Status", "Kennzahl", "Datentyp",
    "Dimensionen", "Vorzeichen", "Leer erlaubt", "Anzahl Regeln", "davon Fehler", "Regelcodes", "Regeln in Worten"];
  const lines = [head.map(q).join(";")];
  for (const c of doc.cells) {
    const k = cellCodes(doc, c), v = doc.vars[c.var];
    const rs = c.rules.map((id) => S.rules[id]).filter(Boolean);
    lines.push([tc(doc.code), k.r, hPath(doc, c.r).map((h) => h.label).join(" › "), k.c, hPath(doc, c.c).map((h) => h.label).join(" › "),
      k.s ? `${k.s} ${doc.hById.get(c.s)?.label || ""}` : "", c.excl ? "grau" : "meldepflichtig", v?.metric[0] || "", DTYPE[v?.metric[2]] || v?.metric[2] || "",
      (v?.dims || []).map((d) => `${d[0]}: ${d[2]}`).join(" | "), SIGN[c.sign] || c.sign || "", c.nullable ? "ja" : "nein",
      rs.length, rs.filter((r) => ruleSev(r, doc.module) === "error").length, rs.map((r) => r.code).join(", "),
      rs.map((r) => `${r.code}: ${plain(r.verbal)}`).join("\n")].map(q).join(";"));
  }
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${doc.code}_Release_${S.meta.release.Code}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(`${doc.cells.length} Zellen exportiert`);
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 1800);
}
function cellRef(doc, cell) {
  const k = cellCodes(doc, cell);
  return `{${tc(doc.code)}, r${k.r}, c${k.c}${k.s ? ", s" + k.s : ""}}`;
}
function copyRef() {
  if (!S.sel || !S.doc) { toast("Bitte zuerst eine Zelle wählen"); return; }
  const v = S.doc.vars[S.sel.var], k = cellCodes(S.doc, S.sel);
  const txt = `${cellRef(S.doc, S.sel)} – ${S.lab.get(`${S.doc.code}|r|${k.r}`) || ""} / ${S.lab.get(`${S.doc.code}|c|${k.c}`) || ""}${v ? ` (${v.metric[0]})` : ""}`;
  (navigator.clipboard?.writeText(txt) || Promise.reject()).then(() => toast("Zellbezug kopiert: " + cellRef(S.doc, S.sel)), () => toast(txt));
}

// ------------------------------------------------------------------ Tastatur
function initKeys() {
  document.addEventListener("keydown", (e) => {
    const inField = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName);
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === "/" && !inField) { e.preventDefault(); $("#q").focus(); return; }
    if (S.view !== "sheet") return;
    if (mod && e.key.toLowerCase() === "f") { e.preventDefault(); $("#find").focus(); $("#find").select(); return; }
    if (inField) return;
    if (mod && e.key.toLowerCase() === "c" && !String(window.getSelection())) { e.preventDefault(); copyRef(); return; }
    if (mod && (e.key === "PageDown" || e.key === "PageUp")) {
      e.preventDefault();
      const tabs = modTables(S.mod).filter((t) => !t.abstract), i = tabs.findIndex((t) => t.code === S.doc?.code);
      const n = tabs[(i + (e.key === "PageDown" ? 1 : -1) + tabs.length) % tabs.length];
      openTable(n.code); return;
    }
    const dirs = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0], Tab: [0, e.shiftKey ? -1 : 1] };
    if (dirs[e.key]) { e.preventDefault(); moveSel(...dirs[e.key]); return; }
    if (e.key === "Enter" && S.sel) { $("#details").hidden = false; renderDetails(S.sel); return; }
    if (e.key === "Escape") { if (!$("#details").hidden) { $("#details").hidden = true; } return; }
  });
}

function gridMatrix() {
  return $$("#gridwrap tbody tr.br").map((tr) => $$("td.d", tr));
}
function moveSel(dr, dc) {
  const M = gridMatrix();
  if (!M.length) return;
  let ri = 0, ci = 0;
  const td = S.sel && $(`#gridwrap td.d[data-id="${S.sel.id}"]`);
  if (td) { ri = M.findIndex((r) => r.includes(td)); ci = M[ri].indexOf(td); }
  else { dr = 0; dc = 0; }
  const ok = (r, c) => M[r] && M[r][c] && M[r][c].dataset.id;
  let r = ri, c = ci;
  if (!td) { // erste vorhandene Zelle
    for (r = 0; r < M.length; r++) { c = M[r].findIndex((x) => x.dataset.id && !x.classList.contains("g")); if (c >= 0) break; }
    if (r >= M.length) return;
  } else {
    for (let step = 0; step < 400; step++) {
      r += dr; c += dc;
      if (c < 0 || c >= M[0].length || r < 0 || r >= M.length) {
        if (dc && !dr) { r += dc; c = dc > 0 ? 0 : M[0].length - 1; if (r < 0 || r >= M.length) return; }
        else return;
      }
      if (ok(r, c)) break;
    }
    if (!ok(r, c)) return;
  }
  selectCell(S.doc.cById.get(+M[r][c].dataset.id), "nearest");
}

// ------------------------------------------------------------------ Tabellen laden & Layout
async function loadDoc(code) {
  if (S.docs.has(code)) return S.docs.get(code);
  const doc = await fetchJSON(`data/tables/${encodeURIComponent(code)}.json`);
  prepare(doc);
  S.docs.set(code, doc);
  return doc;
}

function prepare(doc) {
  doc.hById = new Map(doc.headers.map((h, i) => [h.id, { ...h, idx: i }]));
  doc.cById = new Map(doc.cells.map((c) => [c.id, c]));
  const dirOf = (d) => doc.headers.filter((h) => h.dir === d).map((h) => doc.hById.get(h.id));
  doc.X = dirOf("X"); doc.Y = dirOf("Y"); doc.Z = dirOf("Z");
  doc.sheets = doc.Z.filter((h) => !h.key);
  doc.cellMap = new Map();
  for (const c of doc.cells) doc.cellMap.set(`${c.r ?? ""}|${c.c ?? ""}|${doc.sheets.length ? c.s ?? "" : ""}`, c);
  doc.byCodes = new Map();
  for (const c of doc.cells) { const k = cellCodes(doc, c); doc.byCodes.set(`${k.r}|${k.c}|${k.s}`, c); }
}

function cellCodes(doc, c) {
  return { r: doc.hById.get(c?.r)?.code || "", c: doc.hById.get(c?.c)?.code || "", s: doc.hById.get(c?.s)?.code || "" };
}
function findCell(doc, t) {
  if (!t.r && !t.c) return null;
  const s = t.s || (doc.sheets.length ? doc.hById.get(S.sheet)?.code || "" : "");
  return doc.byCodes.get(`${t.r || ""}|${t.c || ""}|${s}`)
    || doc.cells.find((c) => { const k = cellCodes(doc, c); return k.r === (t.r || "") && k.c === (t.c || ""); });
}
function hPath(doc, id) {
  const out = [];
  let h = doc.hById.get(id);
  while (h) { out.unshift(h); h = doc.hById.get(h.parent); if (h && out.includes(h)) break; }
  return out;
}

function buildLayout(doc) {
  const xset = new Set(doc.X.map((h) => h.id));
  const colsWithCells = new Set(doc.cells.map((c) => c.c));
  const kids = new Map();
  for (const h of doc.X) {
    const p = xset.has(h.parent) ? h.parent : null;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(h);
  }
  const cols = [];
  let D = 1;
  const walk = (h, d) => {
    h._d = d; D = Math.max(D, d + 1);
    const ch = kids.get(h.id) || [];
    h._kids = ch; h._self = false;
    if (!ch.length) { cols.push(h); h._span = 1; return 1; }
    let n = 0;
    if (h.code && colsWithCells.has(h.id)) { cols.push(h); h._self = true; n = 1; }
    for (const c of ch) n += walk(c, d + 1);
    h._span = n; return n;
  };
  for (const h of kids.get(null) || []) walk(h, 0);
  const hrows = Array.from({ length: D }, () => []);
  const emit = (h) => {
    const leaf = !h._kids.length;
    hrows[h._d].push({ h, colspan: h._span, rowspan: leaf ? D - h._d : 1 });
    if (h._self && D - h._d - 1 > 0) hrows[h._d + 1].push({ blank: true, colspan: 1, rowspan: D - h._d - 1, h });
    for (const c of h._kids) emit(c);
  };
  for (const h of kids.get(null) || []) emit(h);
  const yset = new Set(doc.Y.map((h) => h.id));
  const depth = new Map();
  for (const h of doc.Y) {
    const p = yset.has(h.parent) ? doc.hById.get(h.parent) : null;
    depth.set(h.id, p ? (depth.get(p.id) ?? 0) + (p.idx < h.idx ? 1 : 0) : 0);
  }
  const hasKids = new Set(doc.Y.map((h) => h.parent));
  const rows = doc.Y.map((h) => ({ h, depth: depth.get(h.id), top: !yset.has(h.parent) && hasKids.has(h.id) }));
  return { cols, hrows, D, rows };
}

async function openTable(code, target = {}, opt = {}) {
  const mod = moduleOf(code);
  if (mod && mod !== S.mod) { S.mod = mod; PREF.mod = mod; savePref(); renderModSel(); }
  const doc = await loadDoc(code);
  const changed = S.doc !== doc;
  S.doc = doc; S.sel = null;
  if (S.view !== "sheet") { S.view = "sheet"; setViewClass("sheet"); }
  S.sheet = doc.sheets.length ? (doc.sheets.find((z) => z.code === target.s) || doc.sheets[0]).id : null;
  $("#find").value = ""; $("#findinfo").textContent = "";
  renderToc(); renderTabs(); renderZbar(); renderGrid();
  $("#toclist .on")?.scrollIntoView({ block: "nearest" });
  const cell = findCell(doc, target);
  if (cell) selectCell(cell, "center", true);
  else {
    $("#details").hidden = true;
    $("#namebox").textContent = "–";
    $("#fxval").innerHTML = '<span class="muted">Zelle anklicken oder mit den Pfeiltasten wählen</span>';
  }
  if (!opt.noHash) nav(sheetHash(), changed);
}

function renderZbar() {
  const doc = S.doc, z = $("#zbar");
  const keyZ = doc.Z.filter((h) => h.key);
  if (!doc.sheets.length && !keyZ.length && !doc.open.rows) { z.hidden = true; return; }
  z.hidden = false;
  const parts = [];
  if (doc.sheets.length) {
    parts.push(`<b>Blatt (z-Achse):</b> <select id="zsel">${doc.sheets.map((s) =>
      `<option value="${s.id}" ${s.id === S.sheet ? "selected" : ""}>${esc(s.code ? s.code + " – " : "")}${esc(s.label)}</option>`).join("")}</select>`);
  }
  for (const k of keyZ) parts.push(`<span>🔑 Offene z-Achse: ein Blatt je <b>${esc(k.keyprop?.[0] || k.label)}</b></span>`);
  if (doc.open.rows) parts.push(`<span>🔑 Offene Tabelle: beliebig viele Zeilen, identifiziert über die Schlüsselspalten</span>`);
  z.innerHTML = parts.join(" ");
  const sel = $("#zsel");
  if (sel) sel.onchange = () => { S.sheet = +sel.value; S.sel = null; renderGrid(); };
}

function colName(i) { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

function ruleSev(r, mod) { return r.sev[mod] || Object.values(r.sev)[0]; }

function renderGrid() {
  const doc = S.doc, L = buildLayout(doc);
  doc.L = L;
  const DI = diffInfo(doc.code);
  const labCh = new Map(DI ? [...DI.labs].filter(([, l]) => S.cmpTypes.has(l.type)).map(([k, l]) => [k, l.old]) : []);
  const chCls = (c) => DI ? [...(DI.cellTypes.get(c.id) || [])].filter((t) => S.cmpTypes.has(t)).map((t) => "ch-" + t).join(" ") : "";
  const ncols = 2 + L.cols.length;
  const sheetKey = doc.sheets.length ? S.sheet : "";
  let rn = 0, nRep = 0;
  const allRules = new Set();
  const out = [];
  out.push(`<table class="xl" role="grid"><tbody>`);
  const row = (inner, attrs = "") => (rn++, `<tr ${attrs}>${inner}</tr>`);
  L.hrows.forEach((hr, d) => {
    let inner = "";
    if (d === 0) inner += `<td class="lb lb1" rowspan="${L.D + 1}"></td><td class="lb lb2" rowspan="${L.D + 1}"></td>`;
    for (const x of hr) {
      if (x.blank) inner += `<td class="h" colspan="1" rowspan="${x.rowspan}"></td>`;
      else {
        const old = labCh.get(`c|${x.h.code}`);
        inner += `<td class="h ${old != null ? "ch-lab" : ""}" colspan="${x.colspan}" rowspan="${x.rowspan}" title="${esc(old != null ? "Bisher: " + old : x.h.label)}">${esc(x.h.label)}</td>`;
      }
    }
    out.push(row(inner, `class="hdr"`));
  });
  out.push(row(L.cols.map((h, i) => `<td class="hc ${h.key ? "key" : ""}" data-ci="${i}">${esc(h.code || "")}</td>`).join(""), `class="hdr codes"`));

  const dataCells = (rid) => L.cols.map((h) => {
    const c = doc.cellMap.get(`${rid ?? ""}|${h.id}|${sheetKey ?? ""}`);
    if (!c) return `<td class="d g"></td>`;
    if (c.excl) return `<td class="d g ${chCls(c)}" data-id="${c.id}"></td>`;
    nRep++;
    c.rules.forEach((id) => allRules.add(id));
    let cls = "", inner = "";
    if (S.layer !== "off" && c.rules.length) {
      const rs = c.rules.map((id) => S.rules[id]).filter(Boolean);
      const err = rs.some((r) => ruleSev(r, doc.module) === "error");
      if (S.layer === "marker" && err) inner = `<i class="mk"></i>`;
      if (S.layer === "heat") {
        const n = rs.length;
        cls = `h${n <= 2 ? 1 : n <= 5 ? 2 : n <= 10 ? 3 : n <= 20 ? 4 : 5}${err ? " he" : ""}`;
        inner = String(n);
      }
    }
    return `<td class="d ${c.void ? "v" : ""} ${cls} ${chCls(c)}" data-id="${c.id}">${inner}</td>`;
  }).join("");

  if (!L.rows.length) {
    for (let i = 0; i < 3; i++) out.push(row(`<td class="rc">…</td><td class="rl"><span class="ph">offene Zeile ${i + 1}</span></td>${dataCells(null)}`, `class="br"`));
  }
  for (const r of L.rows) {
    const pad = 6 + r.depth * 16;
    const cls = r.h.abs ? "abs" : r.top ? "top" : "";
    const old = labCh.get(`r|${r.h.code}`);
    out.push(row(`<td class="rc">${esc(r.h.code || "")}</td><td class="rl ${cls} ${old != null ? "ch-lab" : ""}" style="padding-left:${pad}px" ${old != null ? `title="Bisher: ${esc(old)}"` : ""}>${esc(r.h.label)}</td>${dataCells(r.h.id)}`, `class="br" data-r="${r.h.id}"`));
  }
  out.push("</tbody></table>");
  renderCmpbar();
  const wrap = $("#gridwrap");
  wrap.innerHTML = out.join("");
  wrap.scrollTop = 0; wrap.scrollLeft = 0;
  const nErr = [...allRules].filter((id) => S.rules[id] && ruleSev(S.rules[id], doc.module) === "error").length;
  $("#status").textContent = `${fmt(nRep)} meldepflichtige Zellen · ${fmt(allRules.size)} Regeln${nErr ? ` (${nErr} Fehler)` : ""}`;
  requestAnimationFrame(applyFreeze);
  const tbl = $("table", wrap);
  tbl.addEventListener("click", (e) => {
    const td = e.target.closest("td.d[data-id]");
    if (td) selectCell(doc.cById.get(+td.dataset.id));
  });
  tbl.addEventListener("mouseover", (e) => {
    const td = e.target.closest("td.d[data-id]");
    if (!td) return;
    const c = doc.cById.get(+td.dataset.id), k = cellCodes(doc, c);
    const rl = S.lab.get(`${doc.code}|r|${k.r}`) || "", cl = S.lab.get(`${doc.code}|c|${k.c}`) || "";
    showTip(e, `r${k.r} · c${k.c}${k.s ? " · s" + k.s : ""}\n${rl}\n${cl}${c.excl ? "\n(grau – nicht zu melden)" : c.rules.length ? `\n${c.rules.length} Validierungsregel(n)` : ""}`);
  });
  tbl.addEventListener("mouseout", hideTip);
}

// Kopfzeilen beim vertikalen Scrollen fixieren (Zeilenspalten fixiert CSS)
function applyFreeze() {
  const tbl = $("#gridwrap table");
  if (!tbl || !tbl.offsetParent) return;
  let top = 0;
  for (const tr of $$("tr.hdr", tbl)) {
    for (const c of tr.children) c.style.top = top + "px";
    top += tr.offsetHeight;
  }
}
window.addEventListener("resize", () => requestAnimationFrame(applyFreeze));

// ------------------------------------------------------------------ Zellauswahl & Details
function selectCell(cell, scroll, noHash) {
  $$("#gridwrap td.sel").forEach((x) => x.classList.remove("sel"));
  $$("#gridwrap tr.sel, #gridwrap td.hc.sel").forEach((x) => x.classList.remove("sel"));
  S.sel = cell;
  if (!noHash && S.view === "sheet") nav(sheetHash(), false);
  if (!cell) return;
  const doc = S.doc;
  if (cell.s && doc.sheets.length && cell.s !== S.sheet) { S.sheet = cell.s; renderZbar(); renderGrid(); }
  const td = $(`#gridwrap td.d[data-id="${cell.id}"]`);
  if (td) {
    td.classList.add("sel");
    td.parentElement.classList.add("sel");
    const ci = [...td.parentElement.children].indexOf(td) - 2;
    $(`#gridwrap td.hc[data-ci="${ci}"]`)?.classList.add("sel");
    if (scroll) scrollCellIntoView(td, scroll);
  }
  const k = cellCodes(doc, cell);
  const rlab = S.lab.get(`${doc.code}|r|${k.r}`) || "", clab = S.lab.get(`${doc.code}|c|${k.c}`) || "";
  $("#namebox").textContent = `r${k.r} · c${k.c}${k.s ? " · s" + k.s : ""}`;
  $("#fxval").innerHTML = `<b>${esc(rlab)}</b> <span class="x">×</span> <b>${esc(clab)}</b>${cell.excl ? ' <span class="badge grey">grau</span>' : ""}`;
  $("#details").hidden = false;
  S.openRules = new Set();
  renderDetails(cell);
}

// Zelle sichtbar machen – unter Berücksichtigung der fixierten Kopfzeilen und Zeilenspalten
function scrollCellIntoView(td, mode) {
  const wrap = $("#gridwrap");
  const tbl = $("table", wrap);
  const hdrs = $$("tr.hdr", tbl);
  const topFixed = hdrs.reduce((a, tr) => a + tr.offsetHeight, 0);
  const rl = $("td.rl", tbl);
  const leftFixed = rl ? rl.offsetLeft + rl.offsetWidth : 0;
  const r = td.getBoundingClientRect(), w = wrap.getBoundingClientRect();
  const y = r.top - w.top, x = r.left - w.left;
  if (mode === "center") {
    wrap.scrollTop += y - (topFixed + (w.height - topFixed) / 2) + r.height / 2;
    wrap.scrollLeft += x - (leftFixed + (w.width - leftFixed) / 2) + r.width / 2;
    return;
  }
  if (y < topFixed) wrap.scrollTop -= topFixed - y + 4;
  else if (y + r.height > w.height - 14) wrap.scrollTop += y + r.height - w.height + 18;
  if (x < leftFixed) wrap.scrollLeft -= leftFixed - x + 4;
  else if (x + r.width > w.width - 14) wrap.scrollLeft += x + r.width - w.width + 18;
}

function refHtml(seg, curKey) {
  const ref = seg.ref || {};
  const key = ref.t && ref.r && ref.c ? `${ref.t}|${ref.r}|${ref.c}` : null;
  const linkable = ref.t && moduleOf(ref.t);
  const text = esc(seg.text).replace(/„([^„“]*) › ([^„“›]*)“/g, `„<span class="pp">$1 ›</span> $2“`);
  return `<span class="ref ${key && key === curKey ? "cur" : ""} ${linkable ? "" : "nolink"}" data-t="${esc(ref.t || "")}" data-r="${esc(ref.r || "")}" data-c="${esc(ref.c || "")}" data-tip="${esc(seg.tip || "")}">${text}</span>`;
}
function verbal(segs, curKey) {
  if (!segs) return "";
  return segs.map((s) => typeof s === "string" ? esc(s) : refHtml(s, curKey)).join("");
}
const plain = (segs) => (segs || []).map((s) => typeof s === "string" ? s : s.text).join("");

function ruleBody(r, curKey) {
  return `<div class="rv">${r.verbal ? verbal(r.verbal, curKey) : "<i>Keine Verbalisierung verfügbar.</i>"}</div>
    ${r.pre_verbal ? `<div class="pre">Wird nur geprüft, wenn gemeldet: ${verbal(r.pre_verbal)}</div>` : ""}
    <details><summary>Technische Sicht (DPM-XL)</summary>
      <pre class="x">${esc(r.expr)}</pre>
      ${r.desc ? `<div><b>Beschreibung der EBA:</b> ${esc(r.desc)}</div>` : ""}
      ${r.pre ? `<div style="margin-top:4px"><b>Vorbedingung:</b> <code class="c">${esc(r.pre)}</code></div>` : ""}
      <div style="margin-top:4px"><b>Beteiligt:</b> ${r.tables.map((t) => esc(tc(t))).join(", ")} · ${r.cells.length} Zellen</div>
    </details>
    <div class="acts"><button class="lnk" data-act="lineage" data-rule="${r.id}">In Lineage anzeigen</button></div>`;
}

// vollständige Regelkarte (Seitenleisten von Lineage, Hierarchien, Änderungsliste)
function ruleCard(r, curKey, mod) {
  const sev = ruleSev(r, mod), isErr = sev === "error";
  const other = Object.entries(r.sev).filter(([m]) => m !== mod).map(([m, s]) => `${MOD_LABEL[m] || m}: ${s === "error" ? "Fehler" : "Warnung"}`);
  return `<div class="rule ${isErr ? "e" : ""}" data-rule="${r.id}">
    <div class="rh"><b>${esc(r.code)}</b><span class="badge ${isErr ? "e" : "w"}">${isErr ? "Fehler" : "Warnung"}</span>
      <span>${esc(SRC_LABEL[r.src] || r.src)}</span>${r.tables.length > 1 ? `<span>· ${r.tables.length} Bögen</span>` : ""}
      ${other.length ? `<span>· ${esc(other.join(", "))}</span>` : ""}</div>${ruleBody(r, curKey)}</div>`;
}

function ruleSummary(r) {
  let t = plain(r.verbal);
  if (S.doc) {
    const pre = `In ${tc(S.doc.code)}, `;
    if (t.startsWith(pre)) { t = t.slice(pre.length); t = t[0].toUpperCase() + t.slice(1); }
    t = t.split(`${tc(S.doc.code)} · `).join("");
  }
  return t;
}

function ruleRow(r, curKey, mod) {
  const isErr = ruleSev(r, mod) === "error", open = S.openRules.has(r.id);
  return `<div class="rrow ${isErr ? "e" : ""} ${open ? "open" : ""}" data-rule="${r.id}">
    <div class="rs"><span class="dot" title="${isErr ? "Fehler" : "Warnung"}"></span><div class="sum">${esc(ruleSummary(r))}</div>
      <div class="meta"><b>${esc(r.code)}</b><br>${esc(SRC_LABEL[r.src] || r.src)}</div></div>
    <div class="full">${open ? ruleBody(r, curKey) : ""}</div></div>`;
}

function renderDetails(cell) {
  const doc = S.doc, k = cellCodes(doc, cell);
  const v = doc.vars[cell.var];
  const curKey = `${doc.code}|${k.r}|${k.c}`;
  const status = cell.excl ? `<span class="badge grey">grau – nicht zu melden</span>` : cell.void ? `<span class="badge grey">ohne Datenpunkt</span>` : `<span class="badge">meldepflichtig</span>`;
  $("#dtitle").innerHTML = `<div class="ttl"><span class="ccode">${esc(cellRef(doc, cell))}</span><button class="cp" id="dcopy" title="Zellbezug kopieren">⧉</button>${status}</div>
    <div class="tn">${esc(tc(doc.code))} – ${esc(doc.name)}</div>`;
  $("#dcopy").onclick = copyRef;
  const rs = cell.rules.map((id) => S.rules[id]).filter(Boolean);
  const nErr = rs.filter((r) => ruleSev(r, doc.module) === "error").length;
  const linked = new Map();
  for (const r of rs) for (const t of r.tables) if (t !== doc.code) linked.set(t, (linked.get(t) || 0) + 1);
  const chg = cellChangeHtml(cell);
  const tabs = [["ov", "Überblick", ""], ["rules", "Regeln", rs.length ? `<span class="n ${nErr ? "e" : ""}">${rs.length}</span>` : ""],
    ["links", "Zusammenhänge", linked.size + (cell.same?.length || 0) ? `<span class="n">${linked.size + (cell.same?.length || 0)}</span>` : ""]];
  const inst = cellInstructions(doc, cell);
  tabs.splice(2, 0, ["inst", "Instructions", inst.length ? `<span class="n">${inst.length}</span>` : ""]);
  if (chg) tabs.push(["chg", "Änderungen", `<span class="n">Δ</span>`]);
  if (!tabs.some((t) => t[0] === S.dtab)) S.dtab = "ov";
  $("#dtabs").hidden = false;
  $("#dtabs").innerHTML = tabs.map(([id, l, n]) => `<button data-t="${id}" class="${S.dtab === id ? "on" : ""}">${l}${n}</button>`).join("");
  $$("#dtabs button").forEach((b) => b.onclick = () => { S.dtab = b.dataset.t; renderDetails(cell); });

  const html = [];
  if (S.dtab === "ov") {
    const path = (id, ax) => {
      const p = hPath(doc, id);
      if (!p.length) return "–";
      return `<div class="path">${p.map((h, i) => i < p.length - 1 ? `<span class="p">${esc(h.label)} ›</span> ` : `<b>${esc(h.label)}</b>`).join("")} <code class="c">${ax}${esc(p[p.length - 1].code || "")}</code></div>`;
    };
    html.push(`<div class="sec"><h4>Position im Meldebogen</h4><div class="kv">
      <div class="k">Zeile</div><div>${path(cell.r, "r")}</div>
      <div class="k">Spalte</div><div>${path(cell.c, "c")}</div>
      ${cell.s ? `<div class="k">Blatt</div><div>${path(cell.s, "s")}</div>` : ""}</div></div>`);
    if (v) {
      html.push(`<div class="sec"><h4>Datenpunkt</h4><div class="kv">
        <div class="k">Kennzahl</div><div><b>${esc(v.metric[0])}</b> <code class="c">${esc(v.metric[1] || "")}</code></div>
        <div class="k">Datentyp</div><div>${esc(DTYPE[v.metric[2]] || v.metric[2] || "–")}${v.enum ? ` · Werteliste <i>${esc(v.enum[1])}</i>` : ""}</div>
        ${cell.sign ? `<div class="k">Vorzeichen</div><div>${esc(SIGN[cell.sign] || cell.sign)}</div>` : ""}
        <div class="k">Leer erlaubt</div><div>${cell.nullable ? "ja" : "nein – Pflichtangabe"}</div>
        <div class="k">Variable</div><div><code class="c">${esc(v.id)}</code></div></div>
        ${v.dims.length ? `<h4 style="margin-top:12px">Dimensionen <span class="n">${v.dims.length}</span></h4><table class="dims">${v.dims.map((d) =>
          `<tr><td>${esc(d[0])}</td><td><b>${esc(d[2])}</b> <button class="hb" data-hp="${esc(d[0])}" data-hi="${esc(d[3] || "")}" title="In der Hierarchie zeigen">⌗</button><br><code class="c">${esc(d[1] || "")} = ${esc(d[3] || "")}</code></td></tr>`).join("")}</table>` : ""}
        <button class="bigbtn" data-act="dpsim">⌕ Ähnliche Datenpunkte suchen<small>Alle Zellen mit dieser Kennzahl und diesen Merkmalen – Filter anpassbar</small></button></div>`);
    }
    if (rs.length) {
      const top = rs.slice().sort((a, b) => (ruleSev(b, doc.module) === "error") - (ruleSev(a, doc.module) === "error"))[0];
      html.push(`<div class="sec"><h4>Wichtigste Regel</h4>${ruleRow(top, curKey, doc.module)}<button class="lnk" data-tab="rules">Alle ${rs.length} Regeln ansehen</button></div>`);
    }
    const pos = inst.filter((x) => x[1].ax);
    html.push(`<div class="sec"><h4>Instructions</h4>${pos.length ? instHtml(pos.slice(0, 1), true) + `<button class="lnk" data-tab="inst">Alle ${inst.length} Instructions ansehen</button>`
      : inst.length ? `<div class="hint">${inst.length} allgemeine Hinweise zum Bogen.</div><button class="lnk" data-tab="inst">Ansehen</button>` : instEmpty()}</div>`);
  }

  if (S.dtab === "rules") {
    const filt = (r) => S.ruleFilter === "all" || (S.ruleFilter === "e" ? ruleSev(r, doc.module) === "error" : S.ruleFilter === "w" ? ruleSev(r, doc.module) !== "error" : r.tables.length > 1);
    const shown = rs.filter(filt).sort((a, b) => (ruleSev(b, doc.module) === "error") - (ruleSev(a, doc.module) === "error") || a.code.localeCompare(b.code));
    html.push(`<div class="filt">${[["all", `Alle ${rs.length}`], ["e", `Fehler ${nErr}`], ["w", `Warnungen ${rs.length - nErr}`], ["x", "Tabellenübergreifend"]].map(([k2, l]) => `<button data-f="${k2}" class="${S.ruleFilter === k2 ? "on" : ""}">${l}</button>`).join("")}</div>`);
    if (!rs.length) html.push(`<div class="hint">Keine aktiven Regeln für diese Zelle.</div>`);
    const intra = shown.filter((r) => r.tables.length <= 1), cross = shown.filter((r) => r.tables.length > 1);
    if (intra.length) html.push(`<div class="rgroup">Innerhalb von ${esc(tc(doc.code))} · ${intra.length}</div>${intra.map((r) => ruleRow(r, curKey, doc.module)).join("")}`);
    if (cross.length) html.push(`<div class="rgroup">Tabellenübergreifend · ${cross.length}</div>${cross.map((r) => ruleRow(r, curKey, doc.module)).join("")}`);
    if (rs.length && !shown.length) html.push(`<div class="hint">Kein Treffer für diesen Filter.</div>`);
  }

  if (S.dtab === "links") {
    const max = Math.max(1, ...linked.values());
    html.push(`<div class="sec"><h4>Verknüpfte Meldebögen <span class="n">${linked.size}</span></h4>
      ${linked.size ? [...linked].sort((a, b) => b[1] - a[1]).map(([t, n]) => `<div class="nb tag-row" data-t="${esc(t)}"><div><b>${esc(tc(t))}</b> <small>${esc(tableName(t))}</small><div class="bar"><i style="width:${(n / max) * 100}%"></i></div></div><span>${n} Regel${n > 1 ? "n" : ""}</span></div>`).join("")
        : `<div class="hint">Diese Zelle wird nur innerhalb des Bogens geprüft.</div>`}
      <button class="bigbtn" data-act="celllineage">⇄ Zell-Lineage als Graph<small>Zelle → Regeln → verknüpfte Zellen und Bögen</small></button></div>`);
    if (cell.same?.length) {
      html.push(`<div class="sec"><h4>Gleicher Datenpunkt auch in <span class="n">${cell.same.length}</span></h4><div>${cell.same.map((cc) => {
        const m = cc.match(/\{(.+?), r(\w+), c(\w+)(?:, s(\w+))?\}/);
        return m ? `<span class="tag" data-t="${m[1]}" data-r="${m[2]}" data-c="${m[3]}" data-s="${m[4] || ""}" data-tip="${esc((S.lab.get(`${m[1]}|r|${m[2]}`) || "") + "\n" + (S.lab.get(`${m[1]}|c|${m[3]}`) || ""))}\n\nDieselbe Variable – der Wert muss identisch sein.">${esc(tc(m[1]))} · r${m[2]} · c${m[3]}</span>` : esc(cc);
      }).join("")}</div></div>`);
    }
  }

  if (S.dtab === "chg") html.push(chg);
  if (S.dtab === "inst") {
    if (!inst.length) html.push(`<div class="sec">${instEmpty()}</div>`);
    const k2 = cellCodes(doc, cell);
    const grp = [["r", `Zur Zeile r${k2.r}`], ["c", `Zur Spalte c${k2.c}`], ["s", `Zum Blatt s${k2.s}`], [null, `Zum Bogen ${tc(doc.code)} allgemein`]];
    for (const [ax, title] of grp) {
      const list = inst.filter((x) => x[1].ax === ax);
      if (list.length) html.push(`<div class="sec"><h4>${esc(title)} <span class="n">${list.length}</span></h4>${instHtml(list)}</div>`);
    }
  }

  $("#dbody").innerHTML = html.join("");
  $("#dbody").scrollTop = 0;
  $$("#dbody .filt button").forEach((b) => b.onclick = () => { S.ruleFilter = b.dataset.f; renderDetails(cell); });
  $$("#dbody [data-tab]").forEach((b) => b.onclick = () => { S.dtab = b.dataset.tab; renderDetails(cell); });
  $$("#dbody .imore").forEach((b) => b.onclick = () => { b.previousElementSibling.classList.remove("clamp"); b.remove(); });
  bindRuleRows($("#dbody"), curKey, doc.module);
  bindChips($("#dbody"));
  $$("#dbody .tag-row").forEach((el) => el.onclick = () => { S.linMode = "focus"; S.linFocus = el.dataset.t; setView("lineage"); });
  $$("#dbody [data-act=celllineage]").forEach((b) => b.onclick = () => { S.linRule = null; S.linMode = "cell"; setView("lineage"); });
  $$("#dbody [data-hp]").forEach((b) => b.onclick = () => openHier(b.dataset.hp, b.dataset.hi));
  $$("#dbody [data-act=dpsim]").forEach((b) => b.onclick = () => dpFromCell(cell));
}

// ------------------------------------------------------------------ Instructions
function codeIn(codes, code) {
  return codes.some((c) => Array.isArray(c) ? code >= c[0] && code <= c[1] : c === code);
}
function cellInstructions(doc, cell) {
  if (!S.instBy?.size) return [];
  const k = cellCodes(doc, cell);
  const keys = [doc.code];
  for (let i = doc.code.lastIndexOf("."); i > 4; i = doc.code.lastIndexOf(".", i - 1)) keys.push(doc.code.slice(0, i));
  const out = [], seen = new Set();
  for (const key of keys) for (const [it, l] of S.instBy.get(key) || []) {
    const ok = !l.ax || (l.ax === "r" && codeIn(l.codes, k.r)) || (l.ax === "c" && codeIn(l.codes, k.c)) || (l.ax === "s" && k.s && codeIn(l.codes, k.s));
    const id = it.id + (l.ax || "");
    if (ok && !seen.has(id)) { seen.add(id); out.push([it, l]); }
  }
  const rank = { hoch: 0, mittel: 1, niedrig: 2 };
  return out.sort((a, b) => (a[1].ax ? 0 : 1) - (b[1].ax ? 0 : 1) || rank[a[1].conf] - rank[b[1].conf]);
}
function instHtml(list, short) {
  return list.map(([it, l]) => {
    const long = it.text.length > 600 && short !== false;
    const doc = S.inst.docs.find((d) => d.id === it.doc);
    return `<div class="inst">
      ${it.label ? `<div class="il">${esc(it.label)}</div>` : ""}
      <div class="it2 ${long ? "clamp" : ""}">${esc(it.text)}</div>${long ? `<button class="lnk imore">mehr</button>` : ""}
      ${it.legal?.length ? `<div class="ilegal">${it.legal.map((x) => `<span class="lg">§ ${esc(x)}</span>`).join("")}</div>` : ""}
      <div class="isrc"><span class="cf ${l.conf}" title="Zuordnung: ${esc(l.how)}">${esc(l.conf)}</span>
        ${esc(doc?.file || it.doc)}${it.sec ? " · " + esc(it.sec) : ""}${it.num ? ` · ${it.src === "tabelle" ? "Code" : "Abs."} ${esc(it.num)}` : ""}</div></div>`;
  }).join("");
}
function instEmpty() {
  return `<div class="note">Für diese Zelle sind noch keine Instructions verknüpft.${S.inst.items.length ? "" : `<br><br><b>So kommen sie hinein:</b> Word-Dateien der EBA (Annexe mit Instructions) nach <code class="c">data/instructions/${esc(S.meta.release.Code)}/</code> legen und <code class="c">start.bat</code> starten. Freitext (z. B. FINREP) und Tabellen (z. B. Asset Encumbrance) werden automatisch erkannt.`}</div>`;
}

function bindRuleRows(root, curKey, mod) {
  $$(".rrow", root).forEach((el) => {
    const id = +el.dataset.rule;
    el.onmouseenter = () => highlightRule(id, true);
    el.onmouseleave = () => highlightRule(id, false);
    $(".rs", el).onclick = () => {
      if (S.openRules.has(id)) S.openRules.delete(id); else S.openRules.add(id);
      el.classList.toggle("open");
      $(".full", el).innerHTML = S.openRules.has(id) ? ruleBody(S.rules[id], curKey) : "";
      bindChips(el); bindLineageBtns(el);
    };
  });
  bindLineageBtns(root);
}
function bindLineageBtns(root) {
  $$("[data-act=lineage]", root).forEach((b) => b.onclick = () => { S.linRule = +b.dataset.rule; S.linMode = "cell"; setView("lineage"); });
}

function highlightRule(id, on) {
  const r = S.rules[id];
  if (!r || S.view !== "sheet") return;
  for (const c of r.cells) $(`#gridwrap td.d[data-id="${c}"]`)?.classList.toggle("hl", on);
}

function bindChips(root) {
  $$(".ref, .tag", root).forEach((ch) => {
    ch.onmouseenter = (e) => {
      if (ch.dataset.tip) showTip(e, ch.dataset.tip);
      if (S.view === "sheet" && S.doc && ch.dataset.t === S.doc.code && ch.dataset.r && ch.dataset.c) {
        const c = findCell(S.doc, { r: ch.dataset.r, c: ch.dataset.c, s: ch.dataset.s });
        if (c) $(`#gridwrap td.d[data-id="${c.id}"]`)?.classList.add("hl2");
      }
    };
    ch.onmouseleave = () => { hideTip(); $$("#gridwrap td.hl2").forEach((x) => x.classList.remove("hl2")); };
    ch.onclick = (e) => {
      e.stopPropagation();
      const t = ch.dataset.t;
      if (!t || !moduleOf(t)) return;
      hideTip();
      openTable(t, { r: ch.dataset.r, c: ch.dataset.c, s: ch.dataset.s });
    };
  });
}

// ------------------------------------------------------------------ Tooltip
function initTooltips() { document.addEventListener("scroll", hideTip, true); }
function showTip(e, text) {
  const t = $("#tip");
  t.textContent = text; t.hidden = false;
  const x = Math.min(e.clientX + 14, innerWidth - t.offsetWidth - 10), y = e.clientY + 16;
  t.style.left = x + "px"; t.style.top = (y + t.offsetHeight > innerHeight ? e.clientY - t.offsetHeight - 10 : y) + "px";
}
function hideTip() { $("#tip").hidden = true; }

// ------------------------------------------------------------------ Globale Suche
function initSearch() {
  const q = $("#q"), res = $("#results");
  let items = [], act = -1;
  const run = () => {
    const s = q.value.trim().toLowerCase();
    if (s.length < 2) { res.hidden = true; return; }
    const groups = [];
    const tabs = S.meta.modules.flatMap((m) => m.tables.filter((t) => !t.abstract).map((t) => ({ ...t, mod: m.key })));
    const norm = s.replace(/_/g, " ");
    const cm = norm.match(/([a-z])\s?(\d{2}\.\d{2}(?:\.[\w.]+)?)\D+r?(\d{3,4})\D+c?(\d{3,4})/i);
    if (cm) {
      const code = tabs.find((t) => tc(t.code).toLowerCase() === `${cm[1]} ${cm[2]}`.toLowerCase());
      if (code) groups.push(["Zelle", [{ k: "c", t: code.code, r: cm[3].padStart(4, "0"), c: cm[4].padStart(4, "0"), title: `${tc(code.code)} · r${cm[3]} · c${cm[4]}`, sub: code.name }]]);
    }
    const T = tabs.filter((t) => (tc(t.code) + " " + t.code + " " + t.name).toLowerCase().includes(norm)).slice(0, 8)
      .map((t) => ({ k: "t", t: t.code, title: tc(t.code), sub: `${t.name} · ${MOD_LABEL[t.mod]}` }));
    if (T.length) groups.push(["Meldebögen", T]);
    const R = Object.values(S.rules).filter((r) => r.code.toLowerCase().includes(s)).slice(0, 6)
      .map((r) => ({ k: "r", id: r.id, title: r.code, sub: plain(r.verbal).slice(0, 160) }));
    if (R.length) groups.push(["Regeln", R]);
    // gleiche Bezeichnungen zusammenfassen: im aktuellen Bogen direkt springen, sonst Fundstellen zählen
    const hits = S.search.filter((h) => h[3].toLowerCase().includes(s));
    const byLabel = new Map();
    for (const h of hits) {
      const k = h[3].trim().toLowerCase();
      if (!byLabel.has(k)) byLabel.set(k, []);
      byLabel.get(k).push(h);
    }
    const ax = (a) => a === "r" ? "Zeile" : a === "c" ? "Spalte" : "Blatt";
    const H = [...byLabel.values()].sort((a, b) => b.length - a.length).slice(0, 10).map((list) => {
      const here = list.find((h) => h[0] === S.doc?.code) || list[0];
      const nt = new Set(list.map((h) => h[0])).size;
      return list.length === 1
        ? { k: "h", t: here[0], ax: here[1], code: here[2], title: here[3], sub: `${tc(here[0])} · ${ax(here[1])} ${here[2]}` }
        : { k: "hl", label: here[3], t: here[0], ax: here[1], code: here[2], title: here[3],
          sub: `${list.length} Fundstellen in ${nt} Bögen – Enter: ${tc(here[0])} ${ax(here[1])} ${here[2]} · Alt+Enter: als Datenpunkt-Suche` };
    });
    if (H.length) groups.push(["Zeilen & Spalten", H]);
    items = groups.flatMap((g) => g[1]); act = -1;
    res.innerHTML = groups.length ? groups.map(([g, list]) => `<div class="grp">${g}</div>` + list.map((it) =>
      `<div class="r" data-i="${items.indexOf(it)}"><b>${esc(it.title)}</b><small>${esc(it.sub)}</small></div>`).join("")).join("")
      : `<div class="r"><small>Keine Treffer</small></div>`;
    res.hidden = false;
    $$(".r[data-i]", res).forEach((el) => el.onmousedown = (e) => { e.preventDefault(); go(items[+el.dataset.i], e.altKey); });
  };
  const go = async (it, alt) => {
    if (!it) return;
    res.hidden = true; q.blur();
    if (it.k === "hl" && alt) {
      S.dpf.metric = null; S.dpf.dims = new Map(); S.dpf.text = it.label;
      setView("dp");
      return;
    }
    if (it.k === "t") await openTable(it.t);
    if (it.k === "c") await openTable(it.t, { r: it.r, c: it.c });
    if (it.k === "h" || it.k === "hl") {
      const doc = await loadDoc(it.t);
      const c = doc.cells.find((x) => cellCodes(doc, x)[it.ax] === it.code && !x.excl);
      await openTable(it.t, c ? cellCodes(doc, c) : {});
    }
    if (it.k === "r") {
      const r = S.rules[it.id];
      const cid = r.cells.find((c) => { const ci = S.ruleCells[c]; return ci && moduleOf(ci[0]); });
      const ci = S.ruleCells[cid];
      if (ci) { await openTable(ci[0], { r: ci[1], c: ci[2], s: ci[3] }); S.dtab = "rules"; S.openRules.add(r.id); renderDetails(S.sel); }
    }
    setView("sheet");
  };
  q.oninput = run;
  q.onfocus = run;
  q.onblur = () => setTimeout(() => res.hidden = true, 150);
  q.onkeydown = (e) => {
    const els = $$(".r[data-i]", res);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      act = Math.max(0, Math.min(els.length - 1, act + (e.key === "ArrowDown" ? 1 : -1)));
      els.forEach((x, i) => x.classList.toggle("act", i === act));
      els[act]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") go(items[act >= 0 ? act : 0], e.altKey);
    else if (e.key === "Escape") { res.hidden = true; q.blur(); }
  };
}

// ------------------------------------------------------------------ Release-Vergleich
// Änderungsarten: inhaltlich (standardmäßig sichtbar) und technisch (standardmäßig ausgeblendet)
const CH_TYPES = [
  ["new", "Neue Zelle", "#bfe6c9", true], ["opened", "Nicht mehr grau", "#bfe6c9", true], ["greyed", "Neu grau", "#e7b3ad", true],
  ["dp", "Datenpunkt inhaltlich", "#c9dbf7", true], ["sign", "Vorzeichen", "#e2cdef", true], ["lab", "Bezeichnung", "#fff1a8", true],
  ["rule", "Regel neu/geändert", "#8e44ad", true], ["sev", "Schweregrad", "#c0392b", true],
  ["dpmod", "Modellierung", "#efe6d2", false], ["dptech", "Nur umbenannt", "#ececec", false],
  ["labtech", "Schreibweise", "#f3f0dc", false], ["ruletech", "Regel umcodiert", "#d9cfe3", false],
];
const CH = Object.fromEntries(CH_TYPES.map(([k, l, c, content]) => [k, { l, c, content }]));
S.cmpTypes = new Set(CH_TYPES.filter((t) => t[3]).map((t) => t[0]));

// Änderungen eines Bogens je Zelle (inkl. Regeln und Bezeichnungen) – Grundlage für Raster, Zähler und Listen
function diffInfo(code) {
  const e = S.diff?.tables[code];
  if (!e) return null;
  if (e._info) return e._info;
  const R = e.rules, cellTypes = new Map();
  const add = (id, t) => { if (!cellTypes.has(id)) cellTypes.set(id, new Set()); cellTypes.get(id).add(t); };
  for (const [id, ts] of Object.entries(e.cells)) ts.forEach((t) => add(+id, t));
  for (const id of [...R.add, ...R.chg.map((x) => x.id)]) (S.rules[id]?.cells || []).forEach((c) => add(c, "rule"));
  for (const x of R.sev || []) (S.rules[x.id]?.cells || []).forEach((c) => add(c, "sev"));
  for (const x of [...(R.ren || []), ...(R.fmt || [])]) (S.rules[x.id]?.cells || []).forEach((c) => add(c, "ruletech"));
  const labs = new Map(e.labels.map((l) => [`${l[0]}|${l[1]}`, { old: l[2], type: l[4] ? "labtech" : "lab" }]));
  const counts = {};
  for (const ts of cellTypes.values()) for (const t of ts) counts[t] = (counts[t] || 0) + 1;
  for (const l of labs.values()) counts[l.type] = (counts[l.type] || 0) + 1;
  counts.rule = R.add.length + R.chg.length; counts.sev = (R.sev || []).length; counts.ruletech = (R.ren || []).length + (R.fmt || []).length;
  const content = Object.entries(counts).filter(([k, n]) => n && CH[k]?.content).reduce((a, [, n]) => a + n, 0) + e.removed.length + R.del.length;
  return (e._info = { e, cellTypes, labs, counts, content });
}

function changeCount(e) { return diffInfo(Object.keys(S.diff.tables).find((k) => S.diff.tables[k] === e))?.content || 0; }
function changeBadge(code) {
  const d = diffInfo(code);
  if (!d) return "";
  if (d.e.st === "new") return `<span class="cb nw">neu</span>`;
  return d.content ? `<span class="cb" title="inhaltliche Änderungen">${d.content}</span>` : `<span class="cb tech" title="nur technische Änderungen">tech</span>`;
}

function initCompare() {
  const sel = $("#cmpsel");
  sel.innerHTML = `<option value="">Release-Vergleich: aus</option>` + S.diffIdx.map((d) => {
    const n = (d.summary.tables_changed || 0) + (d.summary.tables_new || 0);
    return `<option value="${esc(d.code)}">Änderungen seit ${esc(d.code)}${n ? "" : " (keine)"}</option>`;
  }).join("");
  sel.onchange = () => setCompare(sel.value);
  $("#cmponly").onchange = renderToc;
}
async function setCompare(code) {
  const entry = S.diffIdx.find((d) => d.code === code);
  S.diff = code ? await fetchJSON(`data/diff/${encodeURIComponent(entry?.file || code)}.json`) : null;
  if (S.diff && entry) S.diff.base = { code: entry.code, date: entry.date };
  $("#cmponlywrap").hidden = !S.diff;
  if (!S.diff) $("#cmponly").checked = false;
  renderToc();
  if (S.doc) {
    const sel = S.sel;
    renderGrid();
    if (sel) { S.dtab = S.diff ? "chg" : "ov"; selectCell(sel, false, true); }
  }
}

function renderCmpbar() {
  const bar = $("#cmpbar");
  if (!S.diff || !S.doc) { bar.hidden = true; return; }
  bar.hidden = false;
  const d = diffInfo(S.doc.code);
  const head = `<b>Δ seit ${esc(S.diff.base.code)}</b>`;
  const off = `<button class="lnk" id="cmpoff">beenden</button>`;
  const done = () => $("#cmpoff").onclick = () => { $("#cmpsel").value = ""; setCompare(""); };
  if (!d) { bar.innerHTML = `${head} <span class="muted">In diesem Bogen keine Änderungen.</span> ${off}`; done(); return; }
  if (d.e.st === "new") { bar.innerHTML = `${head} <b>Bogen ist neu</b> <span class="muted">(gab es in ${esc(S.diff.base.code)} noch nicht)</span> ${off}`; done(); return; }
  const chip = ([k]) => d.counts[k] ? `<span class="t ${S.cmpTypes.has(k) ? "" : "off"}" data-k="${k}"><i style="background:${CH[k].c}"></i>${CH[k].l} <b>${d.counts[k]}</b></span>` : "";
  const content = CH_TYPES.filter((t) => t[3]).map(chip).join(""), tech = CH_TYPES.filter((t) => !t[3]).map(chip).join("");
  const extra = [d.e.removed.length && `${d.e.removed.length} Zellen entfallen`, d.e.rules.del.length && `${d.e.rules.del.length} Regeln entfallen`].filter(Boolean);
  bar.innerHTML = `${head}
    <span class="grp">${content || '<span class="muted">keine inhaltlichen Änderungen</span>'}${extra.length ? `<span class="muted">· ${extra.join(" · ")}</span>` : ""}</span>
    ${tech ? `<span class="grp tech"><span class="muted">technisch:</span>${tech}</span>` : ""}
    <button class="lnk" id="chlist">Änderungsliste</button> ${off}`;
  $$(".t", bar).forEach((t) => t.onclick = () => {
    S.cmpTypes.has(t.dataset.k) ? S.cmpTypes.delete(t.dataset.k) : S.cmpTypes.add(t.dataset.k);
    const sel = S.sel; renderGrid(); renderToc(); if (sel) selectCell(sel, false, true);
  });
  $("#chlist").onclick = showChangeList;
  done();
}

// Vorher/Nachher eines Datenpunkts – Umbenennungen werden zugeordnet, nur echte Unterschiede hervorgehoben
function dpCompare(old, v) {
  const [om, od, ren = []] = old;
  const renMap = new Map(ren.map(([a, b]) => [a, b]));
  const rows = [], usedOld = new Set();
  const norm = (s) => (s || "").toLowerCase();
  for (const d of v.dims) {
    let o = od.find((x, i) => !usedOld.has(i) && (x[0] === d[0] || renMap.get(x[0]) === d[0]) && (norm(x[1]) === norm(d[2]) || renMap.get(x[1]) === d[2]));
    if (!o) o = od.find((x, i) => !usedOld.has(i) && (x[0] === d[0] || renMap.get(x[0]) === d[0]));
    if (!o) o = od.find((x, i) => !usedOld.has(i) && (norm(x[1]) === norm(d[2]) || renMap.get(x[1]) === d[2]));
    if (o) usedOld.add(od.indexOf(o));
    rows.push({ dim: d[0], oldDim: o?.[0], before: o?.[1], after: d[2] });
  }
  od.forEach((o, i) => { if (!usedOld.has(i)) rows.push({ dim: o[0], before: o[1], after: null }); });
  const cls = (r) => r.before == null ? "add" : r.after == null ? "del" : norm(r.before) === norm(r.after) || renMap.get(r.before) === r.after ? (r.before === r.after ? "" : "ren") : "chg";
  const lab = { add: "neu", del: "entfallen", chg: "geändert", ren: "umbenannt" };
  return `<table class="cmpt"><thead><tr><th>Merkmal</th><th>vorher</th><th>jetzt</th></tr></thead><tbody>
    <tr class="${om === v.metric[0] ? "" : "chg"}"><td>Kennzahl</td><td>${esc(om)}</td><td>${esc(v.metric[0])}</td></tr>
    ${rows.map((r) => { const c = cls(r); return `<tr class="${c}"><td>${esc(r.dim)}${r.oldDim && r.oldDim !== r.dim ? `<small>vorher: ${esc(r.oldDim)}</small>` : ""}</td>
      <td>${r.before == null ? "–" : esc(r.before)}</td><td>${r.after == null ? "–" : esc(r.after)}${c ? ` <span class="tagc ${c}">${lab[c]}</span>` : ""}</td></tr>`; }).join("")}
  </tbody></table>`;
}

function cellChangeHtml(cell) {
  if (!S.diff) return "";
  const d = diffInfo(S.doc.code);
  if (!d) return "";
  const e = d.e, types = e.cells[cell.id] || [];
  const R = e.rules, has = (id) => cell.rules.includes(id);
  const ruleNew = R.add.filter(has), ruleChg = R.chg.filter((x) => has(x.id)), ruleSev = (R.sev || []).filter((x) => has(x.id));
  const ruleTech = [...(R.ren || []), ...(R.fmt || [])].filter((x) => has(x.id));
  if (!types.length && !ruleNew.length && !ruleChg.length && !ruleSev.length && !ruleTech.length && e.st !== "new") return "";
  const out = [];
  const kind = types.find((t) => t.startsWith("dp"));
  const base = esc(S.diff.base.code);
  const dpState = e.st === "new" ? ["c", "neu (Bogen gab es noch nicht)"]
    : types.includes("new") ? ["c", "neue Zelle"]
    : types.includes("dp") ? ["c", "inhaltlich geändert"]
    : types.includes("dpmod") ? ["m", "Modellierung angepasst – Bedeutung im Kern gleich"]
    : types.includes("dptech") ? ["t", "unverändert – nur Bezeichnungen umbenannt"]
    : ["t", "unverändert"];
  const rparts = [ruleNew.length && `${ruleNew.length} neu`, ruleChg.length && `${ruleChg.length} geändert`, ruleSev.length && `${ruleSev.length} Schweregrad geändert`].filter(Boolean);
  out.push(`<div class="verdicts"><div class="vd ${dpState[0]}"><span>Datenpunkt</span><b>${dpState[1]}</b></div>
    <div class="vd ${rparts.length ? "c" : "t"}"><span>Regeln</span><b>${rparts.length ? rparts.join(" · ") : "unverändert"}</b></div>
    <div class="vbase">Vergleich mit Release ${base}</div></div>`);
  const simple = types.filter((t) => !t.startsWith("dp")).map((t) => CH[t]?.l).filter(Boolean);
  if (simple.length) out.push(`<div class="chline">${simple.map((l) => `<span class="tagc chg">${esc(l)}</span>`).join(" ")}</div>`);
  if (kind && e.dp[cell.id]) {
    const v = S.doc.vars[cell.var], ren = e.dp[cell.id][2] || [];
    if (kind === "dptech") {
      const od = e.dp[cell.id][1], renMap = new Map(ren);
      const used = new Set();
      const rows = v.dims.map((dd) => {
        let i = od.findIndex((x, j) => !used.has(j) && (x[0] === dd[0] || renMap.get(x[0]) === dd[0]));
        if (i < 0) i = od.findIndex((x, j) => !used.has(j) && (nrm(x[1]) === nrm(dd[2]) || renMap.get(x[1]) === dd[2]));
        if (i >= 0) used.add(i);
        const o = od[i] || [];
        return { dimOld: o[0], dim: dd[0], valOld: o[1], val: dd[2] };
      });
      const cellTxt = (a_, b_) => a_ && a_ !== b_ ? `<s>${esc(a_)}</s> → <b>${esc(b_)}</b>` : esc(b_);
      out.push(`<div class="sec"><h4>Datenpunkt</h4>
        <div class="muted" style="margin-bottom:8px">Die Zelle meldet dasselbe wie in ${base}. Geändert haben sich nur die Namen, mit denen die EBA den Datenpunkt beschreibt (Merkmale bzw. Werte):</div>
        <table class="cmpt"><thead><tr><th>Merkmal</th><th>Wert</th></tr></thead><tbody>
        <tr><td>Kennzahl</td><td>${cellTxt(e.dp[cell.id][0], v.metric[0])}</td></tr>
        ${rows.map((r) => `<tr class="${r.dimOld !== r.dim || r.valOld !== r.val ? "ren" : ""}"><td>${cellTxt(r.dimOld, r.dim)}</td><td>${cellTxt(r.valOld, r.val)}</td></tr>`).join("")}
        </tbody></table></div>`);
    } else {
      out.push(`<div class="sec"><h4>Datenpunkt · ${kind === "dpmod" ? "Modellierung angepasst" : "inhaltlich geändert"}</h4>
        ${kind === "dpmod" ? `<div class="muted" style="margin-bottom:6px">Dimension ergänzt oder entfallen, Werte sonst gleich – meist eine Präzisierung im DPM.</div>` : ""}
        ${dpCompare(e.dp[cell.id], v)}</div>`);
    }
  }
  const rl = (ids) => ids.map((id) => ruleRow(S.rules[id], null, S.doc.module)).join("");
  if (ruleNew.length) out.push(`<div class="sec"><h4>Neue Regeln <span class="n">${ruleNew.length}</span></h4>${rl(ruleNew)}</div>`);
  if (ruleChg.length) out.push(`<div class="sec"><h4>Geänderte Regeln <span class="n">${ruleChg.length}</span></h4>${ruleChg.map((x) => `${ruleRow(S.rules[x.id], null, S.doc.module)}<details class="pre"><summary>bisheriger Ausdruck</summary><pre class="x">${esc(x.old)}</pre></details>`).join("")}</div>`);
  if (ruleSev.length) out.push(`<div class="sec"><h4>Schweregrad geändert <span class="n">${ruleSev.length}</span></h4>${ruleSev.map((x) => `<div class="sevch"><b>${esc(S.rules[x.id].code)}</b> ${Object.entries(x.ch).map(([m, [a, b]]) => `${esc(MOD_LABEL[m] || m)}: ${sevLabel(a)} → <b>${sevLabel(b)}</b>`).join(" · ")}</div>`).join("")}</div>`);
  if (ruleTech.length) out.push(`<details class="sec techd"><summary>${ruleTech.length} Regel(n) nur technisch geändert (umcodiert oder andere Schreibweise)</summary>
    ${ruleTech.map((x) => `<div class="sevch"><b>${esc(S.rules[x.id].code)}</b> ${x.old && !x.old.includes("{") ? `ersetzt ${esc(x.old)} – gleiche Logik` : "gleiche Logik, andere Schreibweise"}</div>`).join("")}</details>`);
  return out.join("");
}
const sevLabel = (s) => s === "error" ? "Fehler" : "Warnung";

function showChangeList() {
  const doc = S.doc, d = diffInfo(doc.code);
  if (!d) return;
  const e = d.e;
  $("#details").hidden = false;
  $("#dtabs").hidden = true;
  $("#dtitle").innerHTML = `<div class="ttl"><b>Änderungen in ${esc(tc(doc.code))}</b></div><div class="tn">Release ${esc(S.diff.base.code)} → ${esc(S.diff.cur.code)}</div>`;
  const byType = {};
  for (const [id, ts] of d.cellTypes) for (const t of ts) (byType[t] = byType[t] || []).push(id);
  const cellTag = (id) => {
    const c = doc.cById.get(id); if (!c) return "";
    const k = cellCodes(doc, c);
    return `<span class="tag" data-t="${doc.code}" data-r="${k.r}" data-c="${k.c}" data-s="${k.s}" data-tip="${esc((S.lab.get(`${doc.code}|r|${k.r}`) || "") + "\n" + (S.lab.get(`${doc.code}|c|${k.c}`) || ""))}">r${k.r} · c${k.c}${k.s ? " · s" + k.s : ""}</span>`;
  };
  const cellsSec = (k) => byType[k] ? `<div class="sec"><h4>${esc(CH[k].l)} <span class="n">${byType[k].length}</span></h4><div>${byType[k].slice(0, 120).map(cellTag).join("")}${byType[k].length > 120 ? " …" : ""}</div></div>` : "";
  const mod = doc.module, R = e.rules;
  S.openRules = new Set();
  const h = [];
  h.push(`<div class="verdict ${d.content ? "c" : "t"}">${d.content ? `${d.content} inhaltliche Änderungen` : "Nur technische Änderungen"}</div>`);
  for (const k of ["new", "opened", "greyed", "dp", "sign"]) h.push(cellsSec(k));
  if (e.removed.length) h.push(`<div class="sec"><h4>Entfallene Zellen <span class="n">${e.removed.length}</span></h4><div class="chg"><ul>${e.removed.map((x) => `<li><span class="minus">r${esc(x[0])} · c${esc(x[1])}${x[2] ? " · s" + esc(x[2]) : ""}</span><br><small>${esc(x[3])} / ${esc(x[4])}</small></li>`).join("")}</ul></div></div>`);
  const labs = e.labels.filter((l) => !l[4]);
  if (labs.length) h.push(`<div class="sec"><h4>Geänderte Bezeichnungen <span class="n">${labs.length}</span></h4><div class="chg"><ul>${labs.map((l) => `<li><code class="c">${l[0]}${esc(l[1])}</code> <span class="minus">${esc(l[2])}</span> → <span class="plus">${esc(l[3])}</span></li>`).join("")}</ul></div></div>`);
  if (R.add.length) h.push(`<div class="sec"><h4>Neue Regeln <span class="n">${R.add.length}</span></h4>${R.add.map((id) => ruleRow(S.rules[id], null, mod)).join("")}</div>`);
  if (R.chg.length) h.push(`<div class="sec"><h4>Geänderte Regeln <span class="n">${R.chg.length}</span></h4>${R.chg.map((x) => `${ruleRow(S.rules[x.id], null, mod)}<details class="pre" style="margin:-2px 0 8px 10px"><summary>bisheriger Ausdruck</summary><pre class="x">${esc(x.old)}</pre></details>`).join("")}</div>`);
  if ((R.sev || []).length) h.push(`<div class="sec"><h4>Schweregrad geändert <span class="n">${R.sev.length}</span></h4>${R.sev.map((x) => `<div class="sevch"><b>${esc(S.rules[x.id].code)}</b> ${Object.entries(x.ch).map(([m, [a, b]]) => `${esc(MOD_LABEL[m] || m)}: ${sevLabel(a)} → <b>${sevLabel(b)}</b>`).join(" · ")}</div>`).join("")}</div>`);
  if (R.del.length) h.push(`<div class="sec"><h4>Entfallene Regeln <span class="n">${R.del.length}</span></h4>${R.del.map((r) =>
    `<div class="rule"><div class="rh"><b>${esc(r.code)}</b><span class="badge grey">entfallen</span></div><div class="rv">${r.verbal ? verbal(r.verbal) : ""}</div><details><summary>DPM-XL</summary><pre class="x">${esc(r.expr)}</pre></details></div>`).join("")}</div>`);
  const tech = ["dpmod", "dptech", "ruletech", "labtech"].map((k) => [k, d.counts[k] || 0]).filter(([, n]) => n);
  if (tech.length) h.push(`<details class="sec techd"><summary>Technische Änderungen: ${tech.map(([k, n]) => `${CH[k].l} ${n}`).join(" · ")}</summary>
    ${cellsSec("dpmod")}${cellsSec("dptech")}
    ${(R.ren || []).length ? `<div class="sec"><h4>Regeln umcodiert <span class="n">${R.ren.length}</span></h4>${R.ren.map((x) => `<div class="sevch"><b>${esc(S.rules[x.id].code)}</b> ersetzt ${esc(x.old)} – gleiche Logik</div>`).join("")}</div>` : ""}
    ${(R.fmt || []).length ? `<div class="sec"><h4>Nur Schreibweise <span class="n">${R.fmt.length}</span></h4>${R.fmt.map((x) => `<div class="sevch"><b>${esc(S.rules[x.id].code)}</b> gleiche Logik, anders formuliert</div>`).join("")}</div>` : ""}
    ${e.labels.filter((l) => l[4]).map((l) => `<div class="sevch"><code class="c">${l[0]}${esc(l[1])}</code> ${esc(l[2])} → ${esc(l[3])}</div>`).join("")}</details>`);
  $("#dbody").innerHTML = h.join("") || '<div class="hint">Keine Änderungen.</div>';
  $("#dbody").scrollTop = 0;
  bindChips($("#dbody"));
  bindRuleRows($("#dbody"), null, mod);
}

// ------------------------------------------------------------------ Lineage
const COL = { FINREP9: "#2f6db5", AE: "#217346", ext: "#9a9a9a", err: "#c0392b", warn: "#c27c0e" };
let cy = null;

function cyStyle() {
  return [
    { selector: "node", style: { label: "data(label)", "font-size": 11, "text-valign": "center", "text-halign": "center", color: "#fff", "background-color": "data(color)", "text-wrap": "wrap", "text-max-width": 120, "font-family": "Segoe UI, Arial" } },
    { selector: "node.tbl", style: { shape: "round-rectangle", width: "label", height: 24, padding: 7, "font-weight": 600 } },
    { selector: "node.center", style: { "font-size": 14, height: 34, padding: 10, "border-width": 3, "border-color": "#ffcc00" } },
    { selector: "node.cmp", style: { "background-color": "#f4f6f9", "border-color": "#9fb3cc", "border-width": 1, shape: "round-rectangle", label: "data(label)", "text-valign": "top", "text-halign": "center", color: "#223", "font-weight": 600, "font-size": 11, padding: 8 } },
    { selector: "node.cell", style: { shape: "round-rectangle", "background-color": "#fff", "border-color": "#8a96a3", "border-width": 1, color: "#222", width: 108, height: 20, "font-size": 10 } },
    { selector: "node.cell.cur", style: { "background-color": "#fff3c4", "border-color": "#c79d00", "border-width": 2, "font-weight": 700, width: 120, height: 26, "font-size": 11 } },
    { selector: "node.rule", style: { shape: "round-rectangle", width: 120, height: 22, "background-color": "data(color)", label: "data(label)", color: "#fff", "font-size": 10, "font-weight": 600 } },
    { selector: "node.agg", style: { shape: "round-rectangle", "background-color": "#eef1f5", "border-color": "#8a8a8a", "border-width": 1, "border-style": "dashed", color: "#333", width: 108, height: 20, "font-size": 10 } },
    { selector: "edge", style: { width: "data(w)", "line-color": "#b9c6d6", "curve-style": "bezier", opacity: 0.8 } },
    { selector: "edge.lbl", style: { label: "data(n)", "font-size": 10, color: "#456", "text-background-color": "#fff", "text-background-opacity": 1, "text-background-padding": 2 } },
    { selector: "edge.cr", style: { width: 1.3, "line-color": "#b3bfcc", "curve-style": "bezier", "target-arrow-shape": "triangle", "target-arrow-color": "#b3bfcc", "arrow-scale": 0.7 } },
    { selector: "node.cell.hotc", style: { "border-color": "#e39a00", "border-width": 2.5, "background-color": "#fff6dc" } },
    { selector: ".faded", style: { opacity: 0.12 } },
    { selector: ".hot", style: { "line-color": "#e39a00", opacity: 1, width: 2.5 } },
    { selector: "node:selected", style: { "border-width": 3, "border-color": "#ffcc00" } },
    { selector: "edge:selected", style: { "line-color": "#ffb000", width: 4, opacity: 1 } },
  ];
}

function renderLineage() {
  $$("#linmode button").forEach((b) => {
    b.classList.toggle("on", b.dataset.m === S.linMode);
    b.onclick = () => { S.linMode = b.dataset.m; S.linRule = null; renderLineage(); };
  });
  $("#linmod").innerHTML = S.meta.modules.map((m) => `<button data-m="${m.key}" class="${S.linMods.has(m.key) ? "on" : ""}">${MOD_LABEL[m.key]}</button>`).join("");
  $$("#linmod button").forEach((b) => b.onclick = () => {
    if (S.linMods.has(b.dataset.m) && S.linMods.size > 1) S.linMods.delete(b.dataset.m); else S.linMods.add(b.dataset.m);
    renderLineage();
  });
  const fsel = $("#linfocus");
  const opts = S.lineage.nodes.filter((n) => n.inModule);
  S.linFocus = S.linFocus || S.doc?.code || opts[0].code;
  fsel.innerHTML = opts.map((n) => `<option value="${n.code}" ${n.code === S.linFocus ? "selected" : ""}>${esc(tc(n.code))} – ${esc((n.name || "").slice(0, 60))}</option>`).join("");
  fsel.onchange = () => { S.linFocus = fsel.value; renderLineage(); };
  const m = S.linMode;
  fsel.hidden = m !== "focus";
  $("#linmod").hidden = m !== "tables"; $("#linextwrap").hidden = m === "cell"; $("#lindepthwrap").hidden = m !== "cell";
  $("#linext").onchange = renderLineage; $("#lindepth").onchange = renderLineage;
  $("#linfit").onclick = () => cy?.fit(undefined, 30);
  if (cy) { cy.destroy(); cy = null; }
  if (m === "tables") lineageTables(); else if (m === "focus") lineageFocus(); else lineageCell();
}

function edgesOf(code) { return S.lineage.edges.filter((e) => e.a === code || e.b === code); }

function lineageFocus() {
  const ext = $("#linext").checked, code = S.linFocus;
  const info = S.lineage.nodes.find((x) => x.code === code);
  const es = edgesOf(code).map((e) => ({ other: e.a === code ? e.b : e.a, n: e.rules.length, rules: e.rules }))
    .filter((x) => ext || S.lineage.nodes.find((n) => n.code === x.other)?.inModule).sort((a, b) => b.n - a.n);
  const nodeOf = (c, center) => {
    const n = S.lineage.nodes.find((x) => x.code === c) || {};
    return { data: { id: c, label: tc(c), color: n.inModule ? COL[n.module] : COL.ext }, classes: "tbl" + (center ? " center" : "") + (n.inModule ? "" : " ext") };
  };
  const max = Math.max(1, ...es.map((x) => x.n));
  cy = cytoscape({
    container: $("#cy"), style: cyStyle(), wheelSensitivity: 0.25,
    elements: [nodeOf(code, true), ...es.map((x) => nodeOf(x.other)),
      ...es.map((x, i) => ({ data: { id: "e" + i, source: code, target: x.other, w: 1 + 7 * (x.n / max), n: x.n, rules: x.rules }, classes: "lbl" }))],
    layout: { name: "concentric", concentric: (n) => n.id() === code ? 10 : 1, levelWidth: () => 1, minNodeSpacing: 26, animate: false, padding: 40 },
  });
  $("#linhint").textContent = `${es.length} verknüpfte Bögen`;
  $("#linside").innerHTML = `<h3>${esc(tc(code))}</h3><div class="sub">${esc(info?.name || "")}</div>
    <div class="acts" style="margin:0 0 10px"><button class="btn" id="opentab">Meldebogen öffnen</button></div>
    <div class="hint" style="margin-bottom:8px">Verbunden über gemeinsame Validierungsregeln. Bogen anklicken: Regeln dazwischen · Doppelklick: in den Fokus nehmen.</div>
    ${es.map((x) => `<div class="nb" data-o="${x.other}"><div><b>${esc(tc(x.other))}</b> <small>${esc(tableName(x.other))}</small><div class="bar"><i style="width:${(x.n / max) * 100}%"></i></div></div><span>${x.n} Regel${x.n > 1 ? "n" : ""}</span></div>`).join("") || '<div class="hint">Keine tabellenübergreifenden Regeln.</div>'}`;
  $("#opentab").onclick = () => openTable(code);
  $$("#linside .nb").forEach((el) => el.onclick = () => showEdge(cy.edges().filter((e) => e.target().id() === el.dataset.o)[0]));
  cy.on("tap", "node", (e) => { if (e.target.id() !== code) showEdge(cy.edges().filter((x) => x.target().id() === e.target.id())[0]); });
  cy.on("dbltap", "node", (e) => { S.linFocus = e.target.id(); renderLineage(); });
  cy.on("tap", "edge", (e) => showEdge(e.target));
  cy.on("mouseover", "node", (e) => showTip(e.originalEvent, `${tc(e.target.id())}\n${tableName(e.target.id())}`));
  cy.on("mouseout", "node", hideTip);
}

function lineageTables() {
  const ext = $("#linext").checked;
  const nodes = S.lineage.nodes.filter((n) => (n.inModule && S.linMods.has(n.module)) || (ext && !n.inModule));
  const ids = new Set(nodes.map((n) => n.code));
  const edges = S.lineage.edges.filter((e) => ids.has(e.a) && ids.has(e.b));
  const deg = new Map();
  for (const e of edges) { deg.set(e.a, (deg.get(e.a) || 0) + e.rules.length); deg.set(e.b, (deg.get(e.b) || 0) + e.rules.length); }
  const used = nodes.filter((n) => deg.get(n.code));
  cy = cytoscape({
    container: $("#cy"), style: cyStyle(), wheelSensitivity: 0.25,
    elements: [
      ...used.map((n) => ({ data: { id: n.code, label: tc(n.code), color: n.inModule ? COL[n.module] : COL.ext }, classes: "tbl" + (n.inModule ? "" : " ext") })),
      ...edges.map((e, i) => ({ data: { id: "e" + i, source: e.a, target: e.b, w: Math.min(9, 1 + Math.log2(e.rules.length)), rules: e.rules } })),
    ],
    layout: { name: "cose", animate: false, nodeRepulsion: 14000, idealEdgeLength: 110, edgeElasticity: 80, gravity: 0.5, numIter: 1500, randomize: true, padding: 30 },
  });
  const isolated = nodes.length - used.length;
  $("#linhint").textContent = `${used.length} vernetzte Bögen · ${edges.length} Verbindungen${isolated ? ` · ${isolated} ohne tabellenübergreifende Regeln ausgeblendet` : ""}`;
  $("#linside").innerHTML = `<h3>Gesamtnetz</h3><div class="sub">Zwei Bögen sind verbunden, wenn mindestens eine Regel Zellen aus beiden prüft. Linienstärke = Anzahl Regeln.</div>
    <div class="legend"><span><i style="background:${COL.FINREP9}"></i>FINREP</span><span><i style="background:${COL.AE}"></i>Asset Encumbrance</span><span><i style="background:${COL.ext}"></i>andere Module</span></div>
    <h4 style="margin:14px 0 6px">Am stärksten vernetzt</h4>
    ${[...deg].filter(([c]) => ids.has(c)).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([c, n]) => `<div class="nb" data-n="${c}"><div><b>${esc(tc(c))}</b> <small>${esc(tableName(c).slice(0, 50))}</small></div><span>${n}</span></div>`).join("")}`;
  $$("#linside .nb").forEach((el) => el.onclick = () => { S.linFocus = el.dataset.n; S.linMode = "focus"; renderLineage(); });
  cy.on("tap", "node", (e) => {
    const n = e.target;
    cy.elements().addClass("faded"); n.closedNeighborhood().removeClass("faded");
  });
  cy.on("dbltap", "node", (e) => { S.linFocus = e.target.id(); S.linMode = "focus"; renderLineage(); });
  cy.on("tap", "edge", (e) => showEdge(e.target));
  cy.on("tap", (e) => { if (e.target === cy) cy.elements().removeClass("faded"); });
  cy.on("mouseover", "node", (e) => showTip(e.originalEvent, `${tc(e.target.id())}\n${tableName(e.target.id())}\nDoppelklick: in den Fokus nehmen`));
  cy.on("mouseout", "node", hideTip);
}

function showEdge(edge) {
  if (!edge) return;
  const a = edge.source().id(), b = edge.target().id();
  cy.elements().addClass("faded");
  edge.removeClass("faded"); edge.connectedNodes().removeClass("faded");
  cy.elements().unselect(); edge.select();
  const rs = edge.data("rules").map((id) => S.rules[id]).filter(Boolean);
  S.openRules = new Set();
  $("#linside").innerHTML = `<button class="lnk" id="linback">‹ zurück</button><h3 style="margin-top:6px">${esc(tc(a))} ↔ ${esc(tc(b))}</h3><div class="sub">${rs.length} gemeinsame Regel(n)</div>
    ${rs.slice(0, 100).map((r) => ruleRow(r, null, Object.keys(r.sev)[0])).join("")}`;
  $("#linback").onclick = renderLineage;
  bindRuleRows($("#linside"), null, null);
  bindChips($("#linside"));
}

function cellLabel(cid) {
  const ci = S.ruleCells[cid];
  return ci ? `r${ci[1] || "–"} · c${ci[2] || "–"}${ci[3] ? " · s" + ci[3] : ""}` : String(cid);
}
function cellTip(cid) {
  const ci = S.ruleCells[cid];
  if (!ci) return "";
  return `${tc(ci[0])} · ${cellLabel(cid)}\n${S.lab.get(`${ci[0]}|r|${ci[1]}`) || ""}\n${S.lab.get(`${ci[0]}|c|${ci[2]}`) || ""}`;
}

// Zell-Lineage in Spalten: Zelle → Regeln → Zellen (gruppiert nach Bogen) [→ Regeln → Zellen]
function lineageCell() {
  const side = $("#linside");
  const center = S.sel && S.doc ? S.sel.id : null;
  const ruleIds = S.linRule ? [S.linRule] : center ? (S.cellRules.get(center) || []) : [];
  if (!ruleIds.length) {
    $("#cy").innerHTML = ""; $("#linhint").textContent = "";
    side.innerHTML = `<h3>Zell-Lineage</h3><div class="sub">${center ? "An dieser Zelle hängen keine Regeln." : "Bitte zuerst im Meldebogen eine Zelle auswählen."} Hier siehst du dann, über welche Regeln sie mit anderen Zellen und Bögen zusammenhängt.</div>`;
    return;
  }
  const depth2 = $("#lindepth").checked && !S.linRule;
  const mod = S.doc?.module || "FINREP9";
  const els = [], edges = [];
  const shown = new Set(center ? [center] : []);
  const X = [0, 300, 600, 900, 1200];
  const sortR = (ids) => ids.map((id) => S.rules[id]).filter(Boolean)
    .sort((a, b) => (ruleSev(b, mod) === "error") - (ruleSev(a, mod) === "error") || b.tables.length - a.tables.length || a.code.localeCompare(b.code));

  const placeLevel = (rules, fromOf, lvl) => {
    const xr = X[lvl * 2 - 1], xc = X[lvl * 2];
    rules.forEach((r, i) => {
      els.push({ data: { id: `r${lvl}:${r.id}`, label: r.code, color: ruleSev(r, mod) === "error" ? COL.err : COL.warn, rid: r.id }, classes: "rule", position: { x: xr, y: i * 34 } });
      for (const f of fromOf(r)) edges.push([f, `r${lvl}:${r.id}`]);
    });
    // Zellen je Bogen sammeln
    const byT = new Map();
    rules.forEach((r, ri) => {
      for (const c of r.cells) {
        if (shown.has(c) && lvl === 1 && c === center) continue;
        const t = S.ruleCells[c]?.[0] || "?";
        if (!byT.has(t)) byT.set(t, { first: ri, cells: new Map() });
        const g = byT.get(t);
        if (!g.cells.has(c)) g.cells.set(c, new Set());
        g.cells.get(c).add(r.id);
      }
    });
    let y = 0;
    const next = [];
    const tedge = new Set();
    for (const [t, g] of [...byT].sort((a, b) => a[1].first - b[1].first)) {
      const pid = `t${lvl}:${t}`;
      els.push({ data: { id: pid, label: `${tc(t)}  ·  ${g.cells.size} Zelle${g.cells.size > 1 ? "n" : ""}` }, classes: "cmp" });
      y += 30;
      const list = [...g.cells].sort((a, b) => cellLabel(a[0]).localeCompare(cellLabel(b[0])));
      const LIM = 6;
      for (const [c, rids] of list.slice(0, LIM)) {
        const id = `c${lvl}:${c}`;
        if (!shown.has(c)) next.push(c);
        shown.add(c);
        els.push({ data: { id, label: cellLabel(c), parent: pid, cid: c }, classes: "cell", position: { x: xc, y } });
        for (const rid of rids) tedge.add(`r${lvl}:${rid}|${pid}`);
        y += 26;
      }
      if (list.length > LIM) {
        const id = `a${lvl}:${t}`;
        els.push({ data: { id, label: `+ ${list.length - LIM} weitere`, parent: pid }, classes: "agg", position: { x: xc, y } });
        for (const [, rids] of list.slice(LIM)) for (const rid of rids) tedge.add(`r${lvl}:${rid}|${pid}`);
        y += 26;
      }
      y += 22;
    }
    for (const k of tedge) edges.push(k.split("|"));
    // Spalten vertikal zentrieren
    const rh = rules.length * 34, off = (y - rh) / 2;
    for (const e of els) if (e.data.id.startsWith(`r${lvl}:`)) e.position.y += Math.max(0, off);
    return { next, height: Math.max(y, rh) };
  };

  const R1 = sortR(ruleIds);
  const l1 = placeLevel(R1, () => (center ? ["c0"] : []), 1);
  if (center) els.push({ data: { id: "c0", label: cellLabel(center), cid: center }, classes: "cell cur", position: { x: X[0], y: l1.height / 2 } });
  let nR2 = 0;
  if (depth2) {
    const have = new Set(ruleIds);
    const R2ids = new Set();
    const from = new Map();
    for (const c of l1.next.slice(0, 40)) for (const rid of (S.cellRules.get(c) || [])) {
      if (have.has(rid)) continue;
      if (R2ids.size >= 40 && !R2ids.has(rid)) continue;
      R2ids.add(rid);
      if (!from.has(rid)) from.set(rid, new Set());
      from.get(rid).add(`c1:${c}`);
    }
    const R2 = sortR([...R2ids]);
    nR2 = R2.length;
    placeLevel(R2, (r) => [...(from.get(r.id) || [])].filter((id) => els.some((e) => e.data.id === id)), 2);
  }
  const ids = new Set(els.map((e) => e.data.id));
  const elements = [...els, ...edges.filter(([s, t]) => ids.has(s) && ids.has(t)).map(([s, t], i) => ({ data: { id: "x" + i, source: s, target: t }, classes: "cr" }))];
  cy = cytoscape({ container: $("#cy"), style: cyStyle(), elements, wheelSensitivity: 0.25, layout: { name: "preset", padding: 30 }, autoungrabify: true });
  if (cy.zoom() < 0.8) { cy.zoom(0.8); cy.center(cy.nodes(".rule").union(cy.$("#c0"))); }
  const tabsN = new Set(els.filter((e) => e.classes === "cmp").map((e) => e.data.id.split(":")[1])).size;
  $("#linhint").textContent = `${R1.length + nR2} Regeln · ${tabsN} Bögen`;
  const k = center ? cellCodes(S.doc, S.sel) : null;
  const intro = () => {
    S.openRules = new Set();
    side.innerHTML = S.linRule ? `<h3>Regel ${esc(S.rules[S.linRule].code)}</h3><div class="sub">Alle Zellen, die diese Regel prüft – gruppiert nach Bogen.</div>${ruleCard(S.rules[S.linRule], null, mod)}`
      : `<h3>Zell-Lineage</h3><div class="sub"><b>${esc(tc(S.doc.code))} · r${esc(k.r)} · c${esc(k.c)}</b><br>${esc(S.lab.get(`${S.doc.code}|r|${k.r}`) || "")} / ${esc(S.lab.get(`${S.doc.code}|c|${k.c}`) || "")}</div>
         <div class="legend"><span><i style="background:#fff3c4;border:1px solid #c79d00"></i>gewählte Zelle</span><span><i style="background:${COL.err}"></i>Regel (Fehler)</span><span><i style="background:${COL.warn}"></i>Regel (Warnung)</span><span><i style="background:#f4f6f9;border:1px solid #9fb3cc"></i>Bogen</span></div>
         <div class="hint">Links die Zelle, in der Mitte die Regeln, rechts die Zellen, die dieselben Regeln prüfen. Regel anklicken für den Text · Doppelklick auf eine Zelle öffnet sie.</div>
         <div class="rgroup">Regeln</div>${R1.map((r) => ruleRow(r, `${S.doc.code}|${k.r}|${k.c}`, mod)).join("")}`;
    bindChips(side); bindRuleRows(side, k ? `${S.doc.code}|${k.r}|${k.c}` : null, mod);
  };
  intro();
  const hot = (n) => {
    cy.elements().removeClass("hot hotc");
    n.connectedEdges().addClass("hot");
    const rid = n.data("rid");
    if (rid) { const cs = new Set(S.rules[rid].cells); cy.nodes(".cell").filter((x) => cs.has(x.data("cid"))).addClass("hotc"); }
  };
  cy.on("tap", "node.rule", (e) => {
    hot(e.target);
    const r = S.rules[e.target.data("rid")];
    side.innerHTML = `<button class="lnk" id="linback">‹ Übersicht</button><div style="margin-top:8px">${ruleCard(r, k ? `${S.doc.code}|${k.r}|${k.c}` : null, mod)}</div>`;
    $("#linback").onclick = intro;
    bindChips(side); bindLineageBtns(side);
  });
  cy.on("tap", "node.cell", async (e) => {
    hot(e.target);
    const cid = e.target.data("cid"), ci = S.ruleCells[cid];
    if (!ci) return;
    let lbl = "";
    if (moduleOf(ci[0])) {
      const d = await loadDoc(ci[0]); const c = d.cById.get(cid);
      if (c) lbl = `<div class="kv" style="margin-top:8px"><div class="k">Zeile</div><div>${esc(hPath(d, c.r).map((h) => h.label).join(" › "))}</div><div class="k">Spalte</div><div>${esc(hPath(d, c.c).map((h) => h.label).join(" › "))}</div></div>`;
    }
    side.innerHTML = `<button class="lnk" id="linback">‹ Übersicht</button><h3 style="margin-top:8px">${esc(tc(ci[0]))} · ${esc(cellLabel(cid))}</h3><div class="sub">${esc(tableName(ci[0]))}</div>${lbl}
      <div style="margin-top:8px">${(S.cellRules.get(cid) || []).length} Regeln an dieser Zelle.</div>
      ${moduleOf(ci[0]) ? `<div class="acts"><button class="btn" id="opencell">Im Meldebogen öffnen</button></div>` : ""}`;
    $("#linback").onclick = intro;
    $("#opencell")?.addEventListener("click", () => openTable(ci[0], { r: ci[1], c: ci[2], s: ci[3] }));
  });
  cy.on("dbltap", "node.cell", (e) => { const ci = S.ruleCells[e.target.data("cid")]; if (ci && moduleOf(ci[0])) openTable(ci[0], { r: ci[1], c: ci[2], s: ci[3] }); });
  cy.on("mouseover", "node.cell", (e) => showTip(e.originalEvent, cellTip(e.target.data("cid"))));
  cy.on("mouseover", "node.rule", (e) => showTip(e.originalEvent, plain(S.rules[e.target.data("rid")]?.verbal).slice(0, 300)));
  cy.on("mouseout", "node", hideTip);
  cy.on("tap", (e) => { if (e.target === cy) cy.elements().removeClass("hot hotc"); });
}

// ------------------------------------------------------------------ DPM-Struktur
const ENT = [
  { id: "framework", t: "Framework", tech: ["Framework"], x: 60, y: 60,
    d: "Oberste Ebene: ein Meldewesen-Rahmenwerk der EBA, z. B. FINREP, COREP oder Asset Encumbrance.",
    xl: "Entspricht dem Themenbereich, zu dem eine Sammlung von Excel-Meldebögen gehört." },
  { id: "module", t: "Modul", tech: ["Module", "ModuleVersion", "ModuleVersionComposition"], x: 270, y: 60,
    d: "Ein Modul fasst die Meldebögen zusammen, die gemeinsam eingereicht werden (Einreichungspaket bzw. Taxonomie-Einstiegspunkt). Jede Modulversion gilt für einen Zeitraum von Meldestichtagen.",
    xl: "Entspricht der Excel-Arbeitsmappe mit allen Blättern eines Meldepakets." },
  { id: "table", t: "Meldebogen", tech: ["Table", "TableVersion"], x: 480, y: 60,
    d: "Ein Meldebogen (Template) wie F 01.01. Tabellen können in Teile (.a/.b) aufgeteilt sein; dann gibt es eine abstrakte Elterntabelle.",
    xl: "Entspricht einem Excel-Blatt." },
  { id: "header", t: "Zeile / Spalte / Blatt", tech: ["Header", "HeaderVersion", "TableVersionHeader"], x: 720, y: 60,
    d: "Die Achsen eines Meldebogens: Zeilen (y), Spalten (x) und ggf. Blätter (z). Jede Kopfzeile hat Code (z. B. 0110), Bezeichnung, Reihenfolge und Elternzeile – daraus entstehen Einrückung und Hierarchie. Schlüssel-Spalten (🔑) kennzeichnen offene Tabellen.",
    xl: "Entspricht den Zeilen- und Spaltenbeschriftungen inkl. Codes im Excel-Template." },
  { id: "cell", t: "Zelle", tech: ["Cell", "TableVersionCell"], x: 600, y: 210,
    d: "Kreuzungspunkt aus Zeile × Spalte (× Blatt). Pro Version ist festgelegt, ob die Zelle grau/ausgeschlossen ist, welches Vorzeichen gilt, ob sie leer bleiben darf und welcher Datenpunkt dort gemeldet wird.",
    xl: "Entspricht einer Excel-Zelle; graue Zellen sind nicht zu melden." },
  { id: "variable", t: "Datenpunkt", tech: ["Variable", "VariableVersion"], x: 600, y: 370,
    d: "Der eigentliche gemeldete Wert (Fakt). Er ist unabhängig vom Layout definiert – derselbe Datenpunkt kann in mehreren Zellen bzw. Meldebögen auftauchen und muss dann denselben Wert haben.",
    xl: "Die fachliche Bedeutung hinter der Zelle: was genau dort gemeldet wird." },
  { id: "metric", t: "Kennzahl", tech: ["Property (Metrik)", "DataType"], x: 420, y: 510,
    d: "Was gemessen wird, z. B. „Carrying amount“, inklusive Datentyp (Geldbetrag, Prozentsatz, Werteliste …).",
    xl: "Typischerweise die Spaltenüberschrift." },
  { id: "context", t: "Kontext", tech: ["Context", "ContextComposition"], x: 790, y: 470,
    d: "Kombination aller Dimensionen eines Datenpunkts (Signatur). Erst Kennzahl + Kontext beschreiben den Wert eindeutig.",
    xl: "Die Summe aller Merkmale aus Zeile, Spalte und Blatt." },
  { id: "dimension", t: "Dimension & Ausprägung", tech: ["Property", "Item", "Category", "SubCategory"], x: 790, y: 610,
    d: "Eine Dimension (z. B. „Accounting portfolio“) mit einer Ausprägung (z. B. „Financial assets designated at FVTPL“). Ausprägungen sind in Kategorien und Unterkategorien (Hierarchien) organisiert.",
    xl: "Typischerweise die Zeilenbeschriftung bzw. ihre Hierarchie." },
  { id: "operation", t: "Validierungsregel", tech: ["Operation", "OperationVersion"], x: 150, y: 370,
    d: "Prüfregel in der Sprache DPM-XL, z. B. Summenbeziehungen, Vorzeichen oder tabellenübergreifende Abgleiche. Regeln haben eine Vorbedingung (welche Bögen gemeldet sein müssen).",
    xl: "Die Validierungsregeln aus der EBA-Validierungsliste (Excel)." },
  { id: "scope", t: "Geltungsbereich", tech: ["OperationScope", "OperationScopeComposition"], x: 270, y: 210,
    d: "Legt fest, in welchen Modulen eine Regel gilt, ob sie aktiv ist und mit welchem Schweregrad (Fehler = blockierend, Warnung).",
    xl: "Spalten „Severity“ und „Applicability“ der Validierungsliste." },
  { id: "ast", t: "Regelbaum & Operanden", tech: ["OperationNode", "OperandReference", "OperandReferenceLocation"], x: 400, y: 290,
    d: "Jede Regel ist als Baum aus Operatoren (+, =, sum …) gespeichert. Die Blätter verweisen auf Datenpunkte und – über OperandReferenceLocation – auf konkrete Zellen. Das ist die Basis der Lineage-Ansicht.",
    xl: "Die Zellbezüge innerhalb einer Formel." },
  { id: "release", t: "Release", tech: ["Release", "StartReleaseID / EndReleaseID"], x: 60, y: 210,
    d: "Jede *Version-Tabelle hat ein Start- und End-Release. So lässt sich nachvollziehen, seit wann eine Zelle, Zeile oder Regel gilt und wann sie geändert wurde.",
    xl: "Entspricht den Versionsständen der Templates (z. B. 4.2 → 4.4)." },
];
const REL = [
  ["framework", "module", "enthält"], ["module", "table", "enthält"], ["table", "header", "hat Achsen"],
  ["header", "cell", "Zeile × Spalte"], ["table", "cell", "enthält"], ["cell", "variable", "meldet"],
  ["variable", "metric", "misst"], ["variable", "context", "beschrieben durch"], ["context", "dimension", "besteht aus"],
  ["operation", "scope", "gilt in"], ["scope", "module", "für Modul"], ["operation", "ast", "zerlegt in"],
  ["ast", "cell", "verweist auf"], ["ast", "variable", "verweist auf"], ["release", "module", "versioniert"], ["release", "operation", "versioniert"],
];
let cym = null;

function modelExample(id) {
  const doc = S.doc, cell = S.sel;
  if (!doc) return "";
  const k = cell ? cellCodes(doc, cell) : null;
  const v = cell ? doc.vars[cell.var] : null;
  const mod = S.meta.modules.find((m) => m.key === doc.module);
  const ex = {
    framework: `<b>${esc(mod.framework)}</b> – ${esc(mod.frameworkName)}`,
    module: `<b>${esc(mod.code)}</b> – ${esc(mod.name)} · Stichtage ${esc(mod.from)} bis ${esc(mod.to || "offen")} · ${mod.tables.filter((t) => !t.abstract).length} Meldebögen`,
    table: `<b>${esc(tc(doc.code))}</b> – ${esc(doc.name)} · ${doc.Y.length} Zeilen, ${doc.X.length} Spalten${doc.sheets.length ? `, ${doc.sheets.length} Blätter` : ""}`,
    header: cell ? `Zeile <b>r${esc(k.r)}</b>: ${esc(hPath(doc, cell.r).map((h) => h.label).join(" › "))}<br>Spalte <b>c${esc(k.c)}</b>: ${esc(hPath(doc, cell.c).map((h) => h.label).join(" › "))}` : "",
    cell: cell ? `<span class="ccode">${esc(cell.code)}</span> · ${cell.excl ? "grau" : "meldepflichtig"}${cell.sign ? " · Vorzeichen " + esc(SIGN[cell.sign] || cell.sign) : ""}` : "",
    variable: v ? `Variable <b>${esc(v.id)}</b>${cell.same.length ? ` – kommt in ${cell.same.length} weiteren Zelle(n) vor` : ""}` : "",
    metric: v ? `<b>${esc(v.metric[0])}</b> <code class="c">${esc(v.metric[1])}</code> · ${esc(DTYPE[v.metric[2]] || v.metric[2])}` : "",
    context: v ? `${v.dims.length} Dimensionen` : "",
    dimension: v ? `<table>${v.dims.map((d) => `<tr><td>${esc(d[0])}</td><td><b>${esc(d[2])}</b></td></tr>`).join("")}</table>` : "",
    operation: cell && cell.rules.length ? `${cell.rules.length} Regeln an dieser Zelle, z. B.:<br>${verbal(S.rules[cell.rules[0]]?.verbal)}` : "",
    scope: cell && cell.rules.length ? (() => { const r = S.rules[cell.rules[0]]; return `${esc(r.code)}: ${Object.entries(r.sev).map(([m, s]) => `${MOD_LABEL[m]} → ${s === "error" ? "Fehler" : "Warnung"}`).join(", ")}`; })() : "",
    ast: cell && cell.rules.length ? (() => { const r = S.rules[cell.rules[0]]; return `${esc(r.code)} verweist auf ${r.cells.length} Zellen in ${r.tables.map(tc).join(", ")}`; })() : "",
    release: `Aktuelles Release: <b>${esc(S.meta.release.Code)}</b> (${esc(S.meta.release.Date)})`,
  }[id];
  return ex ? `<div class="ex"><b>Beispiel aus deiner Auswahl:</b><br>${ex}</div>` : "";
}

function showEntity(id) {
  const e = ENT.find((x) => x.id === id);
  const counts = e.tech.map((t) => S.meta.counts[t.split(" ")[0]] != null ? `<tr><td><code class="c">${esc(t)}</code></td><td>${S.meta.counts[t.split(" ")[0]].toLocaleString("de-DE")} Einträge</td></tr>` : `<tr><td><code class="c">${esc(t)}</code></td><td></td></tr>`).join("");
  $("#modelside").innerHTML = `<h3>${esc(e.t)}</h3><div class="sub">DPM-Tabellen: ${e.tech.map((t) => `<code class="c">${esc(t)}</code>`).join(" ")}</div>
    <p>${esc(e.d)}</p><p><b>Im Excel-Meldebogen:</b> ${esc(e.xl)}</p>
    <table>${counts}</table>${modelExample(id)}
    ${["cell", "header", "variable", "metric", "dimension", "operation"].includes(id) && !S.sel ? `<div class="note" style="margin-top:10px">Tipp: Wähle in der Meldebogen-Ansicht eine Zelle, dann zeigt diese Ansicht den Weg durch das DPM an deinem Beispiel.</div>` : ""}`;
  bindChips($("#modelside"));
  cym?.nodes().unselect(); cym?.getElementById(id).select();
}

function renderModel() {
  const doc = S.doc, cell = S.sel;
  const k = cell ? cellCodes(doc, cell) : null, v = cell ? doc.vars[cell.var] : null;
  $("#modelintro").innerHTML = `<div style="margin-bottom:6px;color:#555">Vom Excel-Meldebogen zum Datenpunkt – ${cell ? "am Beispiel deiner gewählten Zelle" : "wähle eine Zelle im Meldebogen für ein konkretes Beispiel"}:</div>
    <div class="flow">
      <div class="st" data-e="table"><b>Meldebogen</b><small>${doc ? esc(tc(doc.code)) : "–"}</small></div><span class="ar">→</span>
      <div class="st" data-e="cell"><b>Zelle</b><small>${k ? `r${esc(k.r)} · c${esc(k.c)}` : "–"}</small></div><span class="ar">→</span>
      <div class="st" data-e="variable"><b>Datenpunkt</b><small>${v ? "Variable " + esc(v.id) : "–"}</small></div><span class="ar">→</span>
      <div class="st" data-e="metric"><b>Kennzahl</b><small>${v ? esc(v.metric[0]) : "–"}</small></div><span class="ar">+</span>
      <div class="st" data-e="dimension"><b>Dimensionen</b><small>${v ? v.dims.length + " Merkmale" : "–"}</small></div><span class="ar">→</span>
      <div class="st" data-e="operation"><b>Regeln</b><small>${cell ? cell.rules.length + " Validierungen" : "–"}</small></div>
    </div>`;
  $$("#modelintro .st").forEach((el) => el.onclick = () => showEntity(el.dataset.e));
  if (!cym) {
    cym = cytoscape({
      container: $("#cym"), wheelSensitivity: 0.25, autoungrabify: false,
      style: [
        { selector: "node", style: { shape: "round-rectangle", "background-color": "#fff", "border-color": "#7f9cc0", "border-width": 1.5, label: "data(label)", "text-wrap": "wrap", "text-valign": "center", "font-size": 12, width: 150, height: 52, color: "#223", "font-family": "Segoe UI, Arial" } },
        { selector: "node.rule", style: { "border-color": "#d68910", "background-color": "#fffaf0" } },
        { selector: "node.layout", style: { "border-color": "#217346", "background-color": "#f3faf5" } },
        { selector: "node.meaning", style: { "border-color": "#2f6db5", "background-color": "#f2f6fc" } },
        { selector: "node:selected", style: { "border-width": 3, "border-color": "#ffb000" } },
        { selector: "edge", style: { width: 1.4, "line-color": "#9aa8b8", "target-arrow-shape": "triangle", "target-arrow-color": "#9aa8b8", "curve-style": "bezier", label: "data(label)", "font-size": 9.5, color: "#556", "text-background-color": "#fcfcfc", "text-background-opacity": 1, "text-background-padding": 2 } },
        { selector: "edge.ver", style: { "line-style": "dashed" } },
      ],
      elements: [
        ...ENT.map((e) => ({ data: { id: e.id, label: `${e.t}\n(${e.tech[0]})` }, position: { x: e.x, y: e.y },
          classes: ["operation", "scope", "ast"].includes(e.id) ? "rule" : ["variable", "metric", "context", "dimension"].includes(e.id) ? "meaning" : e.id === "release" ? "" : "layout" })),
        ...REL.map(([a, b, l], i) => ({ data: { id: "m" + i, source: a, target: b, label: l }, classes: l === "versioniert" ? "ver" : "" })),
      ],
      layout: { name: "preset", padding: 30 },
    });
    cym.on("tap", "node", (e) => showEntity(e.target.id()));
  }
  setTimeout(() => { cym.resize(); cym.fit(undefined, 30); }, 0);
  showEntity(cell ? "cell" : "table");
  $("#modelside").insertAdjacentHTML("afterbegin", `<div class="legend" style="margin:0 0 10px"><span><i style="background:#f3faf5;border:1px solid #217346"></i>Layout (Meldebogen-Sicht)</span><span><i style="background:#f2f6fc;border:1px solid #2f6db5"></i>Bedeutung (Datenpunkt-Sicht)</span><span><i style="background:#fffaf0;border:1px solid #d68910"></i>Validierung</span></div>`);
}

// ------------------------------------------------------------------ Datenpunkt-Suche
async function loadDP() {
  if (S.dp) return;
  const d = await fetchJSON("data/datapoints.json");
  d.vars.forEach((v) => {
    v.text = [d.props[v[0]][0], ...v[1].map(([p, i]) => d.props[p][0] + " " + d.items[i][0])].join(" | ").toLowerCase();
    v.mods = new Set(v[2].map((c) => moduleOf(c[0])));
  });
  S.dp = d;
}

async function dpFromCell(cell) {
  await loadDP();
  const v = S.doc.vars[cell.var];
  const P = S.dp.props, I = S.dp.items;
  S.dpf.metric = P.findIndex((p) => p[1] === v.metric[1]);
  S.dpf.dims = new Map();
  for (const d of v.dims) {
    const pi = P.findIndex((p) => p[1] === d[1]), ii = I.findIndex((x) => x[1] === d[3]);
    if (pi >= 0 && ii >= 0) S.dpf.dims.set(pi, ii);
  }
  S.dpf.text = "";
  setView("dp");
}

async function renderDP() {
  $("#dpmain").innerHTML = '<div class="empty">Lade Datenpunkte …</div>';
  await loadDP();
  const F = S.dpf, P = S.dp.props, I = S.dp.items;
  $("#dptext").value = F.text;
  $("#dptext").oninput = () => { F.text = $("#dptext").value; renderDPResults(); };
  $("#dpmod").innerHTML = S.meta.modules.map((m) => `<button data-m="${m.key}" class="${F.mods.has(m.key) ? "on" : ""}">${MOD_LABEL[m.key]}</button>`).join("");
  $$("#dpmod button").forEach((b) => b.onclick = () => {
    if (F.mods.has(b.dataset.m) && F.mods.size > 1) F.mods.delete(b.dataset.m); else F.mods.add(b.dataset.m);
    renderDP();
  });
  renderDPResults();
}

function renderDPResults() {
  const F = S.dpf, P = S.dp.props, I = S.dp.items;
  const toks = F.text.toLowerCase().split(/\s+/).filter(Boolean);
  const res = S.dp.vars.filter((v) =>
    (F.metric == null || v[0] === F.metric) &&
    [...F.dims].every(([p, i]) => v[1].some((d) => d[0] === p && d[1] === i)) &&
    toks.every((t) => v.text.includes(t)) &&
    [...v.mods].some((m) => F.mods.has(m)));
  // aktive Filter
  const act = [];
  if (F.metric != null) act.push(`<div class="af">Kennzahl: <b>${esc(P[F.metric][0])}</b><button data-rm="m">✕</button></div>`);
  for (const [p, i] of F.dims) act.push(`<div class="af">${esc(P[p][0])}: <b>${esc(I[i][0])}</b><button data-rm="${p}">✕</button></div>`);
  $("#dpactive").innerHTML = act.length ? act.join("") + `<button class="lnk" id="dpclear">Alle Filter löschen</button>` : "";
  $$("#dpactive [data-rm]").forEach((b) => b.onclick = () => { b.dataset.rm === "m" ? F.metric = null : F.dims.delete(+b.dataset.rm); renderDPResults(); });
  $("#dpclear")?.addEventListener("click", () => { F.metric = null; F.dims.clear(); F.text = ""; $("#dptext").value = ""; renderDPResults(); });
  // Facetten
  const mc = new Map(), pc = new Map();
  for (const v of res) {
    mc.set(v[0], (mc.get(v[0]) || 0) + 1);
    for (const [p, i] of v[1]) {
      if (F.dims.has(p)) continue;
      if (!pc.has(p)) pc.set(p, new Map());
      pc.get(p).set(i, (pc.get(p).get(i) || 0) + 1);
    }
  }
  const facet = (key, title, entries, click) => {
    const open = F.open.has(key), sorted = [...entries].sort((a, b) => b[1] - a[1]);
    const shown = open ? sorted : sorted.slice(0, 6);
    return `<div class="facet"><h5>${esc(title)} <small>${sorted.length} Werte</small></h5>
      ${shown.map(([k, n]) => `<div class="fv" data-f="${key}" data-v="${k}"><b style="font-weight:400">${esc(click(k))}</b><span>${n}</span></div>`).join("")}
      ${sorted.length > 6 ? `<div class="fv more" data-more="${key}">${open ? "weniger" : `alle ${sorted.length} zeigen`}</div>` : ""}</div>`;
  };
  const fac = [];
  if (F.metric == null) fac.push(facet("m", "Kennzahl", mc, (k) => P[k][0]));
  const props = [...pc].sort((a, b) => [...b[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0));
  for (const [p, m] of props.slice(0, 25)) fac.push(facet(String(p), P[p][0], m, (k) => I[k][0]));
  $("#dpfacets").innerHTML = fac.join("");
  $$("#dpfacets .fv[data-f]").forEach((el) => el.onclick = () => {
    if (el.dataset.f === "m") F.metric = +el.dataset.v; else F.dims.set(+el.dataset.f, +el.dataset.v);
    renderDPResults();
  });
  $$("#dpfacets .fv[data-more]").forEach((el) => el.onclick = () => { F.open.has(el.dataset.more) ? F.open.delete(el.dataset.more) : F.open.add(el.dataset.more); renderDPResults(); });
  // Ergebnisse
  const cells = [];
  for (const v of res) for (const c of v[2]) if (F.mods.has(moduleOf(c[0]))) cells.push([c, v]);
  const byT = new Map();
  for (const x of cells) { if (!byT.has(x[0][0])) byT.set(x[0][0], []); byT.get(x[0][0]).push(x); }
  const LIMIT = 400;
  let n = 0;
  const groups = [];
  for (const [t, list] of byT) {
    if (n >= LIMIT) break;
    const rowsHtml = list.slice(0, LIMIT - n).map(([c, v]) => {
      n++;
      const rl = S.lab.get(`${t}|r|${c[1]}`) || "", cl = S.lab.get(`${t}|c|${c[2]}`) || "";
      const rest = v[1].filter(([p]) => !F.dims.has(p)).map(([p, i]) => `${P[p][0]}: ${I[i][0]}`).join(" · ");
      return `<div class="dpr" data-t="${t}" data-r="${c[1]}" data-c="${c[2]}" data-s="${c[3]}"><div class="loc">r${esc(c[1])} · c${esc(c[2])}${c[3] ? " · s" + esc(c[3]) : ""}</div>
        <div class="lb">${esc(rl)} / <b>${esc(cl)}</b><small>${esc(P[v[0]][0])}${rest ? " · " + esc(rest) : ""}</small></div></div>`;
    }).join("");
    groups.push(`<div class="dpg"><h4>${esc(tc(t))} <span>${esc((S.lineage.nodes.find((x) => x.code === t) || {}).name || "")} · ${list.length} Zellen</span></h4>${rowsHtml}</div>`);
  }
  $("#dpmain").innerHTML = `<div class="cnt"><b>${res.length.toLocaleString("de-DE")}</b> Datenpunkte in <b>${cells.length.toLocaleString("de-DE")}</b> Zellen auf <b>${byT.size}</b> Meldebögen${cells.length > LIMIT ? ` – die ersten ${LIMIT} Zellen werden gezeigt, Filter verfeinern` : ""}.</div>
    ${!F.metric && !F.dims.size && !toks.length ? `<div class="note" style="margin-bottom:12px">Links eine Kennzahl oder ein Merkmal wählen (z. B. <i>Counterparty sector → Households</i>) oder Freitext eingeben. Die Merkmale passen sich der aktuellen Auswahl an.</div>` : ""}
    ${groups.join("")}`;
  $$("#dpmain .dpr").forEach((el) => el.onclick = () => { setView("sheet"); openTable(el.dataset.t, { r: el.dataset.r, c: el.dataset.c, s: el.dataset.s }); });
}

// ------------------------------------------------------------------ Hierarchien (Werte und Summenbeziehungen je Dimension)
const nrm = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
const eqKey = (p, kids) => nrm(p) + "=" + kids.map(nrm).sort().join("+");

async function loadHier() {
  if (!S.hier) {
    const h = await fetchJSON("data/hierarchies.json");
    S.hier = Array.isArray(h) ? h : h.cats;
    S.eqRules = Array.isArray(h) ? {} : h.eqrules || {};
  }
  await loadDP();
  if (S.hdims) return;
  const P = S.dp.props, I = S.dp.items;
  const dims = new Map();
  for (const v of S.dp.vars) for (const [p, i] of v[1]) {
    const name = P[p][0];
    let d = dims.get(name);
    if (!d) dims.set(name, d = { name, code: P[p][1], pi: p, cells: 0, tables: new Set(), items: new Map() });
    d.cells += v[2].length;
    v[2].forEach((c) => d.tables.add(c[0]));
    let it = d.items.get(I[i][1]);
    if (!it) d.items.set(I[i][1], it = { name: I[i][0], sig: I[i][1], ii: i, cells: 0 });
    it.cells += v[2].length;
  }
  for (const d of dims.values()) d.cat = S.hier.find((c) => c.props.includes(d.name)) || null;
  S.hdims = [...dims.values()].sort((a, b) => b.cells - a.cells);
  // Summenregeln der EBA tragen ihre Gleichung im Klartext: "[X] must be equal to +[A] +[B]"
  S.hrules = new Map();
  for (const r of Object.values(S.rules)) {
    const m = (r.desc || "").match(/\[([^\]]+)\]\s*must be equal to\s*(.+)$/i);
    if (!m) continue;
    const key = eqKey(m[1], [...m[2].matchAll(/\[([^\]]+)\]/g)].map((x) => x[1]));
    if (!S.hrules.has(key)) S.hrules.set(key, []);
    S.hrules.get(key).push(r.id);
  }
  for (const [key, e] of Object.entries(S.eqRules)) {
    if (!S.hrules.has(key)) S.hrules.set(key, []);
    for (const id of e.r) if (!S.hrules.get(key).includes(id)) S.hrules.get(key).push(id);
  }
}

// Gleichungen aus allen Hierarchien einer Kategorie, doppelte zusammengeführt
function catEquations(cat) {
  if (cat._eq) return cat._eq;
  const map = new Map();
  for (const s of cat.subs) {
    if (!s.hier) continue;
    s.items.forEach((it, idx) => {
      const kids = s.items.filter((k) => k[2] === idx);
      if (!kids.length) return;
      const key = eqKey(it[0], kids.map((k) => k[0]));
      let e = map.get(key);
      if (!e) map.set(key, e = { parent: it, kids, key, rules: new Set([...(S.hrules.get(key) || []), ...(S.hrules.get(eqKey("", kids.map((k) => k[0]))) || [])]), lists: [] });
      s.rules.forEach((id) => e.rules.add(id));
      e.lists.push(s.code);
    });
  }
  return (cat._eq = [...map.values()]);
}

async function openHier(propName, itemSig) {
  await loadHier();
  S.hi = { ...S.hi, dim: propName, hit: itemSig || null, filter: "" };
  setView("hier");
}

async function renderHier() {
  $("#himain").innerHTML = '<div class="empty">Lade Hierarchien …</div>';
  await loadHier();
  const H = S.hi;
  if (!H.dim || !S.hdims.some((d) => d.name === H.dim)) H.dim = (S.hdims.find((d) => d.name === "Counterparty sector") || S.hdims[0]).name;
  $("#hifilter").value = H.filter || "";
  $("#hifilter").oninput = () => { H.filter = $("#hifilter").value; renderHierDims(); };
  renderHierDims();
  renderHierMain();
}

function renderHierDims() {
  const H = S.hi, f = nrm(H.filter);
  const list = S.hdims.filter((d) => !f || nrm(d.name).includes(f) || [...d.items.values()].some((it) => nrm(it.name).includes(f)));
  $("#hicats").innerHTML = `<div class="hc-head">Dimensionen <span>${list.length}</span></div>` + list.map((d) => {
    const hit = f && !nrm(d.name).includes(f);
    return `<div class="hc-it ${d.name === H.dim ? "on" : ""}" data-d="${esc(d.name)}"><b>${esc(d.name)}</b>
      <span>${fmt(d.items.size)} Werte · ${fmt(d.cells)} Zellen · ${d.tables.size} Bögen${hit ? " · Wert passt" : ""}</span></div>`;
  }).join("");
  $$("#hicats .hc-it").forEach((el) => el.onclick = () => { H.dim = el.dataset.d; H.hit = null; renderHierDims(); renderHierMain(); });
  $("#hicats .hc-it.on")?.scrollIntoView({ block: "nearest" });
}

function renderHierMain() {
  const H = S.hi, d = S.hdims.find((x) => x.name === H.dim);
  if (!d) return;
  const cat = d.cat, f = nrm(H.filter);
  const used = d.items;
  const valueChip = (sig, name) => {
    const it = used.get(sig);
    return it ? `<button class="vchip" data-sig="${esc(sig)}" title="Alle ${it.cells} Zellen mit diesem Wert in der Datenpunkt-Suche zeigen">${fmt(it.cells)}</button>` : `<span class="vnone" title="In FINREP/AE mit dieser Dimension nicht verwendet">–</span>`;
  };
  // 1) Werte als Baum: die Hierarchie, die die meisten verwendeten Werte abdeckt
  let base = null;
  if (cat) {
    let best = -1;
    for (const s of cat.subs) {
      if (!s.hier) continue;
      const cov = s.items.filter((it) => used.has(it[1])).length;
      if (cov > best || (cov === best && s.items.length > base.items.length)) { best = cov; base = s; }
    }
    if (base && best < 2) base = null;
  }
  let treeHtml = "", rest = [...used.values()];
  if (base) {
    const kids = new Map();
    base.items.forEach((it, i) => { const p = it[2] ?? -1; if (!kids.has(p)) kids.set(p, []); kids.get(p).push(i); });
    const inTree = new Set(base.items.map((it) => it[1]));
    rest = rest.filter((it) => !inTree.has(it.sig));
    const node = (i, depth) => {
      const it = base.items[i], ch = kids.get(i) || [];
      const hit = (H.hit && it[1] === H.hit) || (f && nrm(it[0]).includes(f));
      return `<div class="vrow ${used.has(it[1]) ? "" : "unused"} ${hit ? "hit" : ""}" style="padding-left:${8 + depth * 20}px">
        <span class="vname">${ch.length ? "▾ " : ""}${esc(it[0])}</span>${valueChip(it[1])}</div>` + ch.map((c) => node(c, depth + 1)).join("");
    };
    treeHtml = (kids.get(-1) || []).map((r) => node(r, 0)).join("");
  }
  rest.sort((a, b) => b.cells - a.cells);
  const restHtml = rest.map((it) => `<div class="vrow ${(H.hit === it.sig || (f && nrm(it.name).includes(f))) ? "hit" : ""}"><span class="vname">${esc(it.name)}</span>${valueChip(it.sig)}</div>`).join("");

  // 2) Summenbeziehungen, die Werte dieser Dimension betreffen
  const eqs = cat ? catEquations(cat).filter((e) => used.has(e.parent[1]) || e.kids.some((k) => used.has(k[1]))) : [];
  // aus Regeln abgeleitete Gleichungen dieser Dimension, die in keiner EBA-Liste stehen
  const byName = new Map([...used.values()].map((it) => [nrm(it.name), it]));
  const known = new Set(eqs.flatMap((e) => [e.key, eqKey("", e.kids.map((k) => k[0]))]));
  for (const [key, re_] of Object.entries(S.eqRules)) {
    if (re_.dim !== d.name || known.has(key)) continue;
    const item = (n) => [n, byName.get(nrm(n))?.sig || "", null, "+"];
    eqs.push({ parent: re_.p ? item(re_.p) : ["Gesamt (ohne Angabe)", "", null, "="], kids: re_.k.map(item), key, rules: new Set(re_.r), lists: [], derived: true });
  }
  eqs.sort((a, b) => b.rules.size - a.rules.size || (used.has(b.parent[1]) - used.has(a.parent[1])) || b.kids.filter((k) => used.has(k[1])).length - a.kids.filter((k) => used.has(k[1])).length);
  const showAll = H.allEq === d.name;
  const eqHtml = eqs.slice(0, showAll ? 999 : 12).map((e, i) => {
    const terms = e.kids.map((k, j) => `${j ? `<span class="op">${k[3] === "−" ? "−" : "+"}</span>` : k[3] === "−" ? `<span class="op">−</span>` : ""}<span class="term ${used.has(k[1]) ? "" : "unused"}">${esc(k[0])}</span>`).join(" ");
    const rules = [...e.rules].map((id) => S.rules[id]).filter(Boolean);
    const tabs = [...new Set(rules.flatMap((r) => r.tables))];
    return `<div class="eq" data-i="${i}">
      <div class="eqline"><span class="term parent">${esc(e.parent[0])}</span> <span class="op">=</span> ${terms}</div>
      ${e.derived ? '<div class="hint" style="margin-top:2px">aus den Summenregeln abgeleitet (in keiner EBA-Werteliste so hinterlegt)</div>' : ""}
      <div class="eqmeta">${rules.length ? `<button class="lnk eqr">${rules.length} Summenregel${rules.length > 1 ? "n" : ""} ansehen</button> · geprüft in ${tabs.slice(0, 6).map((t) => `<span class="tag" data-t="${esc(t)}">${esc(tc(t))}</span>`).join("")}${tabs.length > 6 ? ` +${tabs.length - 6}` : ""}`
        : `<span class="muted">keine Summenregel in FINREP/AE gefunden</span>`}</div>
      <div class="eqrules" hidden></div></div>`;
  }).join("");

  // 3) Wertelisten (erlaubte Werte, z. B. für Aufzählungs-Spalten)
  const lists = cat ? cat.subs.filter((s) => !s.hier && s.tables.length) : [];

  $("#himain").innerHTML = `
    <div class="hm-head"><h3>${esc(d.name)}</h3>
      <div class="sub">Dimension <code class="c">${esc(d.code || "")}</code>${cat ? ` · Wertebereich „${esc(cat.name)}“` : ""} · verwendet in <b>${fmt(d.cells)}</b> Zellen auf <b>${d.tables.size}</b> Meldebögen</div></div>
    <div class="note hm-intro">Eine <b>Dimension</b> beschreibt ein Merkmal eines Datenpunkts – hier <i>${esc(d.name)}</i>. Sie hat einen festen Satz von <b>Werten</b>.
      Zwischen den Werten bestehen teils <b>Summenbeziehungen</b> (Gesamt = Summe der Teile); daraus erzeugt die EBA automatisch Summenregeln für alle Bögen, die die Dimension nutzen.
      Die Zahl rechts zeigt, in wie vielen Zellen ein Wert vorkommt – Klick öffnet die Zellen.</div>
    <div class="hm-grid">
      <section><h4>Werte <span class="n">${used.size}</span></h4>
        <div class="vlist">${treeHtml}${restHtml ? `${treeHtml ? '<div class="vsub">Weitere verwendete Werte</div>' : ""}${restHtml}` : ""}</div>
        ${base ? `<div class="hint" style="margin-top:6px">Baum nach EBA-Hierarchie <code class="c">${esc(base.code)}</code>; ausgegraute Werte kommen in FINREP/AE mit dieser Dimension nicht vor.</div>` : ""}</section>
      <section><h4>Summenbeziehungen <span class="n">${eqs.length}</span></h4>
        ${eqHtml || '<div class="hint">Für diese Dimension sind keine Summenbeziehungen hinterlegt.</div>'}
        ${eqs.length > 12 && !showAll ? `<button class="lnk" id="eqall">alle ${eqs.length} anzeigen</button>` : ""}
        ${lists.length ? `<details class="techd" style="margin-top:14px"><summary>${lists.length} Werteliste(n) für Aufzählungs-Spalten</summary>
          ${lists.map((s) => `<div class="sevch"><b>${esc(subName(s))}</b> <span class="muted">· ${s.items.length} Werte · in ${s.tables.map((t) => esc(tc(t))).join(", ")}</span>
            <div class="muted" style="margin-top:3px">${s.items.slice(0, 12).map((it) => esc(it[0])).join(" · ")}${s.items.length > 12 ? " …" : ""}</div></div>`).join("")}</details>` : ""}
      </section>
    </div>`;
  $$("#himain .vchip").forEach((b) => b.onclick = () => {
    const it = used.get(b.dataset.sig);
    S.dpf.metric = null; S.dpf.text = ""; S.dpf.dims = new Map([[d.pi, it.ii]]);
    setView("dp");
  });
  $$("#himain .eq").forEach((el) => {
    const btn = $(".eqr", el);
    if (!btn) return;
    btn.onclick = () => {
      const box = $(".eqrules", el), e = eqs[+el.dataset.i];
      box.hidden = !box.hidden;
      if (!box.hidden && !box.innerHTML) {
        box.innerHTML = [...e.rules].map((id) => S.rules[id]).filter(Boolean).map((r) => ruleRow(r, null, Object.keys(r.sev)[0])).join("");
        bindRuleRows(box, null, null); bindChips(box);
      }
    };
  });
  $("#eqall")?.addEventListener("click", () => { H.allEq = d.name; renderHierMain(); });
  bindChips($("#himain"));
  $("#himain .vrow.hit")?.scrollIntoView({ block: "center" });
}

function subName(s) {
  if (s.name && !/^(subcategory|hierarchy)[_ ]?\w*$/i.test(s.name.trim())) return s.name;
  const root = s.items.find((i) => i[2] == null);
  return root ? root[0] : s.code;
}
