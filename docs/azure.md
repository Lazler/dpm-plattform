# DPM Explorer in Azure – kostengünstiger Betrieb

Stand: November 2026. Preise sind Richtwerte nach bestem Wissen – vor der Bestellung im
[Azure-Preisrechner](https://azure.microsoft.com/pricing/calculator/) für die eigene Region prüfen.

## Grundidee

Der Explorer ist eine **statische Web-App**: HTML, JavaScript und vorberechnete JSON-Daten. Es läuft kein
Server und keine Datenbank, solange nur gelesen wird. Das ist die günstigste und sicherste Betriebsform,
und genau dafür gibt es **Azure Static Web Apps (SWA)**.

```
GitHub (main) ──► GitHub Actions: Tests · Daten erzeugen (build_data.py) ──► Azure Static Web Apps
                                                                            │  Login: Microsoft Entra ID
                                                                            ▼
                                                                   Browser der Nutzer
```

## Stufe 1 – jetzt: nur lesen (0–9 € pro Monat)

| Baustein | Dienst | Kosten (Richtwert) |
|---|---|---|
| Web-App + Daten (~50 MB) | Azure Static Web Apps **Free** | 0 € |
| … mit Login nur für den eigenen Entra-Tenant, SLA | Azure Static Web Apps **Standard** | ca. 9 $ je App und Monat |
| Build & Deployment | GitHub Actions | im GitHub-Kontingent enthalten |
| Datenübertragung | im SWA-Plan enthalten (Free: 100 GB/Monat) | 0 € |

**Login:** Die Konfiguration `web/staticwebapp.config.json` lässt nur angemeldete Nutzer zu und leitet auf die
Microsoft-Anmeldung (Entra ID) um.

- **Free-Plan:** Jede Person mit Microsoft-/Entra-Konto kann sich anmelden. Für eine geschlossene Gruppe
  vergebt ihr Rollen per Einladung (SWA-Portal → *Rollenverwaltung*) und tragt statt `authenticated`
  die eigene Rolle (z. B. `dpm`) unter `allowedRoles` ein.
- **Standard-Plan (empfohlen für den Firmeneinsatz):** eigene App-Registrierung in Entra ID, die nur euren
  Tenant zulässt. Das ist die sauberste Lösung für ca. 9 $ im Monat.

**Einrichtung (einmalig, ca. 15 Minuten):**

1. Azure-Portal → *Static Web App erstellen* → Plan wählen → Bereitstellungsquelle **„Andere“**.
2. In der neuen App: *Bereitstellungstoken verwalten* → Token kopieren.
3. GitHub-Repo → *Settings → Secrets and variables → Actions* → Secret `AZURE_STATIC_WEB_APPS_API_TOKEN` anlegen.
4. Auf `main` mergen oder den Workflow *Deploy – Azure Static Web Apps* manuell starten.

Die Daten sind öffentliche EBA-Daten. Klärt trotzdem mit eurer internen Cloud-Governance, in welcher
Subscription und Region die App laufen darf.

## Stufe 2 – Upload, Admin-Bereich, eigene Inhalte (ca. 10–40 € pro Monat)

| Baustein | Dienst | Warum günstig |
|---|---|---|
| Upload & Ablage der Releases (Access/Parquet) | Azure Blob Storage | wenige GB, Centbeträge |
| Aufbereitung beim neuen Release | GitHub Actions oder Azure Functions (Flex Consumption) | läuft nur bei Bedarf |
| Eigene Inhalte (Instructions, Mappings, Kommentare) | Azure SQL Database **serverless** mit Auto-Pause bzw. das kostenlose Angebot für kleine Datenbanken | zahlt nur, wenn genutzt |
| API für die Web-App | SWA-eigene Functions (Standard-Plan) oder Azure Functions | Verbrauchsabrechnung, Freikontingent |
| Monitoring | Application Insights | geringe Datenmengen |

Für Azure SQL nutzt ihr bereits eine Datenbank. Dort könnten die eigenen Inhalte als weiteres Schema liegen.

## Stufe 3 – MCP-Server und KI (verbrauchsabhängig)

| Baustein | Dienst | Kosten |
|---|---|---|
| MCP-Server / REST-API | Azure Container Apps (Consumption, skaliert auf null) oder Azure Functions | im Freikontingent bis zu mittlerer Nutzung |
| KI für Instructions-Import, Release-Notes, Fragen | Azure OpenAI / Azure AI Foundry (Abrechnung pro Token) | pro Release-Import grob im ein- bis niedrigen zweistelligen Euro-Bereich; Chat-Nutzung nach Volumen |
| Suche in Instructions (optional) | Azure AI Search Free-Tarif oder Volltext in SQL | 0 € bis Basic-Tarif |

## Empfehlungen

- **Jetzt:** Static Web Apps Free zum Ausprobieren, für den echten Einsatz Standard mit Tenant-Login.
- **Rohdaten:** Jeder neue DPM-Export bringt gut 110 MB Parquet. Mittelfristig gehören sie nach Blob Storage
  (oder Git LFS) statt in die Git-Historie. Der Workflow lädt sie dann beim Build.
- **Keine Dauer-Server**, solange es nicht nötig ist: Alles, was sich vorberechnen lässt, wird beim Deployment
  erzeugt. Das hält Kosten und Angriffsfläche klein.
- **Eine Codebasis:** Parser, Verbalisierung und Release-Vergleich (`scripts/`) werden später unverändert
  von API und MCP-Server genutzt.
