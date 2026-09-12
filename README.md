# 在璐上 · 多旅行管理 PWA

「在璐上」是可乐和金鹿共同使用的旅行管理应用。网页标题随当前旅程变化，例如 `Korea Trip · 首尔 × 釜山`；iPhone/iPad 添加到主屏幕后，应用名称固定为 **在璐上**。

## 文档入口

| 想了解什么 | 阅读文件 |
|---|---|
| 当前架构、权限、数据与文件流转 | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| 用户要求与不可突破的产品边界 | [REQUIREMENTS.md](./REQUIREMENTS.md) |
| 当前版本、验证证据、已知限制与下一步 | [PROJECT_STATUS.md](./PROJECT_STATUS.md) |
| 旅程资料、决策与后续开发上下文 | [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) |
| 接手、检查、发布与安全操作 | [HANDOFF_PROMPT.md](./HANDOFF_PROMPT.md) |
| 图片素材来源与使用原则 | [PHOTO_SOURCES.md](./PHOTO_SOURCES.md) |

若文档与实际代码冲突，以源码和已验证的生产行为为准，并在同一次变更中修正文档；不得把计划写成已完成的功能。

## 产品与范围

- 11 个页面：首页、行程、交通、地图、美食、随笔、待办、行李、文件、支出、锦囊。
- 已配置韩国、香港、厦门三段旅程；动态记录通过 `tripId` 隔离，不能把韩国资料带进另两段旅程。
- 可乐和金鹿是共同所有者，拥有读写权限；访客仅能查看公开的总览行程，不能读取敏感模块或改动任何资料。
- 支出和随笔可逐条设为双方可见或仅创建者可见。
- 首页的灵感收集箱使用最简字段：标题、可选地点、归类、来源链接、可选备注。来源支持小红书和抖音；点击卡片在新标签打开原帖/原视频，编辑是次要操作。

## 当前 UI 设计与响应式验收

- 视觉基线是自然手账感：纸白、雾绿和 Songti/PingFang 中文层级；香港淡紫、厦门海盐蓝只作为对应旅程主题色。
- 灵感区在桌面/平板采用“说明栏 + 内容栏”的编辑式构图，卡片按内容收紧；卡片只展示标题、归类、地点和备注，不把来源平台做成视觉标签。
- 手机首页主视觉使用内容优先的高度约束；320px 窄屏的美食编辑操作改为“完成”独占一行，避免按钮拥挤；行程长表单保留底部粘性保存区。
- 共用控件经过 320×667、390×844、768×1024、1440×1000 四档检查：按钮/字段无文字裁切、横向溢出或同组重叠；关键操作触控高度统一为 40–50px。
- 页面图标统一由内置 SVG 图标集渲染，跨年企划与旅程选择层不再混用系统 emoji 图标。

## 当前技术结构

- 前端：单文件原生应用 [index.html](./index.html)，无框架构建步骤。
- 同步后端：CloudBase HTTP 云函数 [cloudfunctions/korea-api/index.js](./cloudfunctions/korea-api/index.js)，数据协议为 protocol 2。
- 权威动态数据：CloudBase `kr_sync_state`；旧 `kr_*` 集合只用于迁移与恢复，不得恢复“先删后插”的旧写入方式。
- 离线：Service Worker `lu-travel-v82`，配合 localStorage、IndexedDB 持久队列和前台/4 秒轮询同步。
- 发布：Vercel 生产入口 `https://www.jinlu.cloud/`，以及 CloudBase 根入口和 `/korea/` 镜像。两个 CloudBase 路径必须各自注册作用域正确的 Service Worker，避免页面壳互相污染。

## 数据可靠性原则

数据一致性与持久化高于界面和新功能。每次修改先持久化进本机写入队列，再由服务端做版本检查、幂等处理、不可变历史和三方合并。不同记录的并发修改可自动合并；同一记录的真实冲突不会静默覆盖，当前会保留本机版本供备份恢复。页面会在存在待同步或冲突数据时持续显示提示，退出和关闭页面也会拦截提醒。

这不是“所有场景已完全解决”的声明：当前仍是整份列表快照协议，尚未有页面内冲突选择器、通用成员模型或真实双设备弱网全矩阵验收。完整的现状与边界见 [PROJECT_STATUS.md](./PROJECT_STATUS.md)。

## 文件与隐私

证件、机票和酒店凭证不进入公开静态包、Vercel、Service Worker 缓存或公开 Git 仓库。历史内置 PDF 位于 CloudBase 私有存储；旧数据中已废弃的 `/assets/docs/` 地址，会按已知文件名迁移为私有文件 ID 后再请求临时链接。

用户手动上传的附件会先上传到 CloudBase PRIVATE 存储；同步记录只保存 `cloud://` 文件 ID、名称、MIME 与大小等元数据。预览和下载由 `korea-api` 校验共同所有者与 `tripId` 后签发 15 分钟临时地址。附件上传需要联网，单个文件保存上限为 4 MB；图片选择阶段允许到 12 MB并会在浏览器压缩后上传。上传失败不会替换原附件。

完整上线审计结论、修复清单和人工验收项见 [RELEASE_AUDIT.md](./RELEASE_AUDIT.md)。

## 本地验证

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

`sync-browser.mjs` 覆盖全部动态数据族、重载、离线队列、访客边界、灵感保存和历史私有 PDF 地址迁移/预览的浏览器回归。`ui-audit.mjs` 覆盖多种手机与桌面尺寸的页面、卡片、编辑层和预览层。自动化不能替代真实 iPhone/iPad、两位所有者双设备、弱网及跨地区网络验收。

## 安全与仓库卫生

- 不提交或输出账号密码、`.env.local`、OIDC token、CloudBase 密钥、`.git`、`.vercel` 或用户私密资料。
- 当前工作区中的签证行程、`assets/docs/visa/` PDF、`assets/photos/generated/` 和 `assets/photos/source/real/` 是未跟踪的私有资料；除非用户明确要求，禁止加入 Git。
- 不扩大 CloudBase Storage 的公开读取权限来修复文件预览。共享私有文件应由后端完成所有者授权并签发短期访问地址。
