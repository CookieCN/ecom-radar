# Development Plan — Amazon Competitor Radar

## Phase 0 — Harness And Open Source Basics
目标：建立后续 Agent 可持续开发、验收和反馈的基础环境。

任务：
- 创建根目录 `AGENTS.md`。
- 创建 `Codex.me`。
- 创建 `.harness/` 全套文档。
- 创建 `README.md`、`.gitignore`、`init.sh`、`init.ps1`。
- 初始化 Git 仓库。

验收：
- 新 Agent 能通过 `AGENTS.md` 知道项目目标、边界和 Harness 位置。
- `.harness/` 能说明 PRD、开发计划、验收标准、技术决策、进度和踩坑记录。
- Windows 可使用 `.\init.ps1` 做环境检查；Git Bash/WSL/macOS/Linux 可使用 `bash init.sh`。

## Phase 1 — Electron + React + TypeScript Skeleton
目标：App 可以启动，有主进程、preload、renderer 和基础 IPC。

任务：
- 初始化 Electron + Vite + React + TypeScript。
- 建立 `src/main`、`src/preload`、`src/renderer`、`src/shared`、`src/capture`。
- 配置 ESLint、Prettier、Vitest。
- 配置 `npm run dev`、`npm test`、`npm run lint`、`npm run build`。
- 配置 electron-builder。
- 实现 IPC health check。

验收：
- `npm run dev` 可以启动桌面 App。
- `npm test`、`npm run lint`、`npm run build` 可运行。
- Renderer 能通过 IPC 调用 main process health check。

## Phase 2 — SQLite And Domain Model
目标：本地数据能可靠保存。

任务：
- 接入 SQLite。
- 建立 migration。
- 实现 `competitors`、`snapshots`、`monitor_jobs`、`alerts`、`settings`。
- 实现 repository 层。
- 实现基础 CRUD 测试。

验收：
- 空数据库首次启动自动创建表。
- App 重启后数据保留。
- CRUD 单元测试通过。

## Phase 3 — Amazon URL / ASIN Parser
目标：用户输入能标准化为可采集对象。

任务：
- 实现 Amazon URL parser。
- 支持常见域名：`amazon.com`、`amazon.co.uk`、`amazon.de`、`amazon.co.jp`。
- 支持 ASIN 直接输入。
- 输出 `asin`、`marketplace`、`url`。
- 对错误输入返回可读错误。

验收：
- 正常 URL 可解析。
- 非 Amazon URL 被拒绝。
- 无 ASIN URL 给出明确错误。
- 单元测试覆盖主流 URL 格式。

## Phase 4 — Playwright Single Product Capture
目标：打通单商品采集闭环。

任务：
- 实现 browser controller。
- 实现页面加载、超时、错误捕获。
- 实现 parser：JSON-LD、meta、DOM fallback。
- 输出标准 snapshot。
- 保存 snapshot 到 SQLite。
- 记录 capture log。

验收：
- 输入一个商品 URL，可以手动采集并保存。
- 至少能拿到标题、价格、评分、评论数中的 3 项。
- 页面失败时返回明确错误。
- 出现验证码时识别为 `CAPTCHA_DETECTED`，并停止任务。

## Phase 5 — Competitor List And Detail
目标：用户能看见数据。

任务：
- 实现添加竞品页面。
- 实现竞品列表。
- 实现手动刷新按钮。
- 实现详情页。
- 展示最新 snapshot。
- 展示错误状态。

验收：
- 用户能走通：添加 URL -> 采集 -> 查看列表 -> 查看详情。
- App 重启后数据仍可见。
- 失败状态用户能看懂。

## Phase 6 — Trend Charts And CSV Export
目标：让监控结果有分析价值。

任务：
- 实现价格趋势图。
- 实现评分趋势图。
- 实现评论数趋势图。
- 实现 7 天 / 30 天 / 全部时间切换。
- 实现 CSV 导出。

验收：
- 空数据、单条数据、多条数据都能正常显示。
- CSV 可用 Excel 打开。
- 中文、货币符号、空值不乱码。

## Phase 7 — Local Scheduler And Queue
目标：从手动工具变成监控工具。

任务：
- 实现本地 scheduler。
- 实现任务队列。
- 实现每日 / 每 6 小时采集。
- 实现低频随机访问间隔。
- 实现连续失败计数。
- 实现失败暂停策略。

验收：
- 50 个 ASIN 每日采集可以稳定排队。
- 同一时间不会并发打开多个采集浏览器。
- 连续失败 3 次自动暂停。
- 用户可手动恢复。

## Phase 8 — Alerts
目标：让用户不用每天盯面板。

任务：
- 实现提醒规则引擎。
- 实现价格变化提醒。
- 实现评论数增长提醒。
- 实现评分下降提醒。
- 实现库存变化提醒。
- 实现提醒列表和已读状态。

验收：
- 新 snapshot 与上一条 snapshot 对比后能生成提醒。
- 提醒不会重复刷屏。
- 用户能标记已读。

## Phase 9 — Browser Use Fallback Validation
目标：避免 Playwright 一条路走死。

任务：
- 写 `docs/browser-strategy.md`。
- 做 CDP 直连 Chrome 技术 spike。
- 设计浏览器扩展 + Native Messaging 方案。
- 实现手动采集兜底模式。
- 明确从 Playwright 切换或降级的条件。

验收：
- Playwright 采集失败时，产品至少提供手动采集模式。
- 文档清楚说明 CDP、Extension、半自动模式的优缺点。
- 不实现验证码破解、代理池或高风险绕过能力。

## Phase 10 — Open Source Release Preparation
目标：项目可以安全放到 GitHub。

任务：
- 完善 README。
- 完善合规说明。
- 完善用户安装说明。
- 添加贡献指南。
- 添加 issue template。
- 打包 Windows 安装包。
- 完成 smoke test。

验收：
- 新用户能按 README 启动项目。
- 开源仓库不包含密钥、token、代理配置。
- 文档不宣传“绕过风控”。
- Windows App 可安装、启动、添加竞品、采集、查看趋势。

## Required Development Order
开发 Agent 按阶段顺序执行，不要跳阶段。每轮开发完成后，必须更新 `.harness/feature_list.json` 和 `.harness/progress.md`。
