# Progress — 2026-06-12

## Current Phase
全部 10 个 Phase 完成。MVP + V1 功能交付完毕。

## Next Step
验收 Agent 检查。Wilson 进行 smoke test 和最终验收。

## Recently Completed
- [x] Harness 初始化（Phase 0）
- [x] Electron + Vite + React + TypeScript 项目骨架（Phase 1）
- [x] SQLite 与领域模型（Phase 2）
- [x] Amazon URL / ASIN Parser（Phase 3）
- [x] Playwright Single Product Capture（Phase 4）
  - [x] Playwright + Chromium 安装
  - [x] Browser controller（启动/导航/超时/路由拦截/资源屏蔽）
  - [x] Page parser（JSON-LD → Meta → DOM 三级回退）
  - [x] Captcha 检测（关键词 + URL + form 模式）
  - [x] Product not found 检测（Dog page）
  - [x] Region block 检测
  - [x] Capture service（输入 → 解析 → 浏览器 → parser → snapshot → DB）
  - [x] IPC 集成（capture:run → main process → 自动 find-or-create competitor + save snapshot）
  - [x] 8 个 HTML fixture 覆盖 JSON-LD/@graph/meta/DOM/out-of-stock/captcha/404/minimal
  - [x] 18 个 page parser 测试 + 44 个 URL parser 测试
  - [x] 总计 125 个测试全部通过

## Known Risks
- Amazon 页面结构会变化，parser 必须有 fixture 测试。
- Amazon 可能出现验证码或风控页面，自动采集必须停止并提示。
- 开源合规边界必须清楚。
- Playwright 可能不是长期唯一方案。
- `better-sqlite3` 有 native addon，`npm run package:win` 会触发 @electron/rebuild 将 ABI 切到 Electron。`package:win` 尾部已加 `npm run rebuild:node` 恢复 Node ABI。
- 当前机器没有可用 WSL 默认发行版，Windows 环境检查应优先运行 `.\init.ps1`。

## Quality Gates (as of 2026-06-12)
| Gate | Result |
|---|---|
| `npm test` | 179 passed, 15 files |
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | node + web OK |
| `npm run build` | electron-vite OK |
| `npm run package:win` | NSIS installer 217 MB (含 Playwright Chromium) |
| smoke test (`tests/smoke/smoke-test.mjs`) | 16/16 passed |
| Chromium bundled (`extraResources`) | chrome-win64 verified |
| `.claude/` in `.gitignore` | confirmed |

## Milestones
| Date | Milestone |
|---|---|
| 2026-06-12 | Harness and planning documents initialized |
| 2026-06-12 | Electron + React + TypeScript skeleton with IPC health check |
| 2026-06-12 | SQLite database + migration + 5 repositories (63 tests) |
| 2026-06-12 | Amazon URL / ASIN parser (44 tests, 12 marketplaces) |
| 2026-06-12 | Playwright capture: browser + parser + captcha detection (125 tests) |
| 2026-06-12 | Phase 4 acceptance fixes: stealth removal, failed capture logging, API semantics, tests (144 tests) |
| 2026-06-12 | Phase 5: Competitor list + detail UI, 4 new IPC channels, 153 tests |
| 2026-06-12 | Phase 6: Trend charts (recharts) + CSV export (single/all, BOM for Excel), 161 tests |
| 2026-06-12 | Phase 7: Local scheduler + task queue + sequential execution + random delays + auto-pause, 168 tests |
| 2026-06-12 | Phase 8: Alert engine (price/rating/reviews/availability) + AlertsPanel UI + dedup, 179 tests |
| 2026-06-12 | Phase 9: Browser strategy doc + manual capture fallback mode, 179 tests |
| 2026-06-12 | Phase 10: README/CONTRIBUTING/issue templates/License, Windows packaging (89 MB) |
| 2026-06-12 | Phase 10 fix: Playwright Chromium bundled via extraResources (217 MB), smoke test 16/16, .claude/ gitignored |
| 2026-06-12 | Phase 10 fix: rebuild:node script, datetime SQLite compat, frequency selector UI |
| 2026-06-12 | Repository pushed to https://github.com/CookieCN/ecom-radar |
