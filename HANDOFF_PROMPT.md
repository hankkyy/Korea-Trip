# 交接提示词（整段复制给下一个 Agent 会话）

```
你是接手「可乐 & 金鹿 韩国之旅」项目（~/Desktop/korea-vercel）的工程师。
代码已托管在 GitHub：git clone git@github.com:hankkyy/Korea-Trip.git
（本机 gh CLI token 已失效、HTTPS 凭据链不可用，clone/push 一律走 SSH 地址 git@github.com:hankkyy/Korea-Trip.git）
若 macOS TCC 阻止读取 Desktop 目录（EPERM），改用备份目录 /tmp/kr_split/，内容与源码一致。

## 项目背景
可乐 & 金鹿的韩国冬季旅行计划站（PWA，手机/iPad 优先）：
2026-12-26 凌晨深圳飞首尔 → 当日 AREX+KTX 南下釜山（12/26–12/29）→ 12/29 晚 KTX 北上首尔
→ 12/31 普信阁跨年敲钟 → 2027-01-03 深夜航班回深圳，01-04 凌晨落地。
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
- 部署：旧 Vercel 项目 korea-vercel 对当前 MCP 身份权限受限（list/get 404、deploy 403），
  新版已部署到新项目 korea-trip（https://korea-trip.vercel.app）；
  旧 URL https://korea-vercel.vercel.app 仍是旧 emoji 版，未动。
- 后端已上线：kr_itinerary(43 条)/kr_todos(12)/kr_checklist(16)/kr_bucketlist(16)/kr_expenses(0)，
  API_BASE = https://hanoi-d4gj8vd2q1e7a3dc0.service.tcloudbase.com/korea-api
- 部署文件备份在 /tmp/kr_split/：index.html 四分片 part_aa~part_ad 按序拼接
  （sha256 e9227b76118259c2f9114849e2901cd0d9e970b449962eed7a564dbd83c8dbbb），
  另有 manifest.json / sw.js / vercel.json / icon.svg / hero-bg-1~4.svg 与 PNG 的 base64（*.b64）。
- 代码仓库：https://github.com/hankkyy/Korea-Trip（main 分支，前端全部源码 + cloudfunctions/korea-api +
  三份文档 + 本文件；push 走 SSH，见上）。

## 部署方法（Vercel MCP deploy_to_vercel）
- name: korea-trip（勿用 korea-vercel），teamId: team_wHIZB9oM0g4eyRlzun2xSPfo，
  target: production（403 则退回 preview），不传 projectSettings（静态站点自动识别）。
- 文件（13 个）：index.html、manifest.json、sw.js、vercel.json、assets/icons/icon.svg、
  assets/icons/icon-192.png（encoding base64）、assets/icons/icon-512.png（base64）、
  assets/icons/apple-touch-icon.png（base64）、assets/photos/hero-bg-1~4.svg。
- 验证：线上 URL 200、meta theme-color 为 #2FA36E、含「遇见首尔的浪漫时光」、无满屏 emoji；
  /manifest.json 含 "Korea Trip"。

## 待办清单
- [ ] Vercel 控制台删除探测垃圾项目 korea-probe（MCP 无删除工具，需用户手动删）
- [ ] 决定旧项目 korea-vercel 去留（修复权限后可部署回原项目拿回原 URL，或删除旧项目）
- [ ] hankzhang.cloud 域名换绑（当前绑 hanoi 项目：vercel domains rm → add，命令见 README）
- [ ] 填深圳⇄首尔航班号、釜山/首尔酒店信息（订票后）
- [ ] 真实照片替换 assets/photos/ 的水彩 SVG 插画
- [ ] 预算总额确认（现占位 10000 RMB）
- [ ] 文件区 v2 跨设备同步

## 关键文件与细节
- index.html：单文件应用（~122KB / 2059 行），顶部常量区 FX_RATES（1 RMB≈190 KRW、USD 6.80）、
  BUDGET_TOTAL=10000、D1/BUSAN_END/TRIP_END/NEWYEAR 时间常量、HERO_IMAGES。
- sw.js 缓存版本 korea-trip-v2；manifest.json theme_color #2FA36E。
- 完整文档：README.md（含交接状态）与 REQUIREMENTS.md，在项目根目录和 /tmp/kr_split/ 均有。
- 会话记忆：~/.claude/projects/-Users-hankzhang/memory/korea-vercel-project.md。
```
