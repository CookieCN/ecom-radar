# Amazon Competitor Radar — Agent Entry

## Working Language
默认使用中文沟通。代码、命令、变量名使用英文。

## Project Goal
这是一个面向普通用户的本地桌面 App，用本地浏览器监控 Amazon 竞品公开页面信息，包括价格、评分、评论数、库存状态、标题和图片等变化。

## Product Boundaries
- 不接外部 API。
- 不接 LLM。
- 不做云端服务。
- 不做验证码破解、代理池、IP 轮换、绕过登录或高频批量抓取。
- 不采集非公开、登录后、付费墙后或需要权限的数据。
- 遇到验证码、地区限制、页面风控时，必须停止自动任务并给出明确提示。

## Required Reading Before Development
开发前必须先读：
- `.harness/PRD.md`
- `.harness/DEVELOPMENT_PLAN.md`
- `.harness/ACCEPTANCE.md`
- `.harness/TECH_DECISIONS.md`

## Development Rules
- 每次开发结束必须更新 `.harness/progress.md` 和 `.harness/feature_list.json`。
- 遇到坑、风控变化、页面结构变化、工具链问题，必须记录到 `.harness/experience.md`。
- 架构或技术决策变化，必须更新 `.harness/TECH_DECISIONS.md`。
- 大功能或版本变化，必须更新 `.harness/CHANGELOG.md`。
- 交付前必须跑项目已有的 test / lint / build 命令；如果命令还不存在，要在交付说明里明确。
- Windows 环境检查优先使用 `.\init.ps1`；Git Bash/WSL/macOS/Linux 可使用 `bash init.sh`。

## Acceptance Flow
Wilson 会让开发 Agent 完成功能，再让验收 Agent 检查。验收失败时，验收 Agent 输出反馈意见，Wilson 再交给开发 Agent 修改，循环直到通过。

开发 Agent 每轮交付必须说明：
- 修改了哪些文件。
- 完成了哪些功能。
- 跑了哪些验证命令。
- 哪些验收项通过。
- 哪些验收项未通过。
- 是否更新 `.harness/feature_list.json` 和 `.harness/progress.md`。

## Harness Files
所有 Harness 管理文档集中在 `.harness/`：

| 场景 | 文件 |
|---|---|
| 产品需求 | `.harness/PRD.md` |
| 开发计划 | `.harness/DEVELOPMENT_PLAN.md` |
| 验收标准 | `.harness/ACCEPTANCE.md` |
| 技术决策 | `.harness/TECH_DECISIONS.md` |
| 功能状态 | `.harness/feature_list.json` |
| 开发进度 | `.harness/progress.md` |
| 踩坑记录 | `.harness/experience.md` |
| 版本变更 | `.harness/CHANGELOG.md` |
