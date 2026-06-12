# Development Experience Log

> 记录每次踩坑的完整链路：Problem -> Root Cause -> Solution -> Rule。
> 格式：`## N. 标题`，然后写 `Problem` / `Root Cause` / `Solution` / `Rule`。

## 1. Harness 目录与入口文件边界

**Problem**
项目需要根目录 `AGENTS.md` 作为 Agent 入口，同时 Wilson 要求 Harness 文件统一放入 `.harness/`。

**Root Cause**
常见 Harness 模板会把管理文档放在 `.Codex/`，但本项目为了后续开源和多 Agent 协作，需要更中性的 `.harness/` 目录。

**Solution**
根目录只保留 `AGENTS.md` 作为入口规则，PRD、开发计划、验收标准、技术决策、进度和踩坑记录统一放进 `.harness/`。

**Rule**
后续 Agent 不要新建 `.Codex/` 目录；所有 Harness 管理文档继续维护 `.harness/`。

## 2. Windows 环境不一定能运行 bash

**Problem**
在当前 Windows 环境运行 `bash init.sh` 时失败，系统提示没有可用的 WSL 默认发行版。

**Root Cause**
Windows 上 `bash` 可能指向 WSL，而 WSL 未安装发行版；不能假设所有普通用户都有 Git Bash 或 WSL。

**Solution**
保留 `init.sh` 给 Git Bash/WSL/macOS/Linux，同时新增 `init.ps1` 作为 Windows 原生环境检查入口。

**Rule**
面向 Windows 普通用户的项目必须提供 PowerShell 入口；后续 README 和验收说明都应优先给 Windows 命令。

## 3. Git dubious ownership in sandbox

**Problem**
`git status` 在当前环境失败，提示 repository has dubious ownership。

**Root Cause**
工作目录属于 Windows 用户 `w`，但命令由 `CodexSandboxOffline` 用户执行，Git 的安全机制拒绝直接读取仓库状态。

**Solution**
验证时使用单次命令参数：`git -c safe.directory="F:/programming projects/agents 2026/ecom radar" status --short`。不要为了省事直接改全局 Git 配置。

**Rule**
遇到 Git dubious ownership 时，优先使用单次 `-c safe.directory=...`；只有 Wilson 明确同意时才修改全局 Git 配置。

## 4. better-sqlite3 ABI mismatch after electron-builder

**Problem**
`npm run package:win` 之后，`npm test` 失败，所有 SQLite 测试报 `NODE_MODULE_VERSION 130` vs `127` 不匹配。

**Root Cause**
electron-builder 自带 `@electron/rebuild`，会在打包前把 `better-sqlite3` native addon 重新编译为 Electron ABI (v130)。但这之后 `npm test` 用的是系统 Node (v127)，两套 ABI 不兼容。

**Solution**
`package.json` 的 `package:win` 尾部加 `&& npm run rebuild:node`，打包后自动 `npm rebuild better-sqlite3` 恢复系统 Node ABI。新增独立脚本 `rebuild:node` 便于手动调用。

**Rule**
任何依赖 native addon 的 Electron 项目，打包脚本尾部必须加 rebuild step。验证：`npm run package:win && npm test` 必须两次都通过。

## 5. Playwright Chromium must be bundled with the packaged app

**Problem**
打包后的 Electron 应用没有 Playwright Chromium 浏览器。开发环境用的是 `%LOCALAPPDATA%\ms-playwright\` 缓存目录，但 `electron-builder` 默认不会把这个目录打包进去。用户安装后启动采集时报 "browser executable not found"。

**Root Cause**
`chromium.launch()` 查找浏览器在 `PLAYWRIGHT_BROWSERS_PATH` 或默认缓存目录，打包后的 app 既没有这个目录，也不能假设用户本机有 Node/npm/npx 来运行 `npx playwright install chromium`。

**Solution**
- 创建 `scripts/bundle-playwright.mjs`：打包前从本机 Playwright 缓存复制 chromium 到 `resources/playwright-browsers/`
- `electron-builder.yml` 配置 `extraResources` 将 `resources/playwright-browsers/` 打包进安装包
- `src/capture/browser.ts`：`setBrowsersPath()` 在 packaged 模式指向 `process.resourcesPath/playwright-browsers`，dev 模式不用设置
- `main/index.ts`：`app.isPackaged` 判断用哪个路径

**Rule**
Electron 打包项目里，任何独立可执行文件或二进制资源（如 Playwright Chromium）必须通过 `extraResources` 随包分发。不要在 `README` 承诺"首次启动自动下载"除非代码里有不依赖 Node/npm 的实现。

## 6. NSIS cache permission issue in sandbox

**Problem**
electron-builder 打包 NSIS 安装包时报 `EPERM: operation not permitted`，卡在 `C:\Users\w\AppData\Local\electron-builder\Cache\nsis`。

**Root Cause**
沙箱用户对当前用户的 `AppData\Local` 目录没有写权限（不同 SID）。electron-builder 需要在该目录缓存 NSIS 和 winCodeSign 工具。

**Solution**
- 清理缓存：`rm -rf ~/AppData/Local/electron-builder/Cache/nsis`
- `electron-builder.yml` 关闭代码签名：`sign: null` + `signAndEditExecutable: false`
- 重新运行 `npx electron-builder --win` 缓存成功写入

**Rule**
Windows 沙箱环境打包 Electron 应用时，必须先清理 `electron-builder/Cache` 并关闭代码签名。如果仍然 permission denied，需要 Wilson 提权后再跑。
