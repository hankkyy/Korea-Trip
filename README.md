# 在璐上 · 多旅行管理 App

这是可乐和金鹿共同使用的旅行管理 PWA。网页标题保持当前旅程品牌，例如 `Korea Trip · 首尔 × 釜山`；iPhone/iPad 添加到主屏幕后，App 名称固定为 **在璐上**。

## 先读什么

| 目的 | 文档 |
|---|---|
| 所有要求、决策和接手上下文的唯一事实源 | [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) |
| 用户要求和设计红线 | [REQUIREMENTS.md](./REQUIREMENTS.md) |
| 实际完成状态和剩余工作 | [PROJECT_STATUS.md](./PROJECT_STATUS.md) |
| 接手开发、验证、部署 | [HANDOFF_PROMPT.md](./HANDOFF_PROMPT.md) |

## 产品定位

- 手机和 iPad 是第一使用场景，桌面端是补充。
- 主要用户使用 iPhone 15 Pro、iPhone 16 Pro Max 和 iPad；触控、Safe Area、横竖屏、动态字体、单手操作优先。
- 中国大陆、韩国、美国都要有可用路径，不能依赖单一 Google/Naver/Kakao 资源。
- 无网时至少能打开 App、查看已缓存内容、继续编辑；恢复网络后再同步。
- 视觉是低饱和、丰富但克制的手帐旅行风，可按旅程使用绿、紫、蓝等主题色，不使用满屏 emoji 或技术说明式文案。

## 当前旅程

- 韩国：2026-12-26 至 2027-01-03，深圳 ⇄ 首尔，釜山和首尔 9 天跨年深度游。
- 香港：2026-12-18 至 2026-12-20，周末短途，迪士尼 + 香港市区。
- 厦门：2027-01-08 至 2027-01-10，周末短途，具体内容待定。
- 香港和厦门沿用韩国的整体框架，但内容、天数、交通、活动和资料必须独立，不能显示韩国数据。

## 已实现的主要能力

- 11 个 Tab：首页、行程、交通、地图、美食、随笔、待办、行李、文件、支出、锦囊。
- 当前旅程选择、记忆和基础切换；韩国、香港、厦门有基础配置。
- 行程日历、折叠时间线、天气兜底、航班/酒店/地图/画册静态内容。
- 待办、行李、打卡、支出、文件、随笔、美食的部分新增、编辑、删除或勾选。
- 待办和行李触控长按拖动排序；删除有二次确认；修改和删除默认收进编辑模式。
- 画册和文件统一站内预览层，支持返回、关闭、下载和新窗口打开。
- 人民币统一记账，KRW/USD/CNY 可输入；汇率失败时使用本地缓存或内置值。
- PWA standalone、Service Worker 静态缓存和基础离线写入队列。
- 旅程选择层支持 JSON 导出备份、导入恢复；后端提供基础单条更新/删除接口，前端仍在逐步迁移。

## 技术结构

- 前端：单文件 `index.html`，原生 HTML/CSS/JavaScript。
- 后端：CloudBase HTTP 云函数 `cloudfunctions/korea-api/index.js`。
- 数据库：CloudBase NoSQL，集合使用 `kr_` 前缀，并通过 `tripId` 隔离旅程。
- 部署：Vercel 生产站 + CloudBase 国内静态入口；两边都要同步。
- 离线：`sw.js` 缓存 App 壳、主要图片和 PDF；动态数据使用 localStorage 和离线队列兜底。

## 重要事实

当前 API 的行程、待办、行李、文件等主要保存仍是整批替换，不是完整的单条 CRUD；同时编辑时存在后保存覆盖先保存的风险。航班、酒店、地图点位、画册、天气、跨年活动仍主要来自 `TRIP_DATA` 配置，尚未全部提供页面编辑入口。完整状态以 [PROJECT_STATUS.md](./PROJECT_STATUS.md) 为准。

## 本地检查

```bash
cd /Users/hankzhang/Desktop/korea-vercel
node scripts/verify.mjs
node --check cloudfunctions/korea-api/index.js
git diff --check
python3 -m http.server 8766
```

`scripts/verify.mjs` 会检查 3 个线上入口、Service Worker、所有缓存图片/PDF、4 个 CloudBase API、Open-Meteo 天气接口和页面关键界面标记。当前已验证通过，但这是从当前开发环境发起的网络检查，不等同于真实中国大陆、韩国运营商和 iPhone/iPad 真机验收。发布前必须分别验证 Vercel 和 CloudBase 国内入口，不能只推 GitHub/Vercel。

## 安全

- 不提交 `.env.local`、OIDC token、`.git`、`.vercel` 或任何密钥。
- 不做网页内 AI 手帐转换；手帐图片使用现有静态素材，上传图片保留原图或普通本地压缩。
- 证件和机票文件属于敏感资料，保留隐私提示，不新增不必要的公开外链。
