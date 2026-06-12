# PRD — Amazon Competitor Radar

## 1. Product Positioning
Amazon Competitor Radar 是一个给普通用户使用的本地桌面 App。用户添加 Amazon 商品 URL 或 ASIN 后，App 使用本地浏览器访问公开商品页，低频记录价格、评分、评论数、库存状态等变化，并在本地展示趋势、提醒和导出数据。

第一版不做云服务、不接外部 API、不接 LLM。产品可以处理 Amazon 风控带来的失败，但不能把核心能力建立在验证码破解、代理池、IP 轮换、绕过登录或高频抓取上。

## 2. Users
目标用户：
- Amazon 卖家、运营、选品人员。
- 做跨境电商内容的自媒体博主。
- 小团队或个人操盘手。
- 非程序员，能安装桌面软件，但不应被要求配置复杂爬虫环境。

用户关心：
- 竞品有没有降价。
- 竞品评论增长快不快。
- 评分是否下降。
- 是否缺货或恢复有货。
- 能否导出数据做周报、复盘或内容选题。

## 3. Core Scenarios
- 添加 10-50 个竞品 ASIN，定期查看变化。
- 每天或每 6 小时低频采集公开商品页。
- 打开 Dashboard 看今日采集成功、失败、提醒。
- 查看某个竞品的价格、评分、评论数历史趋势。
- 导出 CSV 给 Excel 或其他分析工具使用。
- 自动采集失败时，使用手动采集兜底。

## 4. MVP Features
### 4.1 Competitor Management
- 添加 Amazon 商品 URL。
- 添加 ASIN + marketplace。
- 自动识别常见 marketplace。
- 列表展示标题、图片、ASIN、站点、最新价格、评分、评论数、最后采集时间、状态。
- 支持暂停、删除、手动刷新。

### 4.2 Local Browser Capture
采集字段：
- title
- price
- currency
- rating
- reviewCount
- availability
- imageUrl
- capturedAt
- captureStatus
- errorType
- errorMessage

解析优先级：
1. JSON-LD
2. meta 标签
3. DOM selector
4. 文本 fallback

失败类型：
- PAGE_LOAD_FAILED
- PRODUCT_NOT_FOUND
- CAPTCHA_DETECTED
- REGION_BLOCKED
- PARSER_FAILED
- NETWORK_TIMEOUT
- UNKNOWN_ERROR

### 4.3 History
- 每次采集生成一条 snapshot。
- 支持价格、评分、评论数趋势图。
- 支持 7 天、30 天、全部时间范围。

### 4.4 Export
- 导出单个竞品 CSV。
- 导出全部竞品 CSV。
- CSV 能被 Excel 正常打开。

## 5. V1 Features
- 每日 / 每 6 小时定时采集。
- 本地任务队列，同一时间只执行一个采集任务。
- 页面访问之间加入低频随机延迟。
- 连续失败自动暂停或降频。
- App 内变化提醒。
- 采集日志页面。
- 手动采集兜底模式。

## 6. Risk And Compliance Boundary
必须做：
- 首次启动展示数据采集合规说明。
- 默认低频采集。
- 出现验证码时停止自动任务。
- 连续失败后暂停该 ASIN。
- 错误原因要可读。
- README 明确只用于用户本机访问公开页面。

明确不做：
- 不集成验证码识别或打码平台。
- 不做代理池或 IP 轮换。
- 不绕过登录、地区限制、年龄验证、付费墙。
- 不提供高频批量抓取模式。
- 不宣传“突破 Amazon 风控”。

## 7. Browser Use Strategy
主方案：Playwright。
- 优点：跨浏览器、测试友好、自动化能力成熟。
- 缺点：可能被 Amazon 识别为自动化环境。

备选 A：Chrome DevTools Protocol 直连本机 Chrome。
- 适合 Playwright 自动实例成功率低时验证。
- 用户配置成本高，必须有安全提示。

备选 B：浏览器扩展 + Native Messaging。
- 更接近用户主动采集当前页面。
- 安装和发布流程更重，适合作为 V2 方向。

备选 C：半自动采集。
- 用户自己打开商品页，App 或扩展只读取当前页面。
- 是风控场景下最重要的兜底方案。

## 8. Non Goals
- 不做移动端。
- 不做云同步。
- 不做团队账号。
- 不接外部 API。
- 不接 LLM。
- 不做大规模爬虫。
- 不做验证码破解。
- 不做代理池。
- 不做 Amazon 登录态采集。
- 不采集非公开数据。

