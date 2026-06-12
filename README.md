# Amazon Competitor Radar

A local desktop app for monitoring public Amazon competitor product pages — price, rating, review count, availability, and more.

**Not a scraping tool.** Amazon Competitor Radar uses your own browser, at low frequency, to visit public product pages you already have access to. It does not bypass CAPTCHAs, rotate IPs, or scrape behind logins.

## Features

- **Add competitors** — Paste an Amazon URL or ASIN, and the app extracts the product info automatically
- **Automatic monitoring** — Schedule captures every 6 hours or daily, with random delays to avoid hammering Amazon
- **Trend charts** — Price, rating, and review count over time (7D / 30D / All)
- **Change alerts** — Get notified when prices change, ratings drop, reviews spike, or availability flips
- **CSV export** — Export data for a single competitor or all competitors, with UTF-8 BOM for Excel
- **Manual fallback** — When automatic capture hits a CAPTCHA, switch to manual data entry
- **100% local** — All data stored in SQLite on your machine. No cloud, no accounts, no external APIs.

## Screenshots

<!-- TODO: add screenshots after first release build -->
<!-- ![](docs/screenshots/dashboard.png) -->

## Installation

### Prerequisites

- **Windows 10/11**, macOS, or Linux
- **Node.js 20+** ([nodejs.org](https://nodejs.org))
- **Git** (optional, for source install)

### Download (recommended)

Download the installer from [Releases](https://github.com/wilson-g/amazon-competitor-radar/releases).

Run the `.exe` (Windows), `.dmg` (macOS), or `.AppImage` (Linux) and follow the installer prompts.

### Build from source

```bash
git clone https://github.com/wilson-g/amazon-competitor-radar.git
cd amazon-competitor-radar
npm install
npm run dev        # start in development mode
npm run build      # build for production
npm run package:win  # create Windows installer
```

On first launch, the app downloads Chromium for Playwright (~180 MB, one-time).

## Usage

1. **Add a competitor** — Paste an Amazon URL (e.g. `https://www.amazon.com/dp/B09N3YBZ7D`) or a bare ASIN (`B09N3YBZ7D`) into the input field and click "Add & Capture"
2. **View the dashboard** — See all competitors with latest price, rating, status, and last capture time
3. **Drill into details** — Click ▶ to see trend charts and snapshot history
4. **Set monitoring frequency** — Choose "Every 6h" or "Daily" in the competitor detail page
5. **Check alerts** — The Alerts tab shows price changes, rating drops, and review growth
6. **Export data** — Use "Export CSV" for analysis in Excel or other tools

The app automatically monitors active competitors. If automatic capture encounters a CAPTCHA or blocks, the app will pause that competitor and show a manual capture form.

## Compliance And Boundaries

This project is designed for **legitimate, low-frequency monitoring of public Amazon product pages** from your own computer.

**What it does:**
- Visit public product pages you can already access in your browser
- Record changes at low frequency (hours, not seconds)
- Stop and explain when it encounters CAPTCHAs or blocks

**What it does NOT do:**
- CAPTCHA solving or bypass
- IP rotation, proxy pools, or VPN chaining
- Login-bypass or authenticated-only page access
- High-frequency or concurrent bulk scraping
- Any form of "anti-detection" or stealth modification

If you need a scraping tool, this is not the project for you.

See [`docs/browser-strategy.md`](docs/browser-strategy.md) for the full technical breakdown of our approach to browser automation.

## Project Structure

```
src/
  main/          Electron main process + IPC handlers
  preload/       contextBridge API surface
  renderer/      React UI (dashboard, detail, alerts, system)
  shared/        IPC channel names and response types
  data/          SQLite database, migrations, repositories
  capture/       URL parser, Playwright browser controller, page parser
  scheduler/     Local task scheduler with queue and random delays
  alerts/        Alert rule engine (price/rating/reviews/availability)
.harness/        Project management docs (PRD, dev plan, acceptance criteria)
docs/            Browser strategy document
```

## Development

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development setup, workflow, and contribution guidelines.

Quick start:

```bash
npm install
npm run dev        # Electron + Vite HMR
npm test           # 179 tests
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run build      # Production build
```

## Tech Stack

- **Desktop:** Electron
- **Frontend:** React + TypeScript + Vite
- **Charts:** Recharts
- **Browser automation:** Playwright (Chromium)
- **Database:** SQLite (better-sqlite3)
- **Testing:** Vitest + Testing Library
- **Packaging:** electron-builder

## License

MIT — see [LICENSE](LICENSE). Use responsibly and respect Amazon's Terms of Service.
