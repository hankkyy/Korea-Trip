# 交接提示词（整段复制给下一个 Agent 会话）

```
你是接手「可乐 & 金鹿 韩国之旅」项目（~/Desktop/korea-vercel）的工程师。
代码已托管在 GitHub：git clone git@github.com:hankkyy/Korea-Trip.git
（如果要推送，优先走 SSH；不要把任何 token 写进仓库）
若 macOS TCC 阻止读取 Desktop 目录（EPERM），改用备份目录 /tmp/kr_split/，内容与源码一致。

## 项目背景
可乐 & 金鹿的韩国冬季旅行计划站（PWA，手机/iPad 优先）：
2026-12-26 02:25 深圳飞首尔 → 当日 AREX+KTX 南下釜山（12/26–12/29）→ 12/29 傍晚 KTX 北上首尔
→ 首尔酒店已定为 Courtyard by Marriott Seoul Myeongdong → 12/31 普信阁跨年敲钟 → 2027-01-03 22:10 回深圳，01-04 01:15 落地。
参考项目 ~/Desktop/hanoi-vercel（架构规范）；后端复用其 CloudBase 环境 hanoi-d4gj8vd2q1e7a3dc0，
NoSQL 集合 kr_ 前缀，HTTP 云函数 korea-api。
🚫 红色安全线：~/Desktop/hanoi-vercel/.env.local 里的 VERCEL_OIDC_TOKEN 绝不能复制进本项目或任何输出。

## 用户核心要求（不可偏离）
1. 手机/iPad 优先（用户女朋友金鹿基本不用电脑），支持 Add to Home Screen（standalone 原生 App 体验）。
2. 9 Tab 多视图 + 底部悬浮胶囊导航（首页/行程/地图/交通/待办/行李/支出/文件/锦囊），不要长页下滑。
3. 视觉去 AI 化：薄荷绿清爽风（bg #F4F8F5、主色 #2FA36E、白卡片 16-20px 圆角），
   全站 60+ 手绘线条 SVG 图标替换 emoji——界面不能出现满屏 emoji。参考设计稿 ~/Downloads/IMG_3900~3904.PNG。
4. 文件区照片只存本机 localStorage，不上传服务器（隐私）。
5. 改完代码必须本地零报错（node --check + 无头 Chrome 验证 9 个面板全渲染）。

## 当前状态
- v1.2 薄荷绿重设计已完成并本地验证通过。
- 部署：Vercel 项目已链接到本仓库，`.vercel/project.json` 里记录的 projectId 是
  `prj_m9oqrYcJj3jTcrkgpXSakIwZ616Y`，生产域名是 `https://korea-vercel.vercel.app`。
- 线上前端已经包含最新的薄荷绿重设计、可编辑行程、更新后的航班/酒店信息和新 app 图标。
- 2026-09-04：又补了更贴近小红书手帐封面的韩国景点图，当前封面资产已细化为釜山海云台/胶囊列车、釜山甘川、首尔景福宫、首尔夜景、首尔返程机场；`sw.js` 缓存版本已提升到 `korea-trip-v6`。
- 后端已上线：CloudBase HTTP 云函数 `korea-api`，API_BASE = `https://hanoi-d4gj8vd2q1e7a3dc0.service.tcloudbase.com/korea-api`。
- 云端数据集合前缀为 `kr_`：`kr_itinerary` / `kr_todos` / `kr_checklist` / `kr_bucketlist` / `kr_expenses`。
- 代码仓库：https://github.com/hankkyy/Korea-Trip（main 分支，前端全部源码 + cloudfunctions/korea-api + 三份文档 + 本文件）。

## 部署方法

### 前端（Vercel）
- 项目名：`korea-vercel`
- teamId：`team_wHIZB9oM0g4eyRlzun2xSPfo`
- 生产域名：`https://korea-vercel.vercel.app`
- 最稳妥流程：
  1. 本地更新 `index.html / manifest.json / sw.js / vercel.json / assets/`
  2. `git add` → `git commit` → `git push origin main`
  3. 等 Vercel 自动出 production build，或用 CLI / MCP 触发
  4. 验证首页标题、9 个 Tab、行程编辑、图标、移动端适配

### 后端（CloudBase）
- HTTP 云函数：`korea-api`
- API_BASE：`https://hanoi-d4gj8vd2q1e7a3dc0.service.tcloudbase.com/korea-api`
- 先发云函数，再确认前端能读到 `kr_` 集合数据

## 待办清单
- [ ] 釜山酒店最终确认后补进住宿卡和行程卡（当前先按“釜山站附近酒店”占位，方便 12/29 晚饭前后直接从釜山站去首尔）
- [ ] 真实照片替换 assets/photos/ 的水彩 SVG 插画
- [ ] 预算总额确认（现占位 10000 RMB）
- [ ] 文件区 v2 跨设备同步
- [ ] 如需自定义域名，再按 README 里的 Vercel 命令操作

## 关键文件与细节
- index.html：单文件应用（~122KB / 2059 行），顶部常量区 FX_RATES（1 RMB≈190 KRW、USD 6.80）、
  BUDGET_TOTAL=10000、D1/BUSAN_END/TRIP_END/NEWYEAR 时间常量、HERO_IMAGES。
- sw.js 缓存版本已更新；manifest.json theme_color #2FA36E。
- 完整文档：README.md（含交接状态）与 REQUIREMENTS.md，在项目根目录和 /tmp/kr_split/ 均有。
- 会话记忆：~/.claude/projects/-Users-hankzhang/memory/korea-vercel-project.md。
```
