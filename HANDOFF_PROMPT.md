# Agent 交接说明

2026-09-10 用户明确指定：多设备、多用户的数据一致性和持久化是零号优先级，高于新功能、界面和发布速度。动态数据权威来源是 `kr_sync_state`，旧 `kr_*` 集合只作迁移备份，禁止恢复先删后插。前端入口为 `assets/sync-client.js`，HTTP 返回 `protocol: 2`，SW v58 已发布。当前已实现两个实名账号登录、固定 UID 服务端授权、IndexedDB 队列、不可变快照、幂等回执、30 版历史与按记录三方合并。不同记录自动合并；同一记录冲突保留本机并提示备份，尚无页面内冲突选择器和真实 iPhone/iPad 双设备验收。

你正在接手 `/Users/hankzhang/Desktop/lu-travel` 的「在璐上」多旅行管理 App。先阅读：

1. `PROJECT_CONTEXT.md`：所有要求、决策、旅行资料和接手上下文的唯一事实源。
2. `README.md`：项目入口和技术结构。
3. `REQUIREMENTS.md`：用户不可妥协的需求和设计红线。
4. `PROJECT_STATUS.md`：当前真正完成、部分完成和未完成的工作。

## 产品背景

用户可乐与金鹿共同旅行。金鹿主要使用 iPhone/iPad，旅行中主要使用手机，因此移动端、触控、可读性、无网可用和低误触优先于桌面端。App 桌面名称必须是“在璐上”，网页标题按当前旅程显示。

当前旅程：

- 韩国：2026-12-26 至 2027-01-03，深圳 → 首尔 → 釜山 → 首尔 → 深圳，9 天跨年深度游，绿色主题。
- 香港：2026-12-18 至 2026-12-20，周末下班出发，迪士尼和市区，紫色主题。
- 厦门：2027-01-08 至 2027-01-10，周末短途，内容待定，蓝色主题。

## 不可违反的规则

- 不要把韩国数据复制到香港或厦门；所有动态资料必须按 `tripId` 隔离。
- 不要用满屏 emoji、AI 味提示语、技术状态文案或过度绿色；保持低饱和浅色手帐风。
- 所有打开/原图/文件预览优先使用站内 viewer，并提供返回和关闭；不能只打开裸 PDF/图片页面。
- 所有删除必须二次确认；低频修改和删除默认收进“编辑”入口，减少误触。
- 文件区只存文件资料，不显示“待准备/已准备/已上传”；待办区才记录待完成事项。
- 支出统一换算成人民币，并显示“仅用于统计分析目的”，不能做情侣分摊语气。
- 待办/行李排序必须保持 iOS 风格的长按拖动、占位和自动滚动手感。
- 不引入网页内 AI 手帐转换或第三方模型依赖；手帐图片使用现有静态素材。
- 不依赖单个 Google/Naver/Kakao 外链；为中国大陆、韩国和美国准备本地资源或备用入口。
- 没有真实设备覆盖时，不得声称“全站无 bug”。

## 当前技术事实

- 前端是单文件 `index.html`，原生 HTML/CSS/JavaScript。
- 后端是 CloudBase HTTP 云函数 `cloudfunctions/korea-api/index.js`。
- CloudBase 环境：`hanoi-d4gj8vd2q1e7a3dc0`，函数：`korea-api`，集合以 `kr_` 开头。
- API 地址：`https://hanoi-d4gj8vd2q1e7a3dc0-1448781892.ap-shanghai.app.tcloudbase.com/korea-api`。
- Vercel 项目：`lu-travel`；生产地址：`https://jinlu.cloud/`。
- 国内入口：`https://korea-hanoi-d4gj8vd2q1e7a3dc0.webapps.tcloudbase.com/`；前端或图片修改后必须额外部署 CloudBase 静态包。
- 2026-09-11 已验证的 Vercel 生产部署为 `dpl_EvmNCmYN7FukHGwgLhE8xgFMcEER`，已绑定 `www.jinlu.cloud`；CloudBase 已更新函数及静态托管 `/korea/index.html`、`/korea/sw.js`。静态版本化页面哈希一致，生产匿名会话实测行程 200、待办/支出/文件 403、单一行程导航与 Service Worker 均正常。
- Service Worker 当前缓存版本：`lu-travel-v58`；改资源后必须递增并验证旧缓存清理。
- 灵感箱为 `kr_inspirations`；入口在首页收集箱，剪贴板内容会打开可编辑的确认卡。Android PWA 分享目标参数为 `title`、`text`、`url`，自动保存前必须保持所有者登录。iPhone 没有 Web Share Target，用剪贴板收集入口。
- 动态列表通过 HTTP protocol 2 提交整份不可变快照，带事务版本、幂等请求、30 版历史和稳定 ID 三方合并；不同记录并发修改自动合并，同一记录冲突保留本机。
- API 读取需要 CloudBase 登录：可乐、金鹿为两个固定所有者。匿名访客只可读取总览行程；函数必须拒绝其读取待办、行李、支出、文件、美食、随笔、灵感箱和旅程管理，并拒绝其所有写入。支出、随笔的 `private` 记录必须带创建者 `ownerId` 并由函数过滤、保护，不能让另一位所有者通过整表同步删除。两位所有者的新密码已成功写入并通过正式站登录验证；不要把明文密码写入项目资料。敏感 PDF 和预览不应出现在静态部署包、Git 新增内容或 Service Worker 缓存。
- 旅程选择层已有 JSON 导出/导入和冲突备份恢复；它们是应急工具，不能替代 IndexedDB 持久队列、身份授权和正常冲突处理。
- 旅程设置已支持成员、时区、城市、封面和从已有旅程复制框架；不要把这误写成完整资料 CRUD。

## 开发顺序

继续完善 P0：把固定双账号授权升级为旅程成员模型，增加页面内冲突选择和版本恢复，再做真实 iPhone/iPad 双设备与中韩运营商验收。金鹿历史美食收藏未在云端、旧集合或现存历史中找到，只有她原设备未清理的缓存仍可能恢复；不要让她清缓存或卸载。P0 达标后再继续资料 CRUD 和视觉功能。

## 每次修改后必须检查

```bash
cd /Users/hankzhang/Desktop/lu-travel
node scripts/verify.mjs
node scripts/sync-test.mjs
node scripts/sync-browser.mjs
node scripts/ui-audit.mjs
node --check cloudfunctions/korea-api/index.js
node --check cloudfunctions/korea-api/sync-store.js
node --check assets/sync-client.js
git diff --check
```

`scripts/verify.mjs` 在没有 token 时应确认受保护 API 返回 401；提供测试 token 才执行完整 API 协议检查。`sync-test.mjs` 与 `sync-browser.mjs` 覆盖同步、全部动态数据族和浏览器交互，但不能替代真实中国大陆/韩国网络及 iPhone/iPad 双用户双设备验收。还要确认 Vercel 与 CloudBase 国内入口版本一致。

## 安全红线

绝不能提交或输出任何 `.env.local`、`VERCEL_OIDC_TOKEN`、CloudBase 密钥、`.git`、`.vercel`、账号密码或用户私密资料。证件、机票和酒店凭证只允许保存在 CloudBase 私有存储中，页面用临时签名地址访问。

## 文档更新要求

完成代码后必须更新 `PROJECT_STATUS.md`，必要时更新 `README.md`、`REQUIREMENTS.md` 和本文件。明确写出做了什么、验证了什么、没有验证什么、剩余风险和下一步，不得只留下模糊的“已完成”。
