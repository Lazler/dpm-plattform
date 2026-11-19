"""
Lokale Entwicklung: Daten bei Bedarf erzeugen und den DPM Explorer starten.

    python scripts/dev.py            # baut web/data, falls fehlend oder veraltet, und startet http://localhost:8000
    python scripts/dev.py --rebuild  # Daten immer neu erzeugen
    python scripts/dev.py --port 8080 --no-browser
"""
from __future__ import annotations

import argparse
import functools
import http.server
import os
import subprocess
import sys
import webbrowser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from build_data import latest_raw  # noqa: E402

RAW = latest_raw(os.path.join(ROOT, "data", "raw"))
WEB = os.path.join(ROOT, "web")
META = os.path.join(WEB, "data", "meta.json")


def newest(path):
    m = 0.0
    for d, _, files in os.walk(path):
        for f in files:
            m = max(m, os.path.getmtime(os.path.join(d, f)))
    return m


def needs_build():
    if not os.path.exists(META):
        return True
    src = max(newest(RAW), newest(os.path.join(ROOT, "scripts")), newest(os.path.join(ROOT, "data", "instructions")))
    return src > os.path.getmtime(META)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--rebuild", action="store_true")
    ap.add_argument("--no-browser", action="store_true")
    a = ap.parse_args()

    if a.rebuild or needs_build():
        try:
            import duckdb  # noqa: F401
        except ImportError:
            sys.exit("DuckDB fehlt. Bitte einmalig ausführen:  pip install -r requirements.txt")
        print("Erzeuge Daten aus", RAW, "…")
        subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "build_data.py"),
                        "--raw", RAW, "--out", os.path.join(WEB, "data")], check=True, cwd=ROOT)

    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=WEB)
    url = f"http://localhost:{a.port}"
    with http.server.ThreadingHTTPServer(("127.0.0.1", a.port), handler) as srv:
        print(f"DPM Explorer läuft auf {url}  (Beenden mit Strg+C)")
        if not a.no_browser:
            webbrowser.open(url)
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
