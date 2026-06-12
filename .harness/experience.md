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
