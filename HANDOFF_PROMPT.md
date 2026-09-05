# Agent 交接说明

你正在接手 `/Users/hankzhang/Desktop/korea-vercel` 的「在璐上」多旅行管理 App。先阅读：

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
- API 地址：`https://hanoi-d4gj8vd2q1e7a3dc0.service.tcloudbase.com/korea-api`。
- Vercel 生产地址：`https://korea-vercel.vercel.app/`。
- 国内入口：`https://korea-hanoi-d4gj8vd2q1e7a3dc0.webapps.tcloudbase.com/`；前端或图片修改后必须额外部署 CloudBase 静态包。
- Service Worker 当前缓存版本：`korea-trip-v22`；改资源后必须递增并验证旧缓存清理。
- 多数数据接口当前是整批替换，存在双设备覆盖风险，这是已知架构缺口。
- 旅程选择层已有 JSON 导出/导入恢复；后端已提供 `/records/:collection/:docId` 单条更新/删除和 `baseUpdatedAt` 冲突检测，但前端尚未全部接入。
- 旅程设置已支持成员、时区、城市、封面和从已有旅程复制框架；不要把这误写成完整资料 CRUD。

## 开发顺序

优先完成 V1.4 旅程设置和 V1.5 资料 CRUD，再做 V1.6 离线同步，最后做 V1.7 质量保障。每次只做可验证的小批次，先查看现有代码和脏工作区，不要覆盖用户已有修改。

## 每次修改后必须检查

```bash
cd /Users/hankzhang/Desktop/korea-vercel
node scripts/verify.mjs
node --check cloudfunctions/korea-api/index.js
git diff --check
```

`scripts/verify.mjs` 当前会检查 3 个线上入口、Service Worker、所有缓存资源、4 个 API、天气接口和关键页面标记。它只能证明网络层和静态资源基本可达，不能替代真实中国大陆/韩国网络及 iPhone/iPad 真机点击验收。还要检查 11 个 Tab、旅程切换、Safe Area、弹层、输入、滚动、拖动、键盘、横竖屏、删除确认、站内 viewer 返回、断网编辑、恢复同步，以及 Vercel/CloudBase 国内入口版本一致性。

## 安全红线

绝不能提交或输出任何 `.env.local`、`VERCEL_OIDC_TOKEN`、CloudBase 密钥、`.git`、`.vercel` 或用户私密资料。证件和机票 PDF 属于敏感文件，只能按现有静态资源和隐私规则处理。

## 文档更新要求

完成代码后必须更新 `PROJECT_STATUS.md`，必要时更新 `README.md`、`REQUIREMENTS.md` 和本文件。明确写出做了什么、验证了什么、没有验证什么、剩余风险和下一步，不得只留下模糊的“已完成”。
