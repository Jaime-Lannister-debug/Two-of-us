# Two of Us · 两个人的小宇宙

原生 HTML / CSS / ES Modules + Supabase Auth、Postgres、RLS、Realtime；图片通过现有 Worker 上传 Cloudflare R2。

**维护先读 [project map.md](project%20map.md) 与 [AGENTS.md](AGENTS.md)。** 地图按功能列出源码、模板、依赖和测试；每增加或删除功能都要更新相应一行。检查脚本会要求所有新模块和样式登记在地图中。

## 项目结构

| 位置 | 责任 |
|---|---|
| `shared.html`、`index.html` | 网页骨架与访问入口 |
| `src/main.js`、`src/app.js`、`src/registry.js` | 启动、装配与功能注册 |
| `src/core/` | 状态、配置、生命周期、DOM、错误、数值与日期 |
| `src/shell/` | 导航、搜索、背景和交互动效 |
| `src/auth/`、`src/data/`、`src/profiles/` | 登录、账号操作、收藏数据库访问、头像与昵称 |
| `src/collections/` | 收藏列表、编辑、详情、游戏/电视剧、音乐、日历、旅行 |
| `src/media/` | 图片压缩与 R2 上传 |
| `src/interactions/` | 纪念日、心情瓶子、条目消息及互动实时协调 |
| `styles/` | 外置样式；`app.css` 保留原始级联顺序 |
| `supabase/` | 权限迁移与数据库说明，不发布到 Pages |
| `scripts/`、`tests/` | 构建、静态检查、真实模块与隔离数据库验证 |

这次整理只改变源码组织：原有外观、功能、条目格式、详情 URL、SQL、RPC、RLS、Supabase/R2 配置和托管地址不变，没有新数据库迁移。旧单文件下载包不再是维护依据，不要用它覆盖远端。

## 本地运行

复制 `supabase-config.example.js` 为 `supabase-config.js`，填写 Project URL、浏览器 public/publishable key、SHARED_ID，保留成员方案。真实配置被 Git 忽略，不要提交数据库密码或 service_role。

```sh
python3 -m http.server 8000
```

打开 http://localhost:8000/ 。原生模块需要 HTTP/HTTPS，不能双击 file://。运行网页不需要 npm 或前端打包器；npm 仅安装开发测试依赖。

## 验证

需要 Python 3 和 Node.js 22：

```sh
npm ci --ignore-scripts
npm test
```

- `scripts/check.py`：模块路径、项目地图、外部配置、所有 JS 语法及模块/功能/构建检查。
- `tests/app-contract.mjs`：模块接口、状态隔离、模板 id、幂等启动和资源清理。
- `tests/cloud.mjs`、`menu.mjs`：数值与空坐标、数据请求、并发提示、退出竞态、个人资料与菜单。
- `tests/cover-upload.mjs`、`travel-map.mjs`、`details-and-music.mjs`：R2、地图、详情、照片限制、酒店、时长、QQ 音乐。
- `tests/together-ui.mjs`、`together-db.mjs`：纪念日、心情未读、消息、容量及实际执行的隔离 PostgreSQL RLS / 触发器检查。
- `tests/ui-parity.mjs`：20 个重构前 DOM 摘要及 289 条样式规则的内容/顺序一致性；故意改界面时先人工检查，再更新对应摘要。
- `tests/build.mjs`：发布产物必须含全部模块和样式，不含 SQL、测试、node_modules 或维护文档。

这些测试使用虚构账号和替身网络，不读取真实配置、不连接正式数据库、不发送邮件或上传照片。正式项目的双账号 Realtime/RLS 验收见 `supabase/README.md`，不能把隔离测试当成已经操作了正式项目。

## 数据库与权限

现有项目继续使用成员方案 B；**不要单独重跑方案 A**。

- `01-option-a.sql`：最初建表与原子编辑 RPC，供首次初始化使用。
- `02-option-b-members.sql`：成员授权、一次性邀请与双人上限。
- `03-bootstrap-owner.sql`：管理员指定第一位成员。
- `04-shared-profiles.sql`：双人昵称、头像和资料订阅。
- `05-together-features.sql`：纪念日、心情、阅读回执、条目通知及对应 Realtime publication。

如果尚未启用上轮的新互动功能，在 Supabase SQL Editor 完整执行 05，再刷新网页。本次模块化不要求重新执行任何 SQL，也不会自动代替你执行迁移。

收藏继续使用 shared_items.content JSON text；编辑 RPC `replace_shared_item(p_id,p_content,p_expected_content)` 在数据库检查旧内容并 UPDATE，保留 UUID、创建者和创建时间。条目监听 INSERT/UPDATE/DELETE；DELETE 仅触发受 RLS 约束的重新查询。当前 DELETE 通知可能包含删除 UUID 元数据，多空间严格隔离需另设计私有 Broadcast。

## 已有功能与边界

- 五类收藏、分类/标签/状态筛选、200ms 搜索、评分、详情、表单焦点管理和 JSON 导出。
- 游戏封面无遮挡、累计小时条；电视剧集数/当前集；其他类型不保存脏进度字段。
- 旅行地图用 OSM，无需 API key；先点地图再新增，或填写 WGS84 坐标。空值丢弃，明确 0 坐标有效。支持日期区间、多个酒店，详情最多十张照片（含封面），中心封面与周围照片、查看大图与移除引用。
- 本地封面 400px / JPEG .6，相册 1000px / JPEG .75；通过 Worker 预签名 PUT，content 仅保存公开 URL。旧 data URL 与手填链接兼容。R2 原对象不会随移除引用自动删除，失败/取消可能留下未引用对象。头像压缩与资料表保持原方式。
- QQ 音乐读取官方 JSONP 元数据，不下载歌曲；纯短链接可能需要完整分享文字或展开的详情地址，接口失效仍可手填。
- 左上角双人头像、昵称、连接状态和菜单；菜单包含导出、邀请、加入、资料、退出。
- 首页纪念日按本地日期纯计算，不建 Realtime 订阅；开始当天第 1 天，2 月 29 日在平年按 2 月 28 日纪念。
- 好/坏心情瓶独立，两人每瓶合计 100 条，满瓶保留内容；只计对方未读，阅读回执跨设备保存，不是聊天。
- 数据库在条目增删改同一事务内给对方生成消息，自己的操作不产生自己的未读；昵称和标题快照在删除条目后仍保留。

公开 R2 地址与 Worker 在 `src/core/config.js`，没有新增密钥。公开图片持链接可访问；网页壳公开不代表共享数据允许匿名读取。

## GitHub Pages 部署

现有地址：https://jaime-lannister-debug.github.io/Two-of-us/

现有流程不变：master 提交触发 `.github/workflows/pages.yml`，检查成功后运行 `scripts/build_pages.py`。首次配置时在 Settings → Pages 选择 GitHub Actions，在 Actions Variables 设置 `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`。真实公共 key 只写入部署产物，不提交源码。

只发布 `index.html`、`shared.html`、`src/`、`styles/`、生成的 `supabase-config.js` 和 `.nojekyll`。自行上传静态托管时也必须带上这两个目录，不能再只上传一个 HTML。

邮箱确认跳转地址在 Supabase Authentication → URL Configuration 设置；配置变化、正式 SQL 执行或成员邀请不由部署流程自动代办。
