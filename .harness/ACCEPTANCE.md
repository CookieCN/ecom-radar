# Acceptance Criteria — Amazon Competitor Radar

## MVP Acceptance
- Windows 本地可启动。
- 用户可以添加 Amazon 商品 URL。
- 用户可以添加 ASIN + marketplace。
- 可以手动采集公开页面信息。
- 成功采集后可以保存历史 snapshot。
- 可以查看竞品列表。
- 可以查看竞品详情。
- 可以查看价格、评分、评论数趋势。
- 可以导出 CSV。
- 页面加载失败时 App 不崩溃。
- 出现验证码时停止任务并提示 `CAPTCHA_DETECTED`。
- 解析失败时显示明确错误。
- 所有数据保存在本地 SQLite。

## V1 Acceptance
- 支持每日 / 每 6 小时定时采集。
- 支持本地任务队列。
- 同一时间只执行一个采集任务。
- 支持变化提醒。
- 支持连续失败暂停。
- 支持采集日志查看。
- 支持手动采集兜底模式。
- 50 个 ASIN、每日一次采集场景下任务队列稳定执行。

## Quality Acceptance
- `npm test` 通过。
- `npm run lint` 通过。
- `npm run build` 通过。
- URL / ASIN parser 有单元测试。
- 商品页 parser 使用 HTML fixture 测试。
- SQLite migration 从空库可正常启动。
- Electron IPC 有基础集成测试。
- 打包后的 Windows App smoke test 通过。
- 不为了让代码跑起来而注释掉错误或跳过核心逻辑。

## Risk And Compliance Acceptance
- 不包含验证码破解能力。
- 不包含代理池能力。
- 不包含 IP 轮换能力。
- 不包含绕过登录、地区限制、付费墙的能力。
- 不包含高频批量抓取模式。
- README 和文档不宣传“突破 Amazon 风控”。
- 出现验证码、地区限制、页面风控时，必须失败可解释并停止自动重试。
- 默认监控频率低，不能默认并发批量访问。

## Handoff Acceptance
每轮开发完成后，开发 Agent 必须交付：
- 修改了哪些文件。
- 完成了哪些功能。
- 跑了哪些验证命令。
- 哪些验收项通过。
- 哪些验收项未通过。
- 是否更新 `.harness/feature_list.json` 和 `.harness/progress.md`。

## Review Loop
Wilson 会让验收 Agent 检查交付。验收失败时：
1. 验收 Agent 输出问题清单。
2. Wilson 把反馈交给开发 Agent 修改。
3. 开发 Agent 修改后再次提交。
4. 验收 Agent 重新检查。
5. 循环直到 MVP / V1 验收通过。

