# Korea Trip · 首尔 × 釜山

**可乐 & 金鹿** 的韩国冬季之旅可视化计划站。

- 行程：深圳 ⇄ 首尔 · **2026.12.26 – 2027.1.3**（12/26 凌晨飞首尔 → 当日南下釜山 → 12/29 晚 KTX 回首尔 → 普信阁跨年 → 1/3 晚班机回深圳，1/4 凌晨落地）
- 域名：新版部署在 `https://korea-trip.vercel.app`（默认域名）；旧版（emoji 版）仍在 `https://korea-vercel.vercel.app`——旧项目对当前 MCP 身份权限受限无法更新，详见「交接状态」。上线稳定后可换绑 `hankzhang.cloud`
- **本项目核心目标：手机 / iPad 优先的浏览体验**（金鹿不用电脑），并支持 Add to Home Screen 当原生 App 用。详见 [REQUIREMENTS.md](./REQUIREMENTS.md)

## 设计

- **薄荷绿清爽风**：米白薄荷底 `#F4F8F5` + 白卡片大圆角 + 薄荷绿主色 `#2FA36E`，点缀浅蓝 / 浅粉 / 暖橙。
- **零 emoji 界面**：60+ 枚手绘线条 SVG 图标（线稿、圆头、随色）替换全部 emoji——去 AI 味的关键（设计缘由见 REQUIREMENTS.md §3.3）。
- 水彩风 SVG 插画 Hero（首尔塔 / 韩屋 / 釜山缆车 / 灯笼）轮播。
- 参考设计稿：`~/Downloads/IMG_3900 ~ 3904.PNG`。

## 功能

- **底部悬浮胶囊导航（9 个标签页）**：首页 / 行程 / 地图 / 交通 / 待办 / 行李 / 支出 / 文件 / 锦囊 —— 拇指可达，随时直达任意板块，不再需要长页下滑（设计缘由见 REQUIREMENTS.md §3.1）
- 吸顶状态条：行程阶段 + 韩国当地时间（KST +9）+ 首页进度条
- 首页仪表盘：Hero 倒计时、下一站提醒、3 张快捷卡片（行程清单 / 备忘记录 / 我的收藏）
- 双城市天气（釜山 / 首尔，按行程阶段自动切换）：当前 + 5 天预报 + 逐小时
- 釜山 / 首尔双地图视图（Leaflet + OpenStreetMap，分类色圆点标记，触屏防误触）
- 出发 / 跨年 / 回程 三枚倒计时圆环
- 9 天行程折叠时间线 + **日历条**（12月/1月，行程日按 景点/美食/交通 着色分类点，点日期直达当天）——API 失败时内置数据兜底
- 交通专区：航班（去/回）/ KTX / AREX / T-money / 出租车 / 交通贴士
- 待办专区：预订待办（12 项）+ 打卡清单（云端同步 + 本地缓存）
- 行李清单（云端同步 + 本地缓存）
- 多币种记账（KRW/CNY/USD → 人均 RMB，预算进度条 + **分类占比环形图**，底部弹层表单）
- 文件专区：证件状态打卡 + 照片存本机（隐私设计，见 REQUIREMENTS.md §3.4）
- 锦囊：美食（釜山/首尔分组）/ 韩语短语 / 冬季贴士
- PWA：Add to Home Screen（standalone 模式）+ Service Worker 离线壳（缓存版本 `korea-trip-v2`）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | 纯 HTML/CSS/JS 单文件（`index.html`），Leaflet 1.9.4 + OpenStreetMap |
| 天气 | Open-Meteo 免费 API（无需 key） |
| 后端 | CloudBase 云函数 `korea-api`（Node.js 18，HTTP 触发） |
| 数据库 | CloudBase NoSQL：`kr_itinerary` / `kr_checklist` / `kr_expenses` / `kr_bucketlist` / `kr_todos` |
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
│   └── photos/             # 英雄区水彩插画（hero-bg-1~4.svg，可替换为真实照片）
├── REQUIREMENTS.md         # 需求文档
└── cloudfunctions/korea-api/   # 云函数项目内副本
```

云函数正式源码在 `~/Desktop/cloudfunctions/korea-api/index.js`（与河内项目 `api` 同目录规范）。

## API 路由

`https://hanoi-d4gj8vd2q1e7a3dc0.service.tcloudbase.com/korea-api`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/itinerary` | 行程（按 day, sortOrder 排序） |
| GET | `/checklist` | 出行清单（按 id 排序） |
| POST | `/checklist/:docId` | 更新清单项 `{done}` |
| GET | `/bucket-list` | 打卡清单 |
| POST | `/bucket-list/:docId` | 更新打卡 `{done}` |
| GET | `/todos` | 预订待办列表 |
| POST | `/todos/:docId` | 更新待办 `{done}` |
| GET | `/expenses` | 记账列表 |
| POST | `/expenses` | 全量替换保存 `{items:[...]}` |

> 复用河内项目的 CloudBase 环境，集合使用 `kr_` 前缀，与河内数据互不干扰。

## 汇率与预算

- 1 USD ≈ 6.80 RMB（与河内项目一致）
- 1 RMB ≈ 190 KRW（可编辑）
- 预算总额：10000 RMB（占位，可编辑）

以上常量在 `index.html` 顶部 `FX_RATES` / `BUDGET_TOTAL` 处修改。

## 部署

```bash
# 前端 → Vercel（首次会自动创建项目 korea-vercel 并生成 .vercel/project.json）
cd ~/Desktop/korea-vercel && vercel --prod

# 后端 → CloudBase 云函数（在 ~/Desktop 目录执行，函数目录为 cloudfunctions/korea-api）
tcb fn deploy korea-api
```

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
3. 记账 / 打卡 / 清单在网页上直接操作（自动同步云端）。

### 行程文档字段

```
{ day: 1, sortOrder: 1, time: "06:30", title: "...", subtitle: "...", detail: "...", mapUrl: "https://..." }
```

## 替换真实照片

1. 把照片放进 `assets/photos/`；
2. 英雄区：替换 `hero-bg-1.svg ~ hero-bg-4.svg` 为同名 jpg（或改 `index.html` 里 `HERO_IMAGES` 数组）。

## 交接状态（2026-09-03 · 给下一个 Agent）

**一句话**：薄荷绿去 emoji 重设计（v1.2）已完成、本地零报错验证通过；因旧 Vercel 项目 `korea-vercel` 对当前 MCP 身份权限受限（list/get 404、deploy 403），新版部署到**新项目 `korea-trip`**（team `team_wHIZB9oM0g4eyRlzun2xSPfo`）。

- 生产地址：`https://korea-trip.vercel.app`（若 fallback 到 preview 则以实际返回 URL 为准）
- 旧地址：`https://korea-vercel.vercel.app` 仍是旧 emoji 版（未动，两版并存期间注意区分）
- 待办（按优先级）：
  1. 清理：Vercel 控制台删除探测用垃圾项目 `korea-probe`（MCP 无删除工具，需用户手动删）
  2. 决定旧项目去留：在控制台修复 `korea-vercel` 项目权限后可直接部署回原项目（拿回原 URL），或删除旧项目
  3. 域名换绑：`hankzhang.cloud` 当前绑在 hanoi 项目，解绑后绑到本项目（命令见下）
  4. 内容补全：航班号、酒店、真实照片、预算确认
  5. 文件区 v2 跨设备同步

**文件位置**：
- 源码：`~/Desktop/korea-vercel/`（index.html 2059 行 / 122KB 等全部文件）
- **代码仓库：`https://github.com/hankkyy/Korea-Trip`（main 分支，2026-09-03 已推送；clone/push 走 SSH：`git@github.com:hankkyy/Korea-Trip.git`——本机 gh CLI token 已失效，勿用 HTTPS）**
- 部署用文件备份：`/tmp/kr_split/`（index.html 4 分片 part_aa~ad + manifest/sw/vercel.json + assets 全部；分片拼接 sha256 = `e9227b76118259c2f9114849e2901cd0d9e970b449962eed7a564dbd83c8dbbb`，与 Desktop 版字节一致；PNG 的 base64 在 *.b64 文件）
- 云函数正式源码：`~/Desktop/cloudfunctions/korea-api/index.js`（项目内 `cloudfunctions/korea-api/` 有副本）

**注意**：2026-09-03 晚会话中 macOS TCC 曾阻止读取/写入 `~/Desktop/` 下文件（EPERM，系统隐私权限，非工具沙箱），`/tmp` 不受影响；若再遇到，从 /tmp/kr_split/ 取文件，或让用户在「系统设置 → 隐私与安全性 → 完全磁盘访问权限」给终端/Claude 授权。

**本地验证**（改完代码必跑）：
- `python3 -m http.server 8765` + 无头 Chrome `--headless=new --dump-dom http://localhost:8765/#home` 检查 JS 报错与 9 面板渲染
- 内联脚本 `node --check`
- 页面校验点：meta theme-color `#2FA36E`、Hero 含「遇见首尔的浪漫时光」、界面无满屏 emoji

## 部署说明（Vercel MCP）

前端部署走 **Vercel MCP**（`deploy_to_vercel`）：

- **项目名用 `korea-trip`**（不要用 `korea-vercel`——旧项目对 MCP 身份权限受限），teamId `team_wHIZB9oM0g4eyRlzun2xSPfo`，target `production`（403 则退回 `preview`）。
- 文件清单（13 个）：`index.html`（/tmp/kr_split/ 的 part_aa+part_ab+part_ac+part_ad 顺序拼接，sha256 见上）、`manifest.json`、`sw.js`、`vercel.json`、`assets/icons/icon.svg`、`assets/icons/icon-192.png`（base64，源 icon192.b64）、`assets/icons/icon-512.png`（base64，源 icon512.b64）、`assets/icons/apple-touch-icon.png`（base64，源 apple.b64）、`assets/photos/hero-bg-1~4.svg`。
- 后续改动重新调用部署即可覆盖线上版本；`assets/icons/*.png` 未改动时可省略。
- 部署后验证：访问线上 URL，确认 `meta theme-color` 为 `#2FA36E`、页面含「遇见首尔的浪漫时光」、无满屏 emoji；`/manifest.json` 含 "Korea Trip"。

## 移动端体验规范（红线）

- 触控目标 ≥ 44px；输入框字体 ≥ 16px（防 iOS 自动放大）
- `viewport-fit=cover` + safe-area 适配：顶部 Tab Bar 不被刘海/灵动岛遮挡，记账弹层不被手势条遮挡
- 天气/贴士/短语横向滑动（scroll-snap）
- 触屏设备地图不拦截页面滚动
- API 失败时行程/清单用内置数据 + localStorage 兜底

---

Powered by CloudBase 腾讯云开发 & Vercel
