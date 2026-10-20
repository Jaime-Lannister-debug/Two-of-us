# Two of Us · Project Map

这是维护入口。上下文压缩或换设备后，先读本文件，再读 AGENTS.md，只打开目标功能对应的文件。

**当前状态**：原生 ES Modules；页面 `shared.html` → `src/main.js` → `src/app.js` → `src/registry.js`。不使用框架、不要求前端打包器。GitHub Pages 仍通过原工作流发布。数据库、RPC、RLS、运行配置和公开地址保持不变。本次整理没有新 SQL 需要执行；05 功能是否已在正式项目启用，仍以 Supabase 中的实际执行状态为准。

## 功能定位表：每增加一个功能，必须补一行

每行写清功能、入口、依赖和验证；删除功能时删对应行并更新关联关系。`scripts/check.py` 会检查所有源码文件都在本地图中登记，避免只写代码不更新地图。

| 功能 / 责任 | 主要文件 | 对外入口与依赖 | 主要验证 |
|---|---|---|---|
| 网页骨架 | `shared.html`、`index.html` | 保留登录区、侧栏、头部、内容与弹窗挂载点；不写业务 JS/CSS | `tests/app-contract.mjs`、`tests/ui-parity.mjs` |
| 应用启动与功能装配 | `src/main.js`、`src/app.js`、`src/registry.js` | `createApplication()`、`app.start()`；注册模块与模板，拒绝重名接口 | `tests/app-contract.mjs` |
| 共享状态 | `src/core/state.js` | `createState()`；收藏、会话、编辑与互动状态，各应用实例独立 | `tests/app-contract.mjs` |
| 资源生命周期 | `src/core/resources.js` | `app.events.listen`、`app.timers`、`app.dispose()`；移除监听、定时器和订阅 | `tests/app-contract.mjs` |
| 外部配置与公开地址 | `src/core/config.js`、`supabase-config.example.js` | `getRuntimeConfig()`；真实配置仍来自忽略 Git 的 `supabase-config.js`，R2 仅两个公开常量 | `scripts/build_pages.py`、`tests/build.mjs` |
| DOM、转义与基本表单片段 | `src/core/dom.js` | `$`、`esc`、`toast`、`field`、`select`、`cloudMessage`；按需直接 import | `tests/ui-parity.mjs` |
| 公共数值与日期 | `src/core/numbers.js`、`src/core/dates.js` | 坐标空值、范围、纯日期、周年与闰年处理 | `tests/cloud.mjs`、`tests/together-ui.mjs` |
| 公共错误文案 | `src/core/errors.js` | `friendlyError()`；保留冲突、网络、邮箱确认与权限提示 | `tests/cloud.mjs` |
| 导航、搜索与详情地址 | `src/shell/navigation.js` | `initNavigation()`、`go()`、`detailId()`、`openDetails()`；200ms 搜索防抖 | `tests/app-contract.mjs`、`tests/ui-parity.mjs` |
| 动效 | `src/shell/effects.js` | `initEffects()`；按钮、搜索与背景；尊重 reduced-motion | `styles/effects.css`、`tests/app-contract.mjs` |
| 登录、注册、会话及条目 Realtime | `src/auth/controller.js` | `initSharedCloud()`、`activateSession()`；退出清理，INSERT/UPDATE/DELETE 重新查询 | `tests/cloud.mjs`、`tests/app-contract.mjs` |
| 导出、邀请码与退出 | `src/auth/account-actions.js` | `initAccountActions()`；create_shared_invite / join_shared_space RPC | `tests/menu.mjs`、`supabase/02-option-b-members.sql` |
| 收藏数据契约与兼容解码 | `src/collections/model.js` | `normalizeItem()`、`decodeRow()`、分类与状态；移除脏进度、兼容旧酒店和图片 | `tests/cloud.mjs`、`tests/details-and-music.mjs` |
| 收藏数据库访问 | `src/data/items.js` | `loadSharedItems()`、`saveSharedItem()`、`deleteSharedItem()`；不传 created_by，编辑保留 expected_content | `tests/cloud.mjs`、`supabase/01-option-a.sql`、`supabase/02-option-b-members.sql` |
| 首页与五类收藏列表 | `src/collections/list.js` | `render()`、`card()`；收藏筛选、首页、卡片、旅行时间线与日历协调 | `tests/ui-parity.mjs` |
| 收藏编辑与删除 | `src/collections/editor.js`、`src/collections/editor-template.js` | `openForm()`、`initEditor()`、`closeModal()`；表单、焦点、保存、冲突提示 | `tests/cloud.mjs`、`tests/ui-parity.mjs` |
| 游戏时长 / 电视剧集数 | `src/collections/progress.js` | `progressCard()`、`setupProgressEditor()`；游戏只用小时标尺，电视剧保留集数 | `tests/details-and-music.mjs`、`tests/ui-parity.mjs` |
| 亲密日历 | `src/collections/calendar.js` | `calendar()`；月份与日期筛选由收藏列表协调 | `tests/ui-parity.mjs` |
| 条目详情 / 查看大图 | `src/collections/details.js`、`src/collections/details-template.js` | `renderDetail()`、`bindDetailImages()`；hash 由导航模块管理 | `tests/details-and-music.mjs`、`tests/ui-parity.mjs` |
| 旅行地图 | `src/collections/travel/map.js` | `initMap()`；OSM 瓦片、有效零坐标、选点草稿 | `styles/travel-map.css`、`tests/travel-map.mjs` |
| 旅行日期区间 / 多酒店 | `src/collections/travel/editor.js` | `setupTravelEditor()`；表单提交仍在收藏编辑器统一校验 | `tests/details-and-music.mjs`、`tests/ui-parity.mjs` |
| 旅行相册 | `src/collections/travel/gallery.js` | `uploadTravelPhotos()`、`removeTravelPhoto()`；含封面最多十张；通过原编辑 RPC 保存 URL | `tests/details-and-music.mjs` |
| 本地封面 / R2 图片上传 | `src/media/covers.js` | `setupCoverUpload()`、`compressTravelImage()`、`uploadR2Photo()`；400px/.6 封面、1000px/.75 相册 | `tests/cover-upload.mjs` |
| QQ 音乐分享解析 / 信息读取 | `src/collections/music-link.js`、`src/collections/music.js` | `qqShareInfo()` 纯校验；`readQQMusic()`、`setupMusicImport()`；官方 JSONP，不下载歌曲 | `tests/details-and-music.mjs` |
| 头像、昵称与双人菜单 | `src/profiles/model.js`、`src/profiles/controller.js`、`src/profiles/template.js` | `initPeopleUI()`、`loadPeople()`、`renderPeople()`；独立资料订阅 | `tests/menu.mjs`、`tests/cloud.mjs`、`supabase/04-shared-profiles.sql` |
| 互动门禁、数据加载与实时协调 | `src/interactions/runtime.js` | `loadTogether()`、`resetTogether()`、`initTogetherUI()`；只有成员有入口，读取互动表并刷新各功能 | `tests/together-ui.mjs`、`supabase/05-together-features.sql` |
| 纪念日 | `src/interactions/milestones.js`、`src/interactions/milestones-template.js` | `milestoneHome()`、`openMilestones()`；日期算法在 core/dates；不订阅 Realtime | `tests/together-ui.mjs`、`tests/together-db.mjs` |
| 心情瓶子 | `src/interactions/moods.js`、`src/interactions/moods-template.js` | `openBottle()`、`addMood()`、`readBottle()`；happy/sad、100 条、只计对方未读 | `tests/together-ui.mjs`、`tests/together-db.mjs` |
| 消息与条目红点 | `src/interactions/notifications.js`、`src/interactions/notifications-template.js` | `itemUnreadBadge()`、`markItemRead()`、`openMessages()`；操作通知由数据库触发器生成 | `tests/together-ui.mjs`、`tests/together-db.mjs` |
| Pages 打包与发布 | `scripts/build_pages.py`、`.github/workflows/pages.yml` | 只发布 HTML、src/、styles/、生成配置；禁止漏传模块或打包 SQL/测试 | `tests/build.mjs` |
| 模块与回归检查 | `scripts/check.py`、`tests/helpers/app.mjs`、`tests/helpers/parity.mjs`、`tests/fixtures/ui-contracts.json` | 测试真实模块；20 个重构前 DOM 摘要及 289 条原样式规则的语义/顺序摘要 | `npm test` |

## 样式地图与顺序

`styles/app.css` 只声明加载顺序，顺序来自原单文件，不可随意交换：

| 文件 | 修改范围 |
|---|---|
| `styles/base.css` | 主题变量、页面骨架、侧栏、头部、按钮和搜索基础 |
| `styles/collection-layout.css` | 原收藏卡片、首页、时间线、日历与地图基础 |
| `styles/dialogs.css` | 通用编辑弹窗与表单 |
| `styles/collection-headings.css` | 标题、副标题和音乐封面比例 |
| `styles/responsive.css` | 原有全站断点；仅处理跨模块布局 |
| `styles/effects.css` | 按钮、背景与搜索动效 |
| `styles/collections.css` | 封面、类型标签、进度与时长条补充 |
| `styles/auth.css` | 未登录状态与登录区 |
| `styles/profiles.css` | 左上角头像、昵称和菜单 |
| `styles/travel-map.css` | 地图层级、瓦片失败状态和引导 |
| `styles/details.css` | 游戏封面无遮挡、详情、酒店、环绕相册和大图 |
| `styles/interactions.css` | 纪念日、瓶子、消息、未读徽标与窄屏样式 |

## 模块契约：增加或删除功能时怎么做

1. 先定位上表对应功能，只阅读它、直接依赖和测试；不要把整个项目塞回一个脚本。
2. 纯函数直接 import；有状态的功能导出 `createX(app)`，从 `app.state` 读状态，返回命名接口。跨功能调用用 `app.actions.接口名()`，不要把函数挂到 window。
3. 在 `src/registry.js` 注册控制器；有静态弹窗就注册对应 `*-template.js`，不要往骨架堆功能 HTML。重复接口名会在启动时报错。
4. 新功能独立保存本地草稿；确需跨模块协调时才扩展 `src/core/state.js`。会话切换后的异步操作必须检查 cloudEpoch，不能恢复退出前的数据。
5. 监听器用 `app.events.listen()`，计时器用 `app.timers`；退出保留原业务清理，应用销毁用 `app.dispose()`。请求可通过 `app.services.fetch` 注入测试替身。
6. 删除功能时先搜索它的对外接口，清理注册、模板、样式、协调器调用和测试；不要用空函数掩盖缺失接口，不要为删除 UI 自动删除数据库历史记录。
7. 涉及数据库时新增编号迁移并保留 RLS/RPC 契约，不擅自重跑 A 或改写已经部署的数据。更新本表一行，同时更新关联测试、README 和必要的迁移说明。
8. 执行 `npm ci --ignore-scripts`、`npm test`，再构建、提交和部署。刻意改动界面时可更新相应 UI 摘要，但必须先人工检查变化，不能为了让测试通过盲目重录。

## 数据与部署边界

- `shared_items.content` 仍为 JSON text；现有条目不迁移、不更换 ID。
- `replace_shared_item(p_id,p_content,p_expected_content)`、成员 RLS、Auth 和 Realtime 契约原样保留。
- 个人资料、纪念日、心情与通知表及权限见 `supabase/README.md`；本次整理没有修改 SQL。
- R2 密钥只在 Worker；Supabase 真实配置仍由 GitHub Actions 变量生成，不提交仓库。
- 旧单文件下载包和临时预览都不是源码；唯一维护依据是远端最新分支。
- 发布地址保持 https://jaime-lannister-debug.github.io/Two-of-us/ 。部署成功与正式数据库已执行迁移是两件事。

## 最近维护记录

| 日期 | 变更 | 回到这里后优先读 |
|---|---|---|
| 2026-10-20 | 原生模块化整理；保留界面、数据与权限；增加模块契约、DOM/样式一致性与产物检查 | 本地图 → `src/registry.js` → 目标功能行 |
