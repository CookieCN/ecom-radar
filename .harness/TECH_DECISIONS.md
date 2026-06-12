# Technical Decisions — Amazon Competitor Radar

## 1. Use Electron For Desktop
决策：第一版使用 Electron。

原因：
- 普通用户可以通过安装包使用，不需要命令行环境。
- Electron 与 React / TypeScript / Node 生态结合顺畅。
- 本地文件、SQLite、浏览器自动化、系统通知等能力容易集成。

用户影响：
- 安装和启动更接近普通软件。
- 未来 Windows 打包路径清晰。

## 2. Use React + TypeScript
决策：前端使用 React + TypeScript。

原因：
- React 生态成熟，适合 dashboard、列表、详情页、图表。
- TypeScript 能约束 IPC、数据模型和解析结果，降低后续 Agent 接手成本。

用户影响：
- UI 迭代快。
- 未来开源贡献者更容易理解和维护。

## 3. Use Playwright As Primary Browser Automation
决策：MVP 主采集方案使用 Playwright。

原因：
- Playwright 对现代网页自动化、等待、超时、测试和跨浏览器支持成熟。
- 同一套能力可用于采集和端到端测试。
- TypeScript 集成成本低。

风险：
- Amazon 可能识别自动化环境。
- 不保证所有站点、地区、网络环境都稳定成功。

用户影响：
- 第一版能更快打通本地采集闭环。
- 采集失败时必须有可读错误和兜底方案。

## 3.1 Playwright Runs Without Stealth / Anti-Detection Modifications

决策：Playwright 以默认模式运行，不添加任何 stealth、anti-detection 或自动化规避参数。

原因：
- 项目边界明确不做“绕过风控能力”。`--disable-blink-features=AutomationControlled`、stealth.js、修改 navigator.webdriver 等手段属于规避平台自动化检测，与合规边界冲突。
- 产品定位是低频本地监控，不是隐蔽采集。失败了应该可解释、可降级，而不是加对抗层。
- 开源项目需要干净的合规姿态。

用户影响：
- 采集成功率可能低于加 stealth 的方案。
- 失败时会给出明确错误类型（CAPTCHA_DETECTED / PAGE_LOAD_FAILED 等），并停止自动重试。
- 产品倾向“诚实失败”而非“不可靠成功”。

## 4. Keep CDP, Extension, And Manual Capture As Fallbacks
决策：必须保留 Chrome DevTools Protocol、浏览器扩展、半自动采集作为备选路线。

原因：
- Playwright 不是长期唯一答案。
- CDP 直连用户本机 Chrome 可能更接近真实使用环境。
- 浏览器扩展更适合用户主动采集当前页面。
- 半自动采集能在风控场景下保留产品价值。

用户影响：
- 自动采集失败时，产品不会完全不可用。
- 后续可以从“全自动低频”平滑降级到“用户确认后采集”。

## 5. Use SQLite For Local Data
决策：使用 SQLite 保存竞品、snapshot、任务、提醒和设置。

原因：
- 零服务依赖，适合本地桌面 App。
- 数据保存在用户电脑，隐私边界清楚。
- 对几十个 ASIN 到轻量团队规模足够。

用户影响：
- 无需配置数据库。
- App 重启后数据保留。
- 数据迁移和导出可控。

## 6. Do Not Build "Bypass Amazon Risk Control" Features
决策：不做验证码破解、代理池、IP 轮换、绕过登录、高频批量抓取。

原因：
- 项目未来要开源，合规边界必须清楚。
- 这些能力会把产品从“本地监控公开信息”推向“规避平台限制的采集工具”。
- 长期来看，稳定、低频、失败可解释、人工可接管更适合普通用户产品。

用户影响：
- 产品不会承诺不现实的采集成功率。
- 遇到验证码或风控时会停止并提示，而不是盲目重试。

