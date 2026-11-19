// Rauchtest der Oberfläche: startet einen lokalen Server, öffnet alle Ansichten und prüft auf JS-Fehler.
//   node tests/smoke.cjs            (erwartet erzeugte Daten in web/data)
// Benötigt Playwright (npm i playwright && npx playwright install chromium).
const { spawn } = require("child_process");
const path = require("path");
const { chromium } = require("playwright");

const PORT = 8799;
const web = path.join(__dirname, "..", "web");

(async () => {
  const srv = spawn(process.platform === "win32" ? "python" : "python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: web, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 1200));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  const base = `http://127.0.0.1:${PORT}/`;
  const step = async (name, fn) => { try { await fn(); console.log("ok  ", name); } catch (e) { errors.push(`${name}: ${e.message.split("\n")[0]}`); console.log("FAIL", name); } };
  try {
    await step("Startseite", async () => { await page.goto(base); await page.waitForSelector(".card", { timeout: 20000 }); });
    await step("Meldebogen + Zelle", async () => {
      await page.goto(base + "#/F_01.01?r=0110&c=0010");
      await page.waitForSelector("td.d.sel", { timeout: 20000 });
      const n = await page.$$eval("#dbody .sec", (x) => x.length);
      if (!n) throw new Error("Detailpanel leer");
    });
    await step("Regeln-Reiter", async () => { await page.click("#dtabs button[data-t=rules]"); await page.waitForSelector(".rrow"); });
    await step("Tastatur", async () => { await page.keyboard.press("ArrowDown"); await page.waitForTimeout(200); });
    await step("Release-Vergleich", async () => { await page.selectOption("#cmpsel", "4.0"); await page.waitForSelector("#cmpbar:not([hidden])"); });
    for (const v of ["lineage", "dp", "hier", "model", "start"]) {
      await step("Ansicht " + v, async () => { await page.click(`#views button[data-view=${v}]`); await page.waitForTimeout(800); });
    }
    await step("AE-Bogen", async () => { await page.goto(base + "#/F_32.01"); await page.waitForSelector("table.xl", { timeout: 20000 }); });
  } finally {
    await browser.close();
    srv.kill();
  }
  if (errors.length) { console.error("\nFehler:\n" + errors.join("\n")); process.exit(1); }
  console.log("\nRauchtest bestanden.");
})();
