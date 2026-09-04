# 交接提示词（整段复制给下一个 Agent 会话）

```
你是接手「可乐 & 金鹿 韩国之旅」项目（~/Desktop/korea-vercel）的工程师。
代码已托管在 GitHub：git clone git@github.com:hankkyy/Korea-Trip.git
（如果要推送，优先走 SSH；不要把任何 token 写进仓库）
若 macOS TCC 阻止读取 Desktop 目录（EPERM），改用备份目录 /tmp/kr_split/，内容与源码一致。

## 项目背景
可乐 & 金鹿的韩国冬季旅行计划站（PWA，手机/iPad 优先）：
2026-12-26 02:25 深圳飞首尔 → 当日 AREX+KTX 南下釜山（12/26–12/29 住 Asti Hotel Busan Station）→ 12/29 傍晚 KTX 北上首尔
→ 首尔酒店已定为 Courtyard by Marriott Seoul Myeongdong → 12/31 普信阁跨年敲钟 → 2027-01-03 22:10 回深圳，01-04 01:15 落地。
参考项目 ~/Desktop/hanoi-vercel（架构规范）；后端复用其 CloudBase 环境 hanoi-d4gj8vd2q1e7a3dc0，
NoSQL 集合 kr_ 前缀，HTTP 云函数 korea-api。
🚫 红色安全线：~/Desktop/hanoi-vercel/.env.local 里的 VERCEL_OIDC_TOKEN 绝不能复制进本项目或任何输出。

## 用户核心要求（不可偏离）
1. 手机/iPad 优先（用户女朋友金鹿基本不用电脑），支持 Add to Home Screen（standalone 原生 App 体验）。
2. 9 Tab 多视图 + 底部悬浮胶囊导航（首页/行程/地图/交通/待办/行李/支出/文件/锦囊），不要长页下滑。
3. 视觉去 AI 化：薄荷绿清爽风（bg #F4F8F5、主色 #2FA36E、白卡片 16-20px 圆角），
   全站 60+ 手绘线条 SVG 图标替换 emoji——界面不能出现满屏 emoji。参考设计稿 ~/Downloads/IMG_3900~3904.PNG。
4. 文件区状态、备注、压缩照片需要 CloudBase 云端持久化共享；敏感证件照片要保留“谨慎上传”的隐私提示。
5. 改完代码必须本地零报错（node --check + 无头 Chrome 验证 9 个面板全渲染）。

## 当前状态
- v1.2 薄荷绿重设计已完成并本地验证通过。
- 部署：Vercel 项目已链接到本仓库，`.vercel/project.json` 里记录的 projectId 是
  `prj_m9oqrYcJj3jTcrkgpXSakIwZ616Y`，生产域名是 `https://korea-vercel.vercel.app`。
- 线上前端已经包含最新的薄荷绿重设计、可编辑行程、更新后的航班/酒店信息和新 app 图标。
- 2026-09-04：又补了更贴近小红书手帐封面的韩国景点图，当前封面资产已细化为釜山海云台/胶囊列车、釜山甘川、首尔景福宫、首尔夜景、首尔返程机场，并新增首尔 Marriott 酒店水彩图；`sw.js` 缓存版本已提升到 `korea-trip-v7`。
- 2026-09-04：CloudBase 正式部署源 `/Users/hankzhang/Desktop/cloudfunctions/korea-api` 已同步仓库云函数代码并重新部署；线上 `POST /itinerary` 已恢复，`kr_itinerary` 已刷新为 43 条新版行程，旧“海云台酒店”数据已清掉。
- 后端已上线：CloudBase HTTP 云函数 `korea-api`，API_BASE = `https://hanoi-d4gj8vd2q1e7a3dc0.service.tcloudbase.com/korea-api`。
- 云端数据集合前缀为 `kr_`：`kr_itinerary` / `kr_todos` / `kr_checklist` / `kr_bucketlist` / `kr_expenses` / `kr_docs`。
- 2026-09-04：文件区已从本机-only 改为云端共享，`GET/POST /docs` 负责同步证件状态、备注和压缩照片；localStorage 仅作弱网兜底。
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

## 2026-09-04 下午追加：国内访问与 jinlu.cloud（本段最重要，先读）

### 背景
- GFW 屏蔽 *.vercel.app（DNS 污染 + SNI 阻断），中国大陆直连打不开 korea-vercel.vercel.app / korea-trip.vercel.app。
- 自定义域名指向 Vercel 不受影响（SNI 是自己的域名）；CloudBase 国内环境不受影响。

### 已上线的两个入口（2026-09-04 从深圳宽带实测通过）
1. **CloudApp webapps（国内直连，无密码）**：https://korea-hanoi-d4gj8vd2q1e7a3dc0.webapps.tcloudbase.com/
   - 环境 hanoi-d4gj8vd2q1e7a3dc0（ap-shanghai），服务名 korea，版本 korea-003
   - 缺陷：6 张 editorial 大 PNG 已补 2/6（见「照片补传」），其余区块暂显占位
2. **jinlu.cloud（Vercel 自定义域名，2026-09-04 用户自己在 Vercel 控制台完成）**：https://jinlu.cloud（308 → www.jinlu.cloud，Vercel 设 www 为主域，正常现象）
   - DNS：jinlu.cloud CNAME cname.vercel-dns.com（A 216.198.79.1）
   - 页面 / sw.js / manifest / 照片全 200，可直接发给女朋友

### CloudApp 部署方法（下次更新国内站必读）
- MCP manageApps 有类型 bug（deployApp 的 CosTimestamp schema 是 integer 但后端要 string；getBuildLog 的 BuildId 要求 int64）→ **绕 MCP，用 callCloudApi**：
  - 上传：queryApps getUploadUrl 拿预签名 COS URL → `curl PUT zip`（**大文件会衰减卡死，1.4MB 小包 22-115s 正常，28MB 包 420s+ 卡死**）
  - 触发构建：callCloudApi（service=tcb, action=CreateCloudApp, region=ap-shanghai），params：EnvId、ServiceName="korea"、DeployType="static-hosting"、BuildType="ZIP"、StaticConfig{Framework, AppPath:"/korea", BuildPath:"dist", CosTimestamp:"<字符串>", StaticCmd{DeployCmd:"tcb hosting deploy . /korea" **必须显式传**，否则管线 cd 进 dist 后还找 dist/dist 报 Path does not exist}}
  - 每次部署同 ServiceName 生成新版本 korea-00N 递增；构建日志：callCloudApi tcb/DescribeCloudBaseRunBuildLog，BuildId 传数字
- **AppPath 只是共享托管挂载点；webapps 域名在根路径提供应用** → 包内全部根路径引用（/assets/、/manifest.json、register('/sw.js')、sw scope "/"）；托管桶文件在 korea/ 前缀下（hanoi 根目录勿动）
- 部署包：/tmp/korea-root/dist（无前缀根路径版）+ /tmp/korea-root/korea-root.zip；完整源 /tmp/korea-cn/dist（27MB）

### 照片补传（还剩 4 张，未完成）
- 托管现状：korea/assets/photos/ 已有 busan-harbor-editorial.png ✅、busan-village-editorial.png ✅，缺 seoul-airport / seoul-marriott-myeongdong / seoul-night / seoul-palace 4 张 editorial PNG
- 源文件：/tmp/korea-cn/dist/assets/photos/<名字>.png（2.5-3MB/张）
- 方法：manageHosting action=upload files=[{localPath, cloudPath:"korea/assets/photos/<名字>.png"}] **单文件逐个传**（批量 6 张曾卡死 20 分钟；单文件 1-2 分钟能成），每张传完用 queryHosting findFiles 验证再传下一张

### jinlu.cloud 备案（未开始，等用户操作）
- jinlu.cloud 未备案；CloudBase 国内绑域名硬性要求 ICP 备案。用户需在腾讯云备案控制台提「新增网站」备案（已有 hankzhang.cloud 主体，约 7-20 工作日）
- ⚠️ 提交备案前，jinlu.cloud 解析必须临时指回腾讯云（管局查解析与接入商一致，指 Vercel 会被打回）；期间用 webapps 链接顶上
- 备案通过后的绑定步骤（按顺序）：1) manageGateway bindCustomDomain（域名归属 TXT _cloudbase-challenge 已验证通过，保留即可）→ 2) 证书自动签发 → 3) DNSPod 撤掉 Vercel 的 A/CNAME，指向网关 OriginDomain hanoi-d4gj8vd2q1e7a3dc0.tcbaccess-in.tencentcloudbase.com → 4) 路由：MCP createRoute 无 pathRewrite 字段，用 CLI `tcb routes add -e hanoi-d4gj8vd2q1e7a3dc0 --data '{"domain":"jinlu.cloud","routes":[{"path":"/","upstreamResourceType":"STATIC_STORE","upstreamResourceName":"staticstore","pathRewrite":{"prefix":"/korea"}}]}'`（需先 `! tcb login`）
- 备选：korea.hankzhang.cloud（hankzhang.cloud 已备案，子域名可直接绑 CloudBase，几分钟上线）

## 2026-09-04 追加：跨地区可用性红线（本段也很重要）

- 这个站不是只服务一个地区；必须同时保证中国大陆、美国和韩国都能正常打开。
- 页面里的图片、封面、图标、地图跳转、按钮外链、天气接口、服务工作线程缓存资源都要优先选择三地可稳定访问的路径。
- 尽量减少对 Google、单一海外 CDN、脆弱跳转或容易被墙的外链依赖；如果必须保留外链，必须同时提供坐标、Naver / Kakao / Amap / Apple 这类备用入口。
- 如果用户反馈“某张照片加载不出来”，优先检查：是否外链资源、是否缺文件、是否只在某个地区/网络能访问，而不是先假设手机有问题。
- 日后新增图片时优先放本地 `assets/photos/`，并同步进 Service Worker 缓存与文档索引，避免某个地区首访时图片断档。

### 安全红线（不变）
🚫 hanoi 的 .env.local VERCEL_OIDC_TOKEN 绝不能复制到本项目；Desktop 下 签证文件/ 目录及 .env.local、.git、.vercel、截图、cloudfunctions 绝不能上传部署。

## 待办清单
- [x] 釜山酒店已确认并补进住宿卡和行程卡（Asti Hotel Busan Station，12/26–12/29）
- [x] 现金与保险决策已更新：不提前大量换韩元现金；到韩国用 Fidelity 卡 ATM 无手续费取现，旅行保险不单独购买
- [ ] 真实照片替换 assets/photos/ 的水彩 SVG 插画
- [ ] 预算总额确认（现占位 10000 RMB）
- [x] 文件区跨设备同步（状态 / 备注 / 压缩照片）
- [x] 自定义域名 jinlu.cloud 已上线（Vercel，用户控制台操作；备案通过后换绑 CloudBase）
- [ ] 补传剩余 4 张 editorial PNG（seoul-airport / seoul-marriott-myeongdong / seoul-night / seoul-palace）到托管 korea/assets/photos/，单文件逐个传 + findFiles 验证
- [ ] jinlu.cloud 提交「新增网站」备案（用户操作）→ 通过后按上文步骤绑 CloudBase

## 关键文件与细节
- index.html：单文件应用（~122KB / 2059 行），顶部常量区 FX_RATES（1 RMB≈190 KRW、USD 6.80）、
  BUDGET_TOTAL=10000、D1/BUSAN_END/TRIP_END/NEWYEAR 时间常量、HERO_IMAGES。
- sw.js 缓存版本已更新；manifest.json theme_color #2FA36E。
- 完整文档：README.md（含交接状态）与 REQUIREMENTS.md，在项目根目录和 /tmp/kr_split/ 均有。
- 会话记忆：~/.claude/projects/-Users-hankzhang/memory/korea-vercel-project.md。
```
