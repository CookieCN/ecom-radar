# Contributing to Amazon Competitor Radar

## Development Setup

### Prerequisites

- Node.js 20+
- npm 10+
- Git
- Windows: PowerShell 5+ (`.\init.ps1` for environment check)
- macOS/Linux: bash (`bash init.sh` for environment check)

### First-time Setup

```bash
git clone https://github.com/wilson-g/amazon-competitor-radar.git
cd amazon-competitor-radar
npm install        # installs dependencies + better-sqlite3 native addon
npx playwright install chromium  # downloads Chromium (~180 MB)
```

### Verify Your Environment

```powershell
.\init.ps1   # Windows
```

```bash
bash init.sh  # macOS / Linux / Git Bash
```

### Development Commands

```bash
npm run dev         # Electron + Vite HMR (hot reload)
npm test            # run all tests (vitest)
npm run test:watch  # watch mode
npm run lint        # ESLint
npm run lint:fix    # ESLint auto-fix
npm run format      # Prettier
npm run typecheck   # TypeScript check (node + web)
npm run build       # production build
npm run package:win # create Windows installer
```

## Project Workflow

### Agent-Based Development

This project is designed for AI agent (Claude Code) development. Key files:

| File | Purpose |
|---|---|
| `AGENTS.md` | Agent entry point — project rules, boundaries, harness location |
| `.harness/PRD.md` | Product requirements |
| `.harness/DEVELOPMENT_PLAN.md` | Phased development plan |
| `.harness/ACCEPTANCE.md` | Acceptance criteria per phase |
| `.harness/TECH_DECISIONS.md` | Architecture and technical decisions |
| `.harness/feature_list.json` | Feature completion tracking |
| `.harness/progress.md` | Development progress log |

### Before Development

Read in order:
1. `AGENTS.md`
2. `.harness/PRD.md`
3. `.harness/DEVELOPMENT_PLAN.md`
4. `.harness/ACCEPTANCE.md`
5. `.harness/TECH_DECISIONS.md`

### After Development

Every development round must:
1. Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`
2. Update `.harness/feature_list.json`
3. Update `.harness/progress.md`
4. If new patterns/failures/pitfalls discovered, update `.harness/experience.md`

### Handoff Format

Each round delivers:
- Files modified
- Features completed
- Verification commands run and results
- Acceptance items passed / not passed
- Harness files updated (yes/no)

## Code Standards

### TypeScript

- Strict mode enabled
- No `any` without explicit `// eslint-disable-next-line` justification
- IPC types defined in `src/shared/ipc.ts` — single source of truth for main, preload, and renderer

### Testing

- New modules require tests
- Repositories: CRUD unit tests with in-memory SQLite
- Parsers: HTML fixture tests
- Services: mock external dependencies (Playwright, IPC)
- PRs: all existing tests must pass

### Architecture Rules

- Main process: IPC handlers + database + scheduler + browser automation
- Preload: contextBridge only — no business logic
- Renderer: React components — call `window.api.*`, never access Node APIs directly
- Shared: types only — no runtime code
- Data flow: Renderer → IPC → Main → Repository → SQLite

## Compliance

- Never add anti-detection parameters to browser automation
- Never add CAPTCHA solving, proxy rotation, or IP pools
- Default monitoring frequency is low (hours, not minutes)
- When encountering CAPTCHA or blocks: stop, explain, do not retry

See `docs/browser-strategy.md` for the full policy.

## Questions?

Open an issue on GitHub.
