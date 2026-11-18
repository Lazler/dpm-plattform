// DPM Explorer – Meldebögen, Regeln, Lineage und DPM-Struktur
// Reines ES-Modul ohne Build-Schritt. Daten kommen aus ./data (siehe scripts/build_data.py).

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tc = (code) => (code || "").replace(/_/g, " ");
const fetchJSON = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + ": " + r.status); return r.json(); });

const MOD_LABEL = { FINREP9: "FINREP (IFRS 9)", AE: "Asset Encumbrance" };
const SRC_LABEL = {
  hierarchy: "Hierarchie / Summenbeziehung", sign: "Vorzeichen", user_defined: "Fachliche Regel",
  variant: "Variante", existence: "Existenz", property_constraint: "Werte-Einschränkung",
};
const DTYPE = {
  monetary: "Geldbetrag", decimal: "Dezimalzahl", integer: "Ganzzahl", percentage: "Prozentsatz", boolean: "Ja/Nein",
  true: "nur „wahr“", date: "Datum", "date time": "Datum/Uhrzeit", enumeration: "Aufzählung (Werteliste)",
  "string (non empty)": "Text", "string (including empty string)": "Text (auch leer)", URI: "URI", ordinals: "Ordinalzahl",
};
const SIGN = { positive: "positiv (≥ 0)", negative: "negativ (≤ 0)" };

const S = {
  meta: null, rules: null, ruleCells: null, lineage: null, search: null,
  mod: "FINREP9", doc: null, docs: new Map(), sheet: null, sel: null,
  view: "sheet", ruleFilter: "all", cellRules: null,
};

// ------------------------------------------------------------------ Start
init().catch((e) => { document.body.innerHTML = `<pre style="padding:20px">Fehler beim Laden: ${esc(e.message)}\n\nBitte die App über einen Webserver öffnen (siehe README).</pre>`; });

async function init() {
  $("#gridwrap").innerHTML = '<div class="empty">Lade Daten …</div>';
  const [meta, rules, lineage, search] = await Promise.all([
    fetchJSON("data/meta.json"), fetchJSON("data/rules.json"), fetchJSON("data/lineage.json"), fetchJSON("data/search.json"),
  ]);
  S.meta = meta; S.rules = rules.rules; S.ruleCells = rules.cells; S.lineage = lineage; S.search = search;
  S.cellRules = new Map();
  for (const r of Object.values(S.rules)) for (const c of r.cells) {
    if (!S.cellRules.has(c)) S.cellRules.set(c, []);
    S.cellRules.get(c).push(r.id);
  }
  $("#rel").textContent = `Release ${meta.release.Code}`;
  $$("#views button").forEach((b) => b.onclick = () => setView(b.dataset.view));
  $("#dclose").onclick = () => { $("#details").hidden = true; selectCell(null); };
  initSearch();
  initTooltips();
  renderModSel();
  const h = parseHash();
  if (h.t) { S.mod = moduleOf(h.t) || S.mod; renderModSel(); await openTable(h.t, h); }
  else await openTable(firstTable(S.mod));
  window.addEventListener("hashchange", async () => {
    const x = parseHash();
    if (x.t && (!S.doc || x.t !== S.doc.code)) { S.mod = moduleOf(x.t) || S.mod; renderModSel(); await openTable(x.t, x); }
  });
}

const modTables = (m) => S.meta.modules.find((x) => x.key === m).tables;
const firstTable = (m) => modTables(m).find((t) => !t.abstract).code;
const moduleOf = (code) => S.meta.modules.find((m) => m.tables.some((t) => t.code === code && !t.abstract))?.key;

function parseHash() {
  const m = location.hash.match(/^#\/([^?]+)(?:\?(.*))?$/);
  if (!m) return {};
  const p = new URLSearchParams(m[2] || "");
  return { t: decodeURIComponent(m[1]), r: p.get("r"), c: p.get("c"), s: p.get("s") };
}
function setHash() {
  if (!S.doc) return;
  const p = new URLSearchParams();
  if (S.sel) { const c = cellCodes(S.doc, S.sel); if (c.r) p.set("r", c.r); if (c.c) p.set("c", c.c); if (c.s) p.set("s", c.s); }
  const h = `#/${S.doc.code}${p.toString() ? "?" + p : ""}`;
  if (location.hash !== h) history.replaceState(null, "", h);
}

function setView(v) {
  S.view = v;
  $$("#views button").forEach((b) => b.classList.toggle("on", b.dataset.view === v));
  $$(".view").forEach((s) => s.classList.toggle("on", s.id === "view-" + v));
  if (v === "lineage") renderLineage();
  if (v === "model") renderModel();
}

// ------------------------------------------------------------------ Modul & Inhaltsverzeichnis
function renderModSel() {
  $("#modsel").innerHTML = S.meta.modules.map((m) =>
    `<button data-m="${m.key}" class="${m.key === S.mod ? "on" : ""}" title="${esc(m.name)} – ${m.tables.filter((t) => !t.abstract).length} Bögen, ${m.rules} Regeln">${esc(MOD_LABEL[m.key] || m.key)}</button>`).join("");
  $$("#modsel button").forEach((b) => b.onclick = () => { S.mod = b.dataset.m; renderModSel(); openTable(firstTable(S.mod)); });
  $("#tocfilter").oninput = renderToc;
  renderToc();
}

function renderToc() {
  const f = $("#tocfilter").value.trim().toLowerCase();
  const tabs = modTables(S.mod);
  const out = [];
  for (const t of tabs) {
    if (t.parent && tabs.some((x) => x.code === t.parent)) continue; // wird unter Elterntabelle gezeigt
    const kids = tabs.filter((x) => x.parent === t.code);
    const match = (x) => !f || (x.code + " " + x.name).toLowerCase().includes(f) || tc(x.code).toLowerCase().includes(f);
    if (t.abstract) {
      const km = kids.filter(match);
      if (!km.length && !match(t)) continue;
      out.push(`<div class="grp">${esc(tc(t.code))} <span>${esc(t.name)}</span></div>`);
      for (const k of (km.length ? km : kids)) out.push(tocItem(k, true));
    } else if (match(t)) out.push(tocItem(t));
  }
  $("#toclist").innerHTML = out.join("") || '<div class="empty">Kein Treffer</div>';
  $$("#toclist .it").forEach((el) => el.onclick = () => openTable(el.dataset.t));
}
const tocItem = (t, child) => `<div class="it ${child ? "child" : ""} ${S.doc?.code === t.code ? "on" : ""}" data-t="${t.code}">
  <b>${esc(tc(t.code))}</b><span>${esc(t.name)}</span></div>`;

function renderTabs() {
  const tabs = modTables(S.mod).filter((t) => !t.abstract);
  $("#tabs").innerHTML = tabs.map((t) => `<button data-t="${t.code}" class="${t.code === S.doc?.code ? "on" : ""}" title="${esc(t.name)}">${esc(tc(t.code))}</button>`).join("");
  $$("#tabs button").forEach((b) => b.onclick = () => openTable(b.dataset.t));
  $("#tabs .on")?.scrollIntoView({ block: "nearest", inline: "nearest" });
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
  return { r: doc.hById.get(c.r)?.code || "", c: doc.hById.get(c.c)?.code || "", s: doc.hById.get(c.s)?.code || "" };
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

  // Zeilen: Reihenfolge wie im DPM, Einrückung nach Hierarchie
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

async function openTable(code, target = {}) {
  const mod = moduleOf(code);
  if (mod && mod !== S.mod) { S.mod = mod; renderModSel(); }
  const doc = await loadDoc(code);
  S.doc = doc; S.sel = null;
  S.sheet = doc.sheets.length ? (doc.sheets.find((z) => z.code === target.s) || doc.sheets[0]).id : null;
  renderToc(); renderTabs(); renderZbar(); renderGrid();
  $("#toclist .on")?.scrollIntoView({ block: "nearest" });
  let cell = null;
  if (target.r || target.c) cell = doc.byCodes.get(`${target.r || ""}|${target.c || ""}|${target.s || (doc.sheets.length ? doc.hById.get(S.sheet).code : "")}`)
    || doc.cells.find((c) => { const k = cellCodes(doc, c); return k.r === (target.r || "") && k.c === (target.c || ""); });
  if (cell) selectCell(cell, true);
  else { $("#details").hidden = true; $("#namebox").textContent = tc(doc.code); $("#fxval").textContent = doc.name; }
  setHash();
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
  z.innerHTML = parts.join(" &nbsp; ");
  const sel = $("#zsel");
  if (sel) sel.onchange = () => { S.sheet = +sel.value; S.sel = null; renderGrid(); };
}

function colName(i) { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

function renderGrid() {
  const doc = S.doc, L = buildLayout(doc);
  doc.L = L;
  const ncols = 2 + L.cols.length;
  const sheetKey = doc.sheets.length ? S.sheet : "";
  let rn = 0;
  const out = [];
  out.push(`<table class="xl"><thead><tr><th class="corner"></th>${Array.from({ length: ncols }, (_, i) => `<th class="col" data-ci="${i}">${colName(i)}</th>`).join("")}</tr></thead><tbody>`);
  const row = (inner, attrs = "") => `<tr ${attrs}><th class="rn">${++rn}</th>${inner}</tr>`;
  out.push(row(`<td class="title" colspan="${ncols}">${esc(tc(doc.code))} – ${esc(doc.name)}</td>`));
  out.push(row(`<td class="subtitle" colspan="${ncols}">${esc(MOD_LABEL[doc.module] || doc.module)} · Release ${esc(S.meta.release.Code)}${doc.sheets.length ? " · Blatt: " + esc(doc.hById.get(S.sheet)?.label) : ""}</td>`));
  out.push(row(`<td class="blank" colspan="${ncols}"></td>`));
  L.hrows.forEach((hr, d) => {
    let inner = "";
    if (d === 0) inner += `<td class="blank" rowspan="${L.D + 1}"></td><td class="blank" rowspan="${L.D + 1}"></td>`;
    for (const x of hr) {
      if (x.blank) inner += `<td class="h" colspan="1" rowspan="${x.rowspan}"></td>`;
      else inner += `<td class="h" colspan="${x.colspan}" rowspan="${x.rowspan}" title="${esc(x.h.label)}">${esc(x.h.label)}</td>`;
    }
    out.push(row(inner));
  });
  out.push(row(L.cols.map((h) => `<td class="hc ${h.key ? "key" : ""}">${esc(h.code || "")}</td>`).join("")));

  const dataCells = (rid) => L.cols.map((h) => {
    const c = doc.cellMap.get(`${rid ?? ""}|${h.id}|${sheetKey ?? ""}`);
    if (!c) return `<td class="d g"></td>`;
    if (c.excl) return `<td class="d g" data-id="${c.id}"></td>`;
    const rs = c.rules.map((id) => S.rules[id]).filter(Boolean);
    const err = rs.some((r) => Object.values(r.sev).includes("error"));
    const mk = rs.length ? `<i class="mk ${err ? "e" : ""}"></i>` : "";
    return `<td class="d ${c.void ? "v" : ""}" data-id="${c.id}">${mk}</td>`;
  }).join("");

  if (!L.rows.length) {
    for (let i = 0; i < 3; i++) out.push(row(`<td class="rc">…</td><td class="rl"><span class="ph">offene Zeile ${i + 1}</span></td>${dataCells(null)}`));
  }
  for (const r of L.rows) {
    const pad = 6 + r.depth * 16;
    const cls = r.h.abs ? "abs" : r.top ? "top" : "";
    out.push(row(`<td class="rc">${esc(r.h.code || "")}</td><td class="rl ${cls}" style="padding-left:${pad}px">${esc(r.h.label)}</td>${dataCells(r.h.id)}`, `data-r="${r.h.id}"`));
  }
  out.push("</tbody></table>");
  $("#gridwrap").innerHTML = out.join("");
  $("#gridwrap").scrollTop = 0;
  $("#gridwrap table").addEventListener("click", (e) => {
    const td = e.target.closest("td.d[data-id]");
    if (td) selectCell(doc.cById.get(+td.dataset.id));
  });
  $("#gridwrap table").addEventListener("mouseover", (e) => {
    const td = e.target.closest("td.d[data-id]");
    if (!td) return;
    const c = doc.cById.get(+td.dataset.id), k = cellCodes(doc, c);
    showTip(e, `${tc(doc.code)} · r${k.r} · c${k.c}${k.s ? " · s" + k.s : ""}${c.excl ? "\n(grau – nicht zu melden)" : ""}${c.rules.length ? `\n${c.rules.length} Validierungsregel(n)` : ""}`);
  });
  $("#gridwrap table").addEventListener("mouseout", hideTip);
}

// ------------------------------------------------------------------ Zellauswahl & Details
function selectCell(cell, scroll) {
  $$("#gridwrap td.sel").forEach((x) => x.classList.remove("sel"));
  $$("#gridwrap tr.sel, #gridwrap th.col.sel").forEach((x) => x.classList.remove("sel"));
  S.sel = cell;
  setHash();
  if (!cell) return;
  const doc = S.doc;
  if (cell.s && doc.sheets.length && cell.s !== S.sheet) { S.sheet = cell.s; renderZbar(); renderGrid(); }
  const td = $(`#gridwrap td.d[data-id="${cell.id}"]`);
  if (td) {
    td.classList.add("sel");
    td.parentElement.classList.add("sel");
    const ci = [...td.parentElement.children].indexOf(td) - 1;
    $(`#gridwrap th.col[data-ci="${ci}"]`)?.classList.add("sel");
    if (scroll) td.scrollIntoView({ block: "center", inline: "center" });
  }
  const k = cellCodes(doc, cell);
  $("#namebox").textContent = `${tc(doc.code)} · r${k.r} · c${k.c}${k.s ? " · s" + k.s : ""}`;
  const v = doc.vars[cell.var];
  $("#fxval").textContent = v ? [v.metric[0], ...v.dims.map((d) => `${d[0]}: ${d[2]}`)].join("  |  ") : (cell.excl ? "graue Zelle – nicht zu melden" : "–");
  renderDetails(cell);
}

function chip(seg, curKey) {
  const ref = seg.ref || {};
  const key = ref.t && ref.r && ref.c ? `${ref.t}|${ref.r}|${ref.c}` : null;
  const linkable = ref.t && moduleOf(ref.t);
  return `<span class="chip ${key && key === curKey ? "cur" : ""} ${linkable ? "" : "nolink"}" data-t="${esc(ref.t || "")}" data-r="${esc(ref.r || "")}" data-c="${esc(ref.c || "")}" data-tip="${esc(seg.tip || "")}">${esc(seg.text)}</span>`;
}
function verbal(segs, curKey) {
  if (!segs) return "";
  return segs.map((s) => typeof s === "string" ? esc(s) : chip(s, curKey)).join("");
}

function ruleCard(r, curKey, mod) {
  const sev = r.sev[mod] || Object.values(r.sev)[0];
  const isErr = sev === "error";
  const other = Object.entries(r.sev).filter(([m]) => m !== mod).map(([m, s]) => `${MOD_LABEL[m] || m}: ${s === "error" ? "Fehler" : "Warnung"}`);
  return `<div class="rule ${isErr ? "e" : ""}" data-rule="${r.id}">
    <div class="rh"><b>${esc(r.code)}</b><span class="badge ${isErr ? "e" : "w"}">${isErr ? "Fehler" : "Warnung"}</span>
      <span>${esc(SRC_LABEL[r.src] || r.src)}</span>${r.tables.length > 1 ? `<span>· ${r.tables.length} Tabellen</span>` : ""}
      ${other.length ? `<span title="Schweregrad in anderen Modulen">· ${esc(other.join(", "))}</span>` : ""}</div>
    <div class="rv">${r.verbal ? verbal(r.verbal, curKey) : `<i>Keine Verbalisierung verfügbar.</i>`}</div>
    ${r.pre_verbal ? `<div class="pre">Wird nur geprüft, wenn gemeldet: ${verbal(r.pre_verbal)}</div>` : ""}
    <details><summary>Technische Sicht (DPM-XL)</summary>
      <pre>${esc(r.expr)}</pre>
      ${r.desc ? `<div><b>Beschreibung der EBA:</b> ${esc(r.desc)}</div>` : ""}
      ${r.pre ? `<div style="margin-top:4px"><b>Vorbedingung:</b> <code class="c">${esc(r.pre)}</code></div>` : ""}
      <div style="margin-top:4px"><b>Beteiligte Tabellen:</b> ${r.tables.map((t) => esc(tc(t))).join(", ")} · ${r.cells.length} Zellen</div>
    </details>
    <div class="acts"><button class="lnk" data-act="lineage" data-rule="${r.id}">In Lineage anzeigen</button></div>
  </div>`;
}

function renderDetails(cell) {
  const doc = S.doc, k = cellCodes(doc, cell);
  const v = doc.vars[cell.var];
  const curKey = `${doc.code}|${k.r}|${k.c}`;
  $("#details").hidden = false;
  const status = cell.excl ? `<span class="badge grey">grau – nicht zu melden</span>` : cell.void ? `<span class="badge grey">ohne Datenpunkt</span>` : `<span class="badge">meldepflichtig</span>`;
  $("#dtitle").innerHTML = `<span class="ccode">{${esc(tc(doc.code))}, r${esc(k.r)}, c${esc(k.c)}${k.s ? ", s" + esc(k.s) : ""}}</span>${status}
    <div style="margin-top:4px;color:#555;font-size:12px">${esc(doc.name)}</div>`;
  const path = (id, ax) => {
    const p = hPath(doc, id);
    if (!p.length) return "–";
    return `<div class="path">${p.map((h, i) => i < p.length - 1 ? `<span class="p">${esc(h.label)} ›</span> ` : `<b>${esc(h.label)}</b>`).join("")} <code class="c">${ax}${esc(p[p.length - 1].code || "")}</code></div>`;
  };
  const rs = cell.rules.map((id) => S.rules[id]).filter(Boolean)
    .sort((a, b) => (b.sev[doc.module] === "error") - (a.sev[doc.module] === "error") || a.code.localeCompare(b.code));
  const nErr = rs.filter((r) => r.sev[doc.module] === "error").length;
  const shown = rs.filter((r) => S.ruleFilter === "all" || (S.ruleFilter === "e" ? r.sev[doc.module] === "error" : S.ruleFilter === "x" ? r.tables.length > 1 : r.sev[doc.module] !== "error"));

  const html = [];
  html.push(`<div class="sec"><h4>Position im Meldebogen</h4><div class="kv">
    <div class="k">Zeile</div><div>${path(cell.r, "r")}</div>
    <div class="k">Spalte</div><div>${path(cell.c, "c")}</div>
    ${cell.s ? `<div class="k">Blatt</div><div>${path(cell.s, "s")}</div>` : ""}
  </div></div>`);

  if (v) {
    html.push(`<div class="sec"><h4>Datenpunkt</h4><div class="kv">
      <div class="k">Kennzahl</div><div><b>${esc(v.metric[0])}</b> <code class="c">${esc(v.metric[1] || "")}</code></div>
      <div class="k">Datentyp</div><div>${esc(DTYPE[v.metric[2]] || v.metric[2] || "–")}${v.enum ? ` · Werteliste <i>${esc(v.enum[1])}</i>` : ""}</div>
      ${cell.sign ? `<div class="k">Vorzeichen</div><div>${esc(SIGN[cell.sign] || cell.sign)}</div>` : ""}
      <div class="k">Leer erlaubt</div><div>${cell.nullable ? "ja" : "nein – Pflichtangabe"}</div>
      <div class="k">Variable</div><div><code class="c">${esc(v.id)}</code></div>
    </div>
    ${v.dims.length ? `<table class="dims" style="margin-top:8px">${v.dims.map((d) =>
      `<tr><td>${esc(d[0])} <code class="c">${esc(d[1] || "")}</code></td><td><b>${esc(d[2])}</b> <code class="c">${esc(d[3] || "")}</code></td></tr>`).join("")}</table>` : ""}
    </div>`);
  }

  if (cell.same?.length) {
    html.push(`<div class="sec"><h4>Gleicher Datenpunkt auch in <span class="n">${cell.same.length}</span></h4><div class="chips">${cell.same.map((cc) => {
      const m = cc.match(/\{(.+?), r(\w+), c(\w+)(?:, s(\w+))?\}/);
      return m ? `<span class="chip" data-t="${m[1]}" data-r="${m[2]}" data-c="${m[3]}" data-s="${m[4] || ""}" data-tip="Dieselbe Variable wird in dieser Zelle gemeldet – Werte müssen identisch sein.">${esc(tc(m[1]))} · r${m[2]} · c${m[3]}</span>` : esc(cc);
    }).join("")}</div></div>`);
  }

  html.push(`<div class="sec"><h4>Validierungsregeln <span class="n">${rs.length}</span>${nErr ? `<span class="badge e">${nErr} Fehler</span>` : ""}</h4>
    ${rs.length ? `<div class="filt">${[["all", "Alle"], ["e", "Fehler"], ["w", "Warnungen"], ["x", "Tabellenübergreifend"]].map(([k2, l]) => `<button data-f="${k2}" class="${S.ruleFilter === k2 ? "on" : ""}">${l}</button>`).join("")}</div>` : `<div class="hint">Keine aktiven Regeln für diese Zelle.</div>`}
    ${shown.slice(0, 60).map((r) => ruleCard(r, curKey, doc.module)).join("")}
    ${shown.length > 60 ? `<div class="hint">… und ${shown.length - 60} weitere</div>` : ""}
  </div>`);

  if (rs.length) {
    const tabs = new Map();
    for (const r of rs) for (const t of r.tables) if (t !== doc.code) tabs.set(t, (tabs.get(t) || 0) + 1);
    if (tabs.size) html.push(`<div class="sec"><h4>Verknüpfte Meldebögen <span class="n">${tabs.size}</span></h4>
      <div class="chips">${[...tabs].sort((a, b) => b[1] - a[1]).map(([t, n]) => `<span class="chip ${moduleOf(t) ? "" : "nolink"}" data-t="${esc(t)}" data-tip="${esc((S.lineage.nodes.find((x) => x.code === t) || {}).name || "")}\n${n} gemeinsame Regel(n)">${esc(tc(t))} <small>(${n})</small></span>`).join("")}</div>
      <div class="more"><button class="lnk" data-act="celllineage">Zell-Lineage als Graph anzeigen</button></div></div>`);
  }

  html.push(`<div class="sec"><h4>Instructions & Rechtsgrundlagen</h4><div class="note">Die EBA liefert in der DPM-Datenbank keine Instructions- oder Rechtsgrundlagentexte (die Tabellen <i>Document</i>, <i>Subdivision</i> und <i>Reference</i> sind leer). Diese können in einem nächsten Schritt aus den ITS-Annexen bzw. den annotierten Templates ergänzt werden.</div></div>`);

  $("#dbody").innerHTML = html.join("");
  $$("#dbody .filt button").forEach((b) => b.onclick = () => { S.ruleFilter = b.dataset.f; renderDetails(cell); });
  $$("#dbody .rule").forEach((el) => {
    el.onmouseenter = () => highlightRule(+el.dataset.rule, true);
    el.onmouseleave = () => highlightRule(+el.dataset.rule, false);
  });
  bindChips($("#dbody"));
  $$("#dbody [data-act=lineage]").forEach((b) => b.onclick = () => { S.linRule = +b.dataset.rule; S.linMode = "cell"; setView("lineage"); });
  $$("#dbody [data-act=celllineage]").forEach((b) => b.onclick = () => { S.linRule = null; S.linMode = "cell"; setView("lineage"); });
}

function highlightRule(id, on) {
  const r = S.rules[id];
  if (!r) return;
  for (const c of r.cells) $(`#gridwrap td.d[data-id="${c}"]`)?.classList.toggle("hl", on);
}

function bindChips(root) {
  $$(".chip", root).forEach((ch) => {
    ch.onmouseenter = (e) => {
      if (ch.dataset.tip) showTip(e, ch.dataset.tip);
      if (S.doc && ch.dataset.t === S.doc.code && ch.dataset.r && ch.dataset.c) {
        const c = S.doc.byCodes.get(`${ch.dataset.r}|${ch.dataset.c}|${ch.dataset.s || cellCodes(S.doc, S.sel || {}).s || ""}`)
          || S.doc.cells.find((x) => { const k = cellCodes(S.doc, x); return k.r === ch.dataset.r && k.c === ch.dataset.c; });
        if (c) $(`#gridwrap td.d[data-id="${c.id}"]`)?.classList.add("hl2");
      }
    };
    ch.onmouseleave = () => { hideTip(); $$("#gridwrap td.hl2").forEach((x) => x.classList.remove("hl2")); };
    ch.onclick = () => {
      const t = ch.dataset.t;
      if (!t || !moduleOf(t)) return;
      hideTip();
      setView("sheet");
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

// ------------------------------------------------------------------ Suche
function initSearch() {
  const q = $("#q"), res = $("#results");
  let items = [], act = -1;
  const run = () => {
    const s = q.value.trim().toLowerCase();
    if (s.length < 2) { res.hidden = true; return; }
    const groups = [];
    const tabs = S.meta.modules.flatMap((m) => m.tables.filter((t) => !t.abstract).map((t) => ({ ...t, mod: m.key })));
    const norm = s.replace(/_/g, " ");
    const cm = norm.match(/([a-z]\s?\d{2}\.\d{2}(?:\.[\w.]+)?)\D+r?(\d{3,4})\D+c?(\d{3,4})/i);
    const T = tabs.filter((t) => (tc(t.code) + " " + t.name).toLowerCase().includes(norm)).slice(0, 8)
      .map((t) => ({ k: "t", t: t.code, title: tc(t.code), sub: `${t.name} · ${MOD_LABEL[t.mod]}` }));
    if (cm) {
      const code = tabs.find((t) => tc(t.code).toLowerCase() === cm[1].replace(/\s/, " ").toLowerCase().replace(/^([a-z])(\d)/, "$1 $2"));
      if (code) groups.push(["Zelle", [{ k: "c", t: code.code, r: cm[2].padStart(4, "0"), c: cm[3].padStart(4, "0"), title: `${tc(code.code)} · r${cm[2]} · c${cm[3]}`, sub: code.name }]]);
    }
    if (T.length) groups.push(["Meldebögen", T]);
    const R = Object.values(S.rules).filter((r) => r.code.toLowerCase().includes(s)).slice(0, 6)
      .map((r) => ({ k: "r", id: r.id, title: r.code, sub: (r.verbal || []).map((x) => typeof x === "string" ? x : x.text).join("").slice(0, 140) }));
    if (R.length) groups.push(["Regeln", R]);
    const H = S.search.filter((h) => h[3].toLowerCase().includes(s)).slice(0, 12)
      .map((h) => ({ k: "h", t: h[0], ax: h[1], code: h[2], title: h[3], sub: `${tc(h[0])} · ${h[1] === "r" ? "Zeile" : h[1] === "c" ? "Spalte" : "Blatt"} ${h[2]}` }));
    if (H.length) groups.push(["Zeilen & Spalten", H]);
    items = groups.flatMap((g) => g[1]); act = -1;
    res.innerHTML = groups.length ? groups.map(([g, list]) => `<div class="grp">${g}</div>` + list.map((it) =>
      `<div class="r" data-i="${items.indexOf(it)}"><b>${esc(it.title)}</b><small>${esc(it.sub)}</small></div>`).join("")).join("")
      : `<div class="r"><small>Keine Treffer</small></div>`;
    res.hidden = false;
    $$(".r[data-i]", res).forEach((el) => el.onmousedown = (e) => { e.preventDefault(); go(items[+el.dataset.i]); });
  };
  const go = async (it) => {
    if (!it) return;
    res.hidden = true; q.blur();
    setView("sheet");
    if (it.k === "t") await openTable(it.t);
    if (it.k === "c") await openTable(it.t, { r: it.r, c: it.c });
    if (it.k === "h") {
      const doc = await loadDoc(it.t);
      const c = doc.cells.find((x) => { const k = cellCodes(doc, x); return k[it.ax] === it.code && !x.excl; });
      if (c) { const k = cellCodes(doc, c); await openTable(it.t, k); } else await openTable(it.t);
    }
    if (it.k === "r") {
      const r = S.rules[it.id];
      const cid = r.cells.find((c) => { const ci = S.ruleCells[c]; return ci && moduleOf(ci[0]); });
      const ci = S.ruleCells[cid];
      if (ci) await openTable(ci[0], { r: ci[1], c: ci[2], s: ci[3] });
    }
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
    } else if (e.key === "Enter") go(items[act >= 0 ? act : 0]);
    else if (e.key === "Escape") { res.hidden = true; q.blur(); }
  };
}

// ------------------------------------------------------------------ Lineage
const COL = { FINREP9: "#2f6db5", AE: "#217346", ext: "#a0a0a0", err: "#c0392b", warn: "#d68910" };
let cy = null;
S.linMode = "tables"; S.linMods = new Set(["FINREP9", "AE"]);

function cyStyle() {
  return [
    { selector: "node", style: { label: "data(label)", "font-size": 10, "text-valign": "center", "text-halign": "center", color: "#fff", "background-color": "data(color)", width: "data(size)", height: "data(size)", "text-wrap": "wrap", "text-max-width": 90, "font-family": "Segoe UI, Arial" } },
    { selector: "node.tbl", style: { shape: "round-rectangle", width: "label", height: 22, padding: 6, "font-weight": 600 } },
    { selector: "node.ext", style: { "background-color": COL.ext } },
    { selector: "node.cmp", style: { "background-color": "#f4f6f9", "background-opacity": 1, "border-color": "#9fb3cc", "border-width": 1, shape: "round-rectangle", label: "data(label)", "text-valign": "top", "text-halign": "center", color: "#334", "font-weight": 600, "font-size": 11, padding: 10 } },
    { selector: "node.cell", style: { shape: "rectangle", "background-color": "#fff", "border-color": "#8a8a8a", "border-width": 1, color: "#222", width: "label", height: 18, padding: 4, "font-size": 9 } },
    { selector: "node.cell.cur", style: { "background-color": "#fff3c4", "border-color": "#c79d00", "border-width": 2, "font-weight": 700 } },
    { selector: "node.rule", style: { shape: "diamond", width: 26, height: 26, "background-color": "data(color)", label: "data(label)", color: "#333", "text-valign": "bottom", "text-margin-y": 3, "font-size": 9 } },
    { selector: "node.agg", style: { shape: "round-rectangle", "background-color": "#eef1f5", "border-color": "#8a8a8a", "border-width": 1, "border-style": "dashed", color: "#333", width: "label", height: 18, padding: 4, "font-size": 9 } },
    { selector: "edge", style: { width: "data(w)", "line-color": "#b8c4d2", "curve-style": "bezier", opacity: 0.75 } },
    { selector: "edge.cr", style: { width: 1.2, "line-color": "#999" } },
    { selector: ".faded", style: { opacity: 0.12 } },
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
  const tablesMode = S.linMode === "tables";
  $("#linmod").hidden = !tablesMode; $("#linextwrap").hidden = !tablesMode; $("#lindepthwrap").hidden = tablesMode;
  $("#linext").onchange = renderLineage; $("#lindepth").onchange = renderLineage;
  if (cy) { cy.destroy(); cy = null; }
  if (tablesMode) lineageTables(); else lineageCell();
}

function lineageTables() {
  const ext = $("#linext").checked;
  const nodes = S.lineage.nodes.filter((n) => (n.inModule && S.linMods.has(n.module)) || (ext && !n.inModule));
  const ids = new Set(nodes.map((n) => n.code));
  const edges = S.lineage.edges.filter((e) => ids.has(e.a) && ids.has(e.b));
  const deg = new Map();
  for (const e of edges) { deg.set(e.a, (deg.get(e.a) || 0) + e.rules.length); deg.set(e.b, (deg.get(e.b) || 0) + e.rules.length); }
  const used = nodes.filter((n) => deg.get(n.code) || n.inModule);
  cy = cytoscape({
    container: $("#cy"), style: cyStyle(), wheelSensitivity: 0.25,
    elements: [
      ...used.map((n) => ({ data: { id: n.code, label: tc(n.code), color: n.inModule ? COL[n.module] : COL.ext }, classes: "tbl" + (n.inModule ? "" : " ext") })),
      ...edges.map((e, i) => ({ data: { id: "e" + i, source: e.a, target: e.b, w: Math.min(10, 1 + Math.log2(e.rules.length)), rules: e.rules } })),
    ],
    layout: { name: "cose", animate: false, nodeRepulsion: 9000, idealEdgeLength: 90, edgeElasticity: 80, gravity: 0.6, numIter: 1500, randomize: true },
  });
  $("#linhint").textContent = `${used.length} Meldebögen · ${edges.length} Verbindungen über gemeinsame Validierungsregeln`;
  const side = $("#linside");
  side.innerHTML = `<h3>Tabellen-Zusammenhänge</h3><div class="sub">Zwei Meldebögen sind verbunden, wenn mindestens eine Validierungsregel Zellen aus beiden prüft. Die Linienstärke zeigt die Anzahl der Regeln.</div>
    <div class="legend"><span><i style="background:${COL.FINREP9}"></i>FINREP</span><span><i style="background:${COL.AE}"></i>Asset Encumbrance</span><span><i style="background:${COL.ext}"></i>andere Module (z. B. Pillar 3, COREP)</span></div>
    <div class="hint">Meldebogen anklicken, um seine Verbindungen zu sehen. Verbindungslinie anklicken für die Regeln dazwischen.</div>
    <h4 style="margin:16px 0 6px">Am stärksten vernetzt</h4>
    ${[...deg].filter(([c]) => ids.has(c)).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([c, n]) => `<div class="nb" data-n="${c}"><b>${esc(tc(c))}</b><span>${n} Regelbezüge</span></div>`).join("")}`;
  $$("#linside .nb").forEach((el) => el.onclick = () => focusTable(el.dataset.n));
  cy.on("tap", "node", (e) => focusTable(e.target.id()));
  cy.on("tap", "edge", (e) => showEdge(e.target));
  cy.on("tap", (e) => { if (e.target === cy) cy.elements().removeClass("faded"); });
  cy.on("mouseover", "node", (e) => { const n = S.lineage.nodes.find((x) => x.code === e.target.id()); showTip(e.originalEvent, `${tc(n.code)}\n${n.name || ""}`); });
  cy.on("mouseout", "node", hideTip);
}

function focusTable(code) {
  const n = cy.getElementById(code);
  if (!n.length) return;
  cy.elements().addClass("faded");
  n.closedNeighborhood().removeClass("faded");
  cy.animate({ fit: { eles: n.closedNeighborhood(), padding: 60 }, duration: 300 });
  const info = S.lineage.nodes.find((x) => x.code === code);
  const nb = n.connectedEdges().map((e) => ({ other: e.source().id() === code ? e.target().id() : e.source().id(), e })).sort((a, b) => b.e.data("rules").length - a.e.data("rules").length);
  $("#linside").innerHTML = `<h3>${esc(tc(code))}</h3><div class="sub">${esc(info?.name || "")}${info?.inModule ? "" : " · außerhalb von FINREP/AE"}</div>
    ${info?.inModule ? `<button class="lnk" id="opentab">Meldebogen öffnen</button>` : ""}
    <h4 style="margin:14px 0 6px">Verbunden mit ${nb.length} Meldebögen</h4>
    ${nb.map((x) => `<div class="nb" data-e="${x.e.id()}"><b>${esc(tc(x.other))}</b><span>${x.e.data("rules").length} Regel(n)</span></div>`).join("") || '<div class="hint">Keine tabellenübergreifenden Regeln.</div>'}`;
  $("#opentab")?.addEventListener("click", () => { setView("sheet"); openTable(code); });
  $$("#linside .nb").forEach((el) => el.onclick = () => showEdge(cy.getElementById(el.dataset.e)));
}

function showEdge(edge) {
  const a = edge.source().id(), b = edge.target().id();
  cy.elements().addClass("faded");
  edge.removeClass("faded"); edge.connectedNodes().removeClass("faded");
  cy.elements().unselect(); edge.select();
  const rs = edge.data("rules").map((id) => S.rules[id]).filter(Boolean);
  $("#linside").innerHTML = `<h3>${esc(tc(a))} ↔ ${esc(tc(b))}</h3><div class="sub">${rs.length} gemeinsame Validierungsregel(n)</div>
    ${rs.slice(0, 80).map((r) => ruleCard(r, null, Object.keys(r.sev)[0])).join("")}`;
  bindChips($("#linside"));
  $$("#linside [data-act=lineage]").forEach((btn) => btn.onclick = () => { S.linRule = +btn.dataset.rule; S.linMode = "cell"; renderLineage(); });
}

function cellLabel(cid) {
  const ci = S.ruleCells[cid];
  return ci ? `r${ci[1] || "–"} · c${ci[2] || "–"}${ci[3] ? " · s" + ci[3] : ""}` : String(cid);
}

function lineageCell() {
  const side = $("#linside");
  let center = S.sel && S.doc ? S.sel.id : null;
  let ruleIds;
  if (S.linRule) { ruleIds = [S.linRule]; }
  else if (center) { ruleIds = S.cellRules.get(center) || []; }
  else {
    $("#cy").innerHTML = "";
    $("#linhint").textContent = "";
    side.innerHTML = `<h3>Zell-Lineage</h3><div class="sub">Bitte zuerst im Meldebogen eine Zelle auswählen. Hier siehst du dann, über welche Regeln sie mit anderen Zellen und Meldebögen zusammenhängt.</div>`;
    return;
  }
  const depth2 = $("#lindepth").checked && !S.linRule;
  const els = new Map();
  const addTable = (t) => { if (!els.has("t:" + t)) els.set("t:" + t, { data: { id: "t:" + t, label: `${tc(t)}` }, classes: "cmp" }); };
  const addCell = (cid, cls = "") => {
    const ci = S.ruleCells[cid]; const t = ci ? ci[0] : (S.doc?.code || "?");
    addTable(t);
    if (!els.has("c:" + cid)) els.set("c:" + cid, { data: { id: "c:" + cid, label: cellLabel(cid), parent: "t:" + t, cid }, classes: "cell " + cls });
  };
  const edges = new Set();
  const addRule = (rid, from) => {
    const r = S.rules[rid]; if (!r) return;
    const sev = Object.values(r.sev).includes("error");
    if (!els.has("r:" + rid)) els.set("r:" + rid, { data: { id: "r:" + rid, label: r.code, color: sev ? COL.err : COL.warn, rid }, classes: "rule" });
    const byT = new Map();
    for (const c of r.cells) { const t = S.ruleCells[c]?.[0]; if (!byT.has(t)) byT.set(t, []); byT.get(t).push(c); }
    for (const [t, cs] of byT) {
      const others = cs.filter((c) => c !== center);
      if (others.length > 12) {
        addTable(t);
        const id = `a:${rid}:${t}`;
        els.set(id, { data: { id, label: `${others.length} weitere Zellen`, parent: "t:" + t }, classes: "agg" });
        edges.add(`r:${rid}|${id}`);
      } else for (const c of others) {
        addCell(c);
        edges.add(`r:${rid}|c:${c}`);
      }
    }
    if (from) edges.add(`${from}|r:${rid}`);
  };
  if (center) addCell(center, "cur");
  for (const rid of ruleIds) addRule(rid, center ? "c:" + center : null);
  if (depth2) {
    const firstCells = [...els.values()].filter((e) => e.data.cid && e.data.cid !== center).map((e) => e.data.cid);
    for (const c of firstCells.slice(0, 40)) for (const rid of (S.cellRules.get(c) || []).slice(0, 15)) if (!els.has("r:" + rid)) addRule(rid, "c:" + c);
  }
  const elements = [...els.values(), ...[...edges].map((k, i) => { const [s, t] = k.split("|"); return { data: { id: "x" + i, source: s, target: t, w: 1.2 }, classes: "cr" }; })];
  cy = cytoscape({ container: $("#cy"), style: cyStyle(), elements, wheelSensitivity: 0.25,
    layout: { name: "cose", animate: false, nodeRepulsion: 12000, idealEdgeLength: 70, nestingFactor: 0.9, gravity: 0.5, numIter: 1200, randomize: true } });
  const nr = [...els.keys()].filter((k) => k.startsWith("r:")).length, nt = [...els.keys()].filter((k) => k.startsWith("t:")).length;
  $("#linhint").textContent = `${nr} Regeln · ${nt} Meldebögen${els.size > 400 ? " · großer Graph – ggf. ohne 2. Ebene betrachten" : ""}`;
  const k = center ? cellCodes(S.doc, S.sel) : null;
  side.innerHTML = S.linRule ? `<h3>Regel ${esc(S.rules[S.linRule].code)}</h3><div class="sub">Alle Zellen, die diese Regel prüft – gruppiert nach Meldebogen.</div>${ruleCard(S.rules[S.linRule], null, Object.keys(S.rules[S.linRule].sev)[0])}`
    : `<h3>Zell-Lineage</h3><div class="sub">${esc(tc(S.doc.code))} · r${esc(k.r)} · c${esc(k.c)} – ${ruleIds.length} Regeln verbinden diese Zelle mit anderen Zellen.</div>
       <div class="legend"><span><i style="background:#fff3c4;border:1px solid #c79d00"></i>gewählte Zelle</span><span><i style="background:${COL.err}"></i>Regel (Fehler)</span><span><i style="background:${COL.warn}"></i>Regel (Warnung)</span><span><i style="background:#f4f6f9;border:1px solid #9fb3cc"></i>Meldebogen</span></div>
       <div class="hint">Regel (Raute) oder Zelle anklicken für Details. Doppelklick auf eine Zelle öffnet sie im Meldebogen.</div>`;
  bindChips(side);
  cy.on("tap", "node.rule", (e) => {
    const r = S.rules[e.target.data("rid")];
    side.innerHTML = ruleCard(r, k ? `${S.doc.code}|${k.r}|${k.c}` : null, Object.keys(r.sev)[0]);
    bindChips(side);
    $$("[data-act=lineage]", side).forEach((b) => b.onclick = () => { S.linRule = r.id; renderLineage(); });
  });
  cy.on("tap", "node.cell", async (e) => {
    const cid = e.target.data("cid"), ci = S.ruleCells[cid];
    if (!ci) return;
    let lbl = "";
    if (moduleOf(ci[0])) {
      const d = await loadDoc(ci[0]); const c = d.cById.get(cid);
      if (c) lbl = `<div class="kv" style="margin-top:8px"><div class="k">Zeile</div><div>${esc(hPath(d, c.r).map((h) => h.label).join(" › "))}</div><div class="k">Spalte</div><div>${esc(hPath(d, c.c).map((h) => h.label).join(" › "))}</div></div>`;
    }
    side.innerHTML = `<h3>${esc(tc(ci[0]))} · ${esc(cellLabel(cid))}</h3><div class="sub">${esc((S.lineage.nodes.find((x) => x.code === ci[0]) || {}).name || "")}</div>${lbl}
      <div style="margin-top:8px">${(S.cellRules.get(cid) || []).length} Regeln an dieser Zelle.</div>
      ${moduleOf(ci[0]) ? `<button class="lnk" id="opencell" style="margin-top:8px">Im Meldebogen öffnen</button>` : ""}`;
    $("#opencell")?.addEventListener("click", () => { setView("sheet"); openTable(ci[0], { r: ci[1], c: ci[2], s: ci[3] }); });
  });
  cy.on("dbltap", "node.cell", (e) => { const ci = S.ruleCells[e.target.data("cid")]; if (ci && moduleOf(ci[0])) { setView("sheet"); openTable(ci[0], { r: ci[1], c: ci[2], s: ci[3] }); } });
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
