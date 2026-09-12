# 在璐上接手与发布手册

更新时间：2026-09-12
当前实现基线：`dad2bff`；Service Worker：`lu-travel-v86`

## 先读

1. [ARCHITECTURE.md](./ARCHITECTURE.md)：数据、权限、私有文件和缓存结构。
2. [REQUIREMENTS.md](./REQUIREMENTS.md)：不可妥协的产品红线。
3. [PROJECT_STATUS.md](./PROJECT_STATUS.md)：完成证据、风险和 P0 工作。
4. [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md)：旅行资料与产品上下文。

## 当前工作区与关键文件

- 项目目录：`/Users/hankzhang/Desktop/lu-travel`
- 前端：`index.html`
- 同步客户端：`assets/sync-client.js`
- 后端：`cloudfunctions/korea-api/index.js`、`cloudfunctions/korea-api/sync-store.js`
- 离线缓存：`sw.js`
- 浏览器回归：`scripts/sync-browser.mjs`
- 同步单测：`scripts/sync-test.mjs`
- UI 审查：`scripts/ui-audit.mjs`

CloudBase 环境为 `hanoi-d4gj8vd2q1e7a3dc0`，HTTP 函数为 `korea-api`。生产入口是 `https://www.jinlu.cloud/`；CloudBase 也需发布根路径和 `/korea/` 镜像。不要在文档、终端输出或提交中记录账号密码、令牌或密钥。

## 必须遵守

- 数据一致性、自动恢复和文件可用性优先于视觉与新功能。
- 网站没有账号或访客角色；任何打开网站的人都有相同的完整读写权限，前后端不得重新加入登录验证。
- 动态数据继续使用 protocol 2；禁止恢复旧的先删后插写法。
- 敏感文件不得进入 Vercel、CloudBase 静态目录、Service Worker 缓存或 Git。
- Storage ACL 保持 PRIVATE；公共后端校验旅程文件路径后签发短期 URL。
- 低频修改和删除默认收进编辑态，删除二次确认；手机优先且触控目标至少 44px。

## 当前最重要的未完成工作

附件代码链路已经统一，但仍需两台真实设备分别上传、预览和下载同一文件。还需完成双设备弱网冲突、后台恢复、PWA 升级和中国大陆/韩国网络验收。未完成这些人工项前，不得宣称真实设备矩阵全部通过。

## 修改后的检查

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

`verify.mjs` 必须在不带 Authorization 头时确认 8 个同步 API 直接成功。自动化不能代替真实 iPhone/iPad、双设备及中韩网络验收。

## 发布顺序

先完成本地检查和需要的后端部署，再发布静态入口。前端改动应递增 `sw.js` 缓存版本并同步更新 `index.html` 中的 `sw.js?v=…`。

```bash
tcb hosting deploy index.html /index.html -e hanoi-d4gj8vd2q1e7a3dc0 --concurrency 1 --json
tcb hosting deploy sw.js /sw.js -e hanoi-d4gj8vd2q1e7a3dc0 --concurrency 1 --json
tcb hosting deploy index.html /korea/index.html -e hanoi-d4gj8vd2q1e7a3dc0 --concurrency 1 --json
tcb hosting deploy sw.js /korea/sw.js -e hanoi-d4gj8vd2q1e7a3dc0 --concurrency 1 --json
vercel --prod --yes
```

发布后确认：Vercel 和 CloudBase 各入口取得同一页面版本；根入口与 `/korea/` Worker scope 分别为 `/` 和 `/korea/`；页面没有登录入口；无凭证读写成功；文件预览不自动下载。不要因为静态发布成功而跳过真实双设备文件检查。

## 仓库卫生

当前存在未跟踪的私人资料：签证行程文档、`assets/docs/visa/` PDF、`assets/photos/generated/`、`assets/photos/source/real/`。除非用户明确要求，保持未跟踪，绝不 `git add -A`。提交前先检查 `git status --short` 和 `git diff --cached --name-only`。
