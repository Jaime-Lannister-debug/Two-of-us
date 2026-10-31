# Two of Us · Project Map

这是维护入口。上下文压缩或换设备后，先读本文件，再读 AGENTS.md，只打开目标功能对应的文件。

**最新修复**：图片共用有超时/重试/取消的上传服务；纪念日独立板块显示全部记录；提醒需在正式 SQL Editor 执行 `supabase/06-milestone-notifications.sql`。06 不修改 RLS 或历史记录。

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
| 本地封面 / R2 图片上传 | `src/media/covers.js` | `setupCoverUpload()`、`compressTravelImage()`、`uploadR2Photo()`；原格式原图封面、1000px/.75 相册 | `tests/cover-upload.mjs` |
| QQ 音乐分享解析 / 信息读取 | `src/collections/music-link.js`、`src/collections/music.js` | `qqShareInfo()` 纯校验；`readQQMusic()`、`setupMusicImport()`；官方 JSONP，不下载歌曲 | `tests/details-and-music.mjs` |
| 头像、昵称与双人菜单 | `src/profiles/model.js`、`src/profiles/controller.js`、`src/profiles/template.js` | `initPeopleUI()`、`loadPeople()`、`renderPeople()`；独立资料订阅 | `tests/menu.mjs`、`tests/cloud.mjs`、`supabase/04-shared-profiles.sql` |
| 互动门禁、数据加载与实时协调 | `src/interactions/runtime.js` | `loadTogether()`、`resetTogether()`、`initTogetherUI()`；只有成员有入口，读取互动表并刷新各功能 | `tests/together-ui.mjs`、`supabase/05-together-features.sql` |
| 纪念日 | `src/interactions/milestones.js`、`src/interactions/milestones-template.js` | `milestoneHome()`、`openMilestones()`、`allMilestones()`；完整板块在 milestones-page，通知驱动重读；日期算法在 core/dates；不订阅 Realtime | `tests/together-ui.mjs`、`tests/together-db.mjs` |
| 心情瓶子 | `src/interactions/moods.js`、`src/interactions/moods-template.js` | `openMoodComposer()`、`addMood()`、`readMood()`；happy/sad、100 条、展开单条后才已读、只计对方未读 | `tests/together-ui.mjs`、`tests/together-db.mjs` |
| 心情瓶子二级页 / 双瓶历史 | `src/interactions/moods-page.js` | `openMoodPage()`、`renderMoodPage()`、`refreshMoodPage()`；单一侧栏入口、#view=moods，实时刷新不打断草稿 | `tests/mood-bottles.mjs`、`tests/together-ui.mjs` |
| 五角星碰撞 / Canvas 生命周期 | `src/interactions/bottle-physics.js`、`src/interactions/star-bottles.js` | `makeStars()`、`stepStars()`、`mountStarBottles()`、`shakeBottle()`；粉/蓝星、100 上限、离页销毁与减少动态效果 | `tests/mood-bottles.mjs` |
| 纸飞机展开 / 单条阅读回执 | `src/interactions/mood-airmail.js` | `showMoodLetter()`、`closeMoodLetter()`；展开后只确认当前消息，提前关闭/退出取消回执 | `tests/mood-bottles.mjs` |
| 消息与条目红点 | `src/interactions/notifications.js`、`src/interactions/notifications-template.js` | `itemUnreadBadge()`、`markItemRead()`、`openMessages()`；操作通知由数据库触发器生成 | `tests/together-ui.mjs`、`tests/together-db.mjs` |
| Pages 打包与发布 | `scripts/build_pages.py`、`.github/workflows/pages.yml` | 只发布 HTML、src/、styles/、生成配置；禁止漏传模块或打包 SQL/测试 | `tests/build.mjs` |
| 模块与回归检查 | `scripts/check.py`、`tests/helpers/app.mjs`、`tests/helpers/parity.mjs`、`tests/fixtures/ui-contracts.json` | 测试真实模块；20 个 DOM 回归摘要，其中首页和心情弹窗是经人工核对的有意更新；原样式加独立心情样式的语义/顺序摘要 | `npm test` |

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

| `styles/mood-bottles.css` | 透明双瓶、星星、心情二级页与纸飞机展开；加载在原样式之后 |

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

| 2026-10-20 | 心情入口合并、双透明星星瓶、点击碰撞与纸飞机阅读；沿用现有 SQL | `src/interactions/moods-page.js` → `src/interactions/moods.js` → 动效模块 |

## 2026-10-20：上传超时与纪念日板块/通知修复

| 功能 | 主要文件 | 入口与依赖 | 验证 |
|---|---|---|---|
| R2 统一上传 / 有限重试 | `src/media/r2-upload.js` | `uploadR2Photo()`、`cancelImageUploads()`；60s 签名 / 180s PUT、响应体计时、临时失败重试一次，退出中止、压缩后再次检查会话；封面和旅行共用 | `tests/cover-upload.mjs`、`tests/r2-resilience.mjs` |
| 纪念日独立板块 / 完整列表 | `src/interactions/milestones-page.js`、`styles/milestones.css` | `openMilestonePage()`、`refreshMilestonePage()`；#view=milestones，分页加载全部，首页改摘要 | `tests/milestones-page.mjs`、`tests/together-ui.mjs` |
| 纪念日对方通知 | `supabase/06-milestone-notifications.sql`、`src/interactions/notifications.js`、`src/interactions/runtime.js` | SQL Editor 执行 06；触发器复用 item_notifications、接收人 RLS 与已读 RPC；消息到达后重新取纪念日，无 milestones Realtime | `tests/together-db.mjs`、`tests/milestones-page.mjs` |

06 需要管理员在正式 Supabase 手动执行，网页发布不等于数据库迁移已执行。新提醒仅从执行后开始记录，不补发历史操作。

## 2026-10-20：侧栏对齐修复

| 功能 | 主要文件 | 入口与依赖 | 验证 |
|---|---|---|---|
| 侧栏文字、图标与悬停框对齐 | `styles/sidebar.css`、`src/shell/navigation.js`、`shared.html` | 固定图标栏、显式文字栏；三项收藏状态文字居中，分类文字左对齐；按钮保持高度，悬停不位移；手机分类三列两行 | 浏览器桌面/窄侧栏/390px 的位置及悬停检查；`tests/ui-parity.mjs` |

## 2026-10-22：双人账本（feature/ledger）

| 功能 | 主要文件 | 入口与依赖 | 验证 |
|---|---|---|---|
| 账本按需入口 / 成员门禁 | `src/ledger/controller.js`、`src/ledger/state.js` | `openLedger()`、`activateLedger()`；#view=ledger，独立状态与会话清理 | `tests/ledger-ui.mjs`、原有界面回归 |
| 金额精度 / 日期 / 环比 | `src/ledger/money.js` | 字符串解析为整数分、BigInt 计算、固定成员排序分配余分；北京时间默认日期 | `tests/ledger-money.mjs` |
| 数据访问 / 完整统计 | `src/ledger/data.js` | ledger_* RPC、相同筛选条件下分页与全部合计；金额字符串 | `tests/ledger-db.mjs` |
| 记账 / 详情 / 自定义分类 | `src/ledger/editor.js` | 原生 dialog、本人编辑删除、分摊验证、凭证失败保留；复用注册/生命周期 | `tests/ledger-ui.mjs` |
| 明细 / 实时同步 | `src/ledger/workspace.js` | 分类/年月/性质/人员/关键词筛选；INSERT/UPDATE（软删除）空间过滤；草稿独立 | `tests/ledger-ui.mjs` |
| 月报 / 年报 / 轻量趋势 | `src/ledger/reports.js`、`styles/ledger.css` | 全量 SQL 聚合、承担与收付分开、12 月 SVG 和精确金额表；样式只影响账本 | `tests/ledger-db.mjs`、`tests/ledger-ui.mjs` |
| 私有 R2 凭证 | `src/ledger/receipts.js`、`workers/ledger-receipts.js`、`workers/wrangler.ledger.jsonc` | 原有私有桶，独立 Worker binding；鉴权上传/读取、本地 Blob URL，无公开图片链接 | `tests/ledger-worker.mjs` |
| 账本 SQL 与权限 | `supabase/07-ledger.sql` | 独立 entries/allocations/categories/receipts、服务端校验、本人写权限、版本检查与幂等；不改旧 RLS | `tests/ledger-db.mjs` |

部署说明见 `docs/ledger.md`。分支开发不自动执行正式数据库迁移或部署 Worker；正式 Pages 仍只由 master 发布。

## 2026-10-24：消息逐条确认与消费用途

| 功能 | 主要文件 | 入口与依赖 | 验证 |
|---|---|---|---|
| 消息逐条移出 | `src/interactions/notifications.js`、`src/interactions/notifications-template.js`、`src/interactions/runtime.js`、`styles/interactions.css` | 打开不再整批已读；「看过这条」仅调用当前 ID 的已读 RPC，列表只显示未读；回执跨设备保留，不删除共享内容 | `tests/together-ui.mjs` |
| 顶部账本入口 / 消费用途 | `shared.html`、`styles/ledger.css`、`src/ledger/editor.js`、`src/ledger/state.js`、`src/ledger/data.js`、`src/ledger/workspace.js`、`src/ledger/reports.js`、`supabase/08-ledger-purpose.sql` | 双人记账移到新增回忆旁；purpose=self/romance 与 scope、付款、分摊独立；历史 NULL 未分类；明细筛选与报表全量精确汇总；SQL 未升级时拒绝静默丢失用途 | `tests/ledger-db.mjs`、`tests/ledger-ui.mjs` |

正式项目需在 SQL Editor 完整执行 08；不要重跑 07。旧客户端写入无用途时，新记录保留未分类，编辑保留既有用途；新版填写用途后才允许保存。

## 2026-10-31：纪念日的纪念记录

| 功能 | 主要文件 | 入口与依赖 | 验证 |
|---|---|---|---|
| 纪念记录详情 / 日期 / 活动感想 / 最多五图 | `src/interactions/milestone-memories.js`、`styles/milestone-memories.css`、`src/interactions/milestones-page.js`、`supabase/09-milestone-memories.sql` | 纪念日卡片「查看纪念记录」→ #view=milestones&milestone=UUID&memories=1；独立 app.state.milestoneMemories；复用 compressTravelImage / uploadR2Photo；双方查看各自添加、本人修改删除、版本冲突；INSERT/UPDATE 订阅重读不覆盖草稿，离页/退出清理 | `tests/milestone-memories-ui.mjs`、`tests/milestone-memories-db.mjs`、完整回归 |

需管理员执行 09（依赖 05），不重跑旧脚本、不修改封面 Worker 或 R2 权限。图片沿用已有旅行上传方式，数据库只存服务返回的 HTTPS URL；移除引用不删除桶原文件。删除纪念日会同时删除其纪念记录，确认文案已明确。

| 收藏封面与纪念照片显示 | `styles/collection-layout.css`、`styles/collections.css`、`styles/milestone-memories.css` | 收藏卡片与旅行列表完整显示封面，纪念照片限制尺寸并保持比例；不改变已上传图片 | `tests/ui-parity.mjs`、完整回归 |

收藏有图封面容器随图片原始比例调整，消除固定比例容器产生的侧边空白；无图占位仍使用原比例。

纪念照片点击放大复用 `#photoLightbox`，上传预览及已保存照片均可打开；关闭/点击背景沿用 `src/auth/controller.js`。验证见 `tests/milestone-memories-ui.mjs`。

封面、详情图、纪念照片与旅行相册支持悬停放大容器，保留边缘；减少动态效果或触屏设备不启用悬停动效。样式入口为 `styles/collections.css`。

悬停放大统一使用 0.55 秒缓动、较小的放大幅度；覆盖旧卡片样式对 transform 过渡的冲突，避免跳动。

2026-10-31：本地封面保留原图文件及 MIME 类型，不缩放、不重编码；沿用 20 MB 上限。旧封面需使用原图重新上传。

图片上传 PUT 增加 `Cache-Control: public, max-age=2592000`，新对象建议浏览器缓存 30 天；需桶 CORS 允许 Cache-Control 请求头，旧对象不自动变化。验证 `tests/cover-upload.mjs`、`tests/r2-resilience.mjs`。
