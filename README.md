# Korea Trip · 首尔 × 釜山

**可乐 & 金鹿** 的韩国冬季之旅可视化计划站。网页内品牌名保持 **“Korea Trip”**，Add to Home Screen 后桌面名称为 **“在璐上”**。

- 行程：深圳 ⇄ 首尔 · **2026.12.26 – 2027.1.3**（12/26 02:25 由深圳飞首尔 → 当日南下釜山 → 12/26–12/29 住 釜山站ASTI酒店 / ASTI Hotel Busan Station → 12/29 傍晚 KTX 回首尔 → 首尔酒店已定为 首尔明洞万怡酒店 / Courtyard by Marriott Seoul Myeongdong → 普信阁跨年 → 1/3 22:10 回深圳，1/4 01:15 落地）
- 域名：当前 `https://korea-vercel.vercel.app`（默认域名；上线稳定后可换绑 `hankzhang.cloud`）
- **本项目核心目标：手机 / iPad 优先的浏览体验**（金鹿不用电脑），并支持 Add to Home Screen 当原生 App 用。详见 [REQUIREMENTS.md](./REQUIREMENTS.md)
- **最高优先级补充**：保证中国大陆 / 美国 / 韩国都能正常打开；页面里的图片、跳转、地图、天气等资源都要优先走这三地可稳定访问的路径。Google / Naver 这类入口可以保留，但不能只依赖单一入口。

## 设计

- **小红书旅行手账风**：青灰米白底 `#F7FBF8` + 低饱和豆绿 `#78AA8B`，搭配雾蓝 / 暖黄 / 淡粉，整体更靠近用户参考图里的江南、水彩、文艺气质。
- **零 emoji 界面**：60+ 枚手绘线条 SVG 图标（线稿、圆头、随色）替换全部 emoji——去 AI 味的关键（设计缘由见 REQUIREMENTS.md §3.3）。
- 水彩风 PNG 插画 Hero 与全站页头（首尔塔 / 景福宫 / 釜山甘川文化村）轮播，另有 `photo-abstract-editorial` 处理过的城市画册图。
- 参考设计稿：`~/Downloads/IMG_3900 ~ 3904.PNG`。

## 功能

- **底部悬浮胶囊导航（11 个标签页）**：首页 / 行程 / 交通 / 地图 / 美食 / 随笔 / 待办 / 行李 / 文件 / 支出 / 锦囊 —— 拇指可达，随时直达任意板块，不再需要长页下滑（设计缘由见 REQUIREMENTS.md §3.1）
- 吸顶状态条：行程阶段 + 韩国当地时间（KST +9）+ 首页进度条
- 首页仪表盘：Hero 倒计时、下一站提醒、3 张快捷卡片（行程清单 / 备忘记录 / 我的收藏）
- 双城市天气（釜山 / 首尔，按行程阶段自动切换）：当前 + 5 天预报 + 逐小时；若外部天气 API 在某地区受限，自动回落到本地兜底数据
- 釜山 / 首尔双城市关系图（纯前端手帐地图，无第三方地图 SDK 主依赖；页面内固定比例、可拖动浏览、可放大缩小；Apple Maps 为主跳转入口，Naver / Kakao / Google / Amap + 坐标作为备用）
- 三个关键日期倒计时圆环：出发、跨年、回程
- 9 天行程折叠时间线 + **日历条**（12月/1月，行程日按 景点/美食/交通 着色分类点，点日期直达当天）——API 失败时内置数据兜底
- 交通专区：航班（去/回）/ KTX / AREX / T-money / 出租车 / 交通贴士
- 待办专区：预订待办支持勾选、新增、编辑、删除、直接拖动排序；打卡清单支持同步勾选
- 行李清单支持勾选、新增、编辑、删除、直接拖动排序
- 多币种记账（KRW/CNY/USD → 人均 RMB，**分类占比环形图**，底部弹层表单）
- 文件专区：自定义文件卡片（名称 / 状态 / 备注 / 附件 / 缩略图）云端共享；不预设具体证件或订单，图标由附件自动匹配（弱网时 localStorage 兜底；隐私提示见 REQUIREMENTS.md §3.4）
- 锦囊：美食（釜山/首尔分组）/ 韩语短语 / 冬季贴士
- PWA：Add to Home Screen（standalone 模式）+ Service Worker 离线壳（缓存版本 `korea-trip-v17`）

## 2026-09-04 交互修复验收备注

1. 行程日历：12/26–1/3 已正确映射为 D1–D9，点击日期会展开对应日卡并滚动到当天。
2. 页面文案：清理“功能说明式提示词”，页面上不再展示“手机一眼扫过去”“三个圆圈”“网页里不加载 Google/Naver 底图”等技术解释。
3. 行李 / 待办排序：每行增加拖动手柄，支持直接拖动改顺序，不再依赖连续点上移/下移。
4. 行李 / 待办编辑：新增/编辑改为统一底部面板，保存后本地立即刷新，并显示保存中 / 已同步 / 同步失败状态。
5. 行程图片：日卡片图片不再显示“当天封面 / 图 2 / 图 3”这类机械标签。
6. 行程条目详情：点击整行可展开 / 收起详情，编辑按钮不会误触展开。
7. 中文表达：面向金鹿的页面文案尽量中文化；KTX、T-money、CloudBase、Vercel 等必要专有名词保留。
8. PWA 名称：manifest 与 Apple Web App 标题均改为“在璐上”。
9. 地图：页内地图改为固定比例手帐关系图，支持拖动查看和放大缩小；外部地图只作为补充入口。
10. 弱网首屏：行程、待办、行李、打卡会先用本地缓存 / 内置数据立即渲染，CloudBase 数据回来后再覆盖刷新，避免中国大陆或跨境网络慢时页面空白。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | 纯 HTML/CSS/JS 单文件（`index.html`），无地图 SDK 依赖 |
| 天气 | Open-Meteo 免费 API（无需 key） |
| 后端 | CloudBase 云函数 `korea-api`（Node.js 18，HTTP 触发） |
| 数据库 | CloudBase NoSQL：`kr_itinerary` / `kr_checklist` / `kr_expenses` / `kr_bucketlist` / `kr_todos` / `kr_docs` |
| 部署 | Vercel（前端静态托管）+ `tcb fn deploy`（云函数） |

## 项目结构

```
korea-vercel/
├── index.html              # 单文件前端应用（所有 HTML/CSS/JS 内联）
├── sw.js                   # Service Worker（离线壳 + 静态资源缓存）
├── manifest.json           # PWA 清单（Add to Home Screen）
├── vercel.json             # 缓存策略（index.html 不缓存，/assets 永久缓存）
├── assets/
│   ├── icons/              # App 图标（192/512/apple-touch-icon）
│   └── photos/             # 水彩插画与 photo-abstract-editorial 城市画册图
├── REQUIREMENTS.md         # 需求文档
└── cloudfunctions/korea-api/   # 云函数项目内副本
```

云函数正式源码在 `~/Desktop/cloudfunctions/korea-api/index.js`（与河内项目 `api` 同目录规范）。

## API 路由

`https://hanoi-d4gj8vd2q1e7a3dc0.service.tcloudbase.com/korea-api`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/itinerary` | 行程（按 day, sortOrder 排序） |
| POST | `/itinerary` | 全量替换保存行程 `{items:[...]}` |
| GET | `/checklist` | 出行清单（按 sortOrder 排序） |
| POST | `/checklist` | 全量替换保存 `{items:[...]}`，用于新增/编辑/删除/排序 |
| POST | `/checklist/:docId` | 兼容旧版：更新清单项 `{done}` |
| GET | `/bucket-list` | 打卡清单 |
| POST | `/bucket-list/:docId` | 更新打卡 `{done}` |
| GET | `/todos` | 预订待办列表 |
| POST | `/todos` | 全量替换保存 `{items:[...]}`，用于新增/编辑/删除/排序 |
| POST | `/todos/:docId` | 兼容旧版：更新待办 `{done}` |
| GET | `/expenses` | 记账列表 |
| POST | `/expenses` | 全量替换保存 `{items:[...]}` |
| GET | `/docs` | 文件状态、备注、附件 |
| POST | `/docs` | 全量替换保存 `{items:[...]}` |

> 复用河内项目的 CloudBase 环境，集合使用 `kr_` 前缀，与河内数据互不干扰。

## 汇率与记账

- 1 USD ≈ 6.80 RMB（与河内项目一致）
- 1 RMB ≈ 190 KRW（可编辑）

以上常量在 `index.html` 顶部 `FX_RATES` 处修改。

## 部署

```bash
# 前端 → Vercel（首次会自动创建项目 korea-vercel 并生成 .vercel/project.json）
cd ~/Desktop/korea-vercel && vercel --prod

# 前端 → CloudBase 国内直连入口（每次改前端/图片都要额外同步）
# 先准备只含 index.html / manifest.json / sw.js / vercel.json / assets/ / 签证文件/ 的干净 dist，再上传到 /korea
tcb hosting deploy /tmp/korea-cloudbase-static-XXXXXX/dist /korea --env-id hanoi-d4gj8vd2q1e7a3dc0 --json

# 后端 → CloudBase 云函数（在 ~/Desktop 目录执行，函数目录为 cloudfunctions/korea-api）
tcb fn deploy korea-api
```

> 注意：GitHub/Vercel 自动部署不会同步 CloudBase webapps。中国大陆入口要单独执行上面的 `tcb hosting deploy ... /korea`，并用 `?v=<timestamp>` 验证图片与 `sw.js` 是否已刷新。

## 域名换绑（可选，上线稳定后）

```bash
# hankzhang.cloud 当前绑在河内项目上；先解绑
cd ~/Desktop/hanoi-vercel && vercel domains rm hankzhang.cloud

# 再绑定到本项目（vercel 会自动补 DNS CNAME）
cd ~/Desktop/korea-vercel && vercel domains add hankzhang.cloud
```

## 数据日常更新

不用改代码。三种方式任选：

1. **CloudBase 控制台** → 数据库 → 对应 `kr_` 集合，直接增删改文档。
2. **Claude Code + CloudBase MCP**（推荐）：`readNoSqlDatabaseContent` / `writeNoSqlDatabaseContent` 工具操作 `kr_` 集合。
3. 记账 / 打卡 / 清单 / 文件资料在网页上直接操作（自动同步云端）；行程页也支持直接编辑并整页同步保存到云端。

### 行程文档字段

```
{ day: 1, sortOrder: 1, time: "06:50", title: "...", subtitle: "...", detail: "...", mapUrl: "https://..." }
```

### 已确认的旅行信息

- 去程航班：Asiana OZ372，2026-12-26 02:25 从深圳宝安 T3 起飞，06:50 落地仁川 T2。
- 回程航班：Asiana OZ371，2027-01-03 22:10 从仁川 T2 起飞，2027-01-04 01:15 落地深圳宝安 T3。
- 釜山酒店：釜山站ASTI酒店 / ASTI Hotel Busan Station，12/26–12/29，釜山站旁，方便 12/29 晚上直接坐 KTX 去首尔。
- 首尔酒店：首尔明洞万怡酒店 / Courtyard by Marriott Seoul Myeongdong，入住 2026-12-29 15:00，退房 2027-01-03 11:00，确认号 #93241473。
- 12/29 釜山 → 首尔：计划晚一点再北上，KTX 预计傍晚出发，晚上到首尔后入住酒店。
- 现金与保险：不提前大量换韩元现金；到韩国优先用 Fidelity 卡在 ATM 无手续费取现，旅行保险（含医疗 / 航班延误）已确认不单独购买。

## 替换旅行图片

1. 把照片放进 `assets/photos/`；
2. 英雄区：替换 `seoul-watercolor.webp` / `busan-watercolor.webp` / `palace-watercolor.webp`，或改 `index.html` 里 `HERO_IMAGES` / `DAY_ART` 数组。
3. 住宿封面已经加入 `assets/photos/busan-asti-hotel-editorial.png`，后续如要换成真实照片，直接改 `HERO_IMAGES` / `DAY_ART` / `PHOTO_LIBRARY` 即可。

## 部署说明（Vercel MCP）

前端部署走 **Vercel MCP**（`deploy_to_vercel`，target production，name `korea-vercel`，teamId `team_wHIZB9oM0g4eyRlzun2xSPfo`）：

- 改动 `index.html / manifest.json / sw.js / vercel.json / assets/` 后重新调用部署即可覆盖线上版本。
- `assets/icons/*.png` 首次部署后无需重复上传（未改动时省略，减小单次调用体积）。
- 部署后验证：访问 `https://korea-vercel.vercel.app/`，确认 `meta theme-color` 为 `#78AA8B`、页面含「遇见首尔的浪漫时光」、无满屏 emoji。
- 本地验证：`python3 -m http.server 8766 --directory ~/Desktop/korea-vercel` + 无头 Chrome/Playwright 检查动态内容与 JS 报错。

## 移动端体验规范（红线）

- 触控目标 ≥ 44px；输入框字体 ≥ 16px（防 iOS 自动放大）
- `viewport-fit=cover` + safe-area 适配：顶部 Tab Bar 不被刘海/灵动岛遮挡，记账弹层不被手势条遮挡
- 天气/贴士/短语横向滑动（scroll-snap）
- 地图默认完整适配屏幕；放大后可在地图内部拖动浏览，不影响页面正常滚动
- API 失败时行程/清单/文件资料用内置数据或 localStorage 兜底

---

由腾讯云开发 CloudBase 与 Vercel 托管
