# Two of Us · 两个人的小宇宙

原生单文件 HTML + Supabase Auth / Postgres / RLS / Realtime 的情侣共享清单。

## 换设备后继续维护

1. 在有本仓库访问权限的 Codex 中打开或检出此仓库。
2. 让助手先读 `AGENTS.md` 和本文，再说明需要修改的功能。
3. 从最新远端分支继续，不要用旧设备的 HTML 覆盖远端。
4. 改动通过检查后提交 Git；发布仍使用现有部署平台。

本仓库是源码与维护记录的长期来源。GitHub 连接可以用于访问文件；若要运行代码、预览或部署，新设备/云端会话仍需要可用的仓库工作环境。普通聊天与 Codex 工作目录不会因仓库存在而自动绑定。

## 文件

- `shared.html`：唯一前端源码，含视觉、交互及 Supabase 数据层。
- `index.html`：跳转到 shared.html 的首页入口。
- `supabase-config.example.js`：项目配置模板，不包含实际项目 key。
- `supabase/01-option-a.sql`：固定空间权限方案及编辑 RPC。
- `supabase/02-option-b-members.sql`：成员表、一次性邀请码，推荐方案。
- `supabase/03-bootstrap-owner.sql`：管理员指定第一位成员，执行前替换邮箱。
- `supabase/README.md`：详细权限、部署、验收与已知限制。
- `scripts/check.py`、`tests/`：无第三方依赖的脚本语法及模拟数据层检查。

## 配置与运行

复制 `supabase-config.example.js` 为 `supabase-config.js`，填写 Project URL、publishable key、SHARED_ID。该文件被 Git 忽略，换设备需重新配置。不要在聊天中提供数据库密码或 service_role。

当前共享空间标识为 `our-shared-space`；推荐配置 `ACCESS_MODE: 'members'`。这是前端 UI 设置，真正权限仍由数据库 RLS 决定。实际 Supabase SQL 执行状态及目前部署平台尚未从服务端确认。

```sh
python3 -m http.server 8000
```

访问 http://localhost:8000/ 。

部署时上传 `index.html`、`shared.html`、实际的 `supabase-config.js` 到同一目录。若部署平台直接从 Git 构建，需要通过该平台的环境变量生成配置文件，或单独配置发布文件；仓库现在包含 GitHub Pages 自动部署流程，按下方首次配置完成后，master 提交会自动发布。

Supabase 保存用户记录，GitHub 保存程序源码；数据库内容、JSON 备份、邀请码和账号会话不提交仓库。

## 数据库

首次安装按详细说明执行基础 SQL，再升级成员方案并指定首位成员。**已使用成员方案 B 的数据库不要单独重跑 A**，否则会退回固定空间授权。

编辑 RPC 为 SECURITY DEFINER + UPDATE，显式检查登录、空间成员与旧 content，保留 id / created_by / created_at。前端监听 INSERT / UPDATE / DELETE；DELETE 只触发受 RLS 保护的重新查询，不展示事件数据。

控制台 Database → Replication / Publications 的 supabase_realtime 必须包含 shared_items。

## 检查

Python 3 加 Node.js，或 macOS 自带 JavaScriptCore：

```sh
python3 scripts/check.py
```

检查覆盖语法、配置引用、空坐标、数值约束、脏进度字段清理、图片上限、并发提示、数据库请求构造、加载和退出竞态。不会操作真实数据库或发送邮件。

真实 RLS、邀请码和双账号实时同步仍需在测试项目中按 `supabase/README.md` 验收。

## 当前实现与限制

- 五个板块、封面、评分、游戏时长、电视剧进度、地图和日历。
- 搜索防抖、模态框焦点管理、键盘卡片操作、JSON 导出。
- 已移除无效 seeds / switchCatalog，HTML 约 60 KB。
- 新上传封面压缩为最长边 400px、JPEG 质量 0.6，经 Worker 预签名 PUT 到 R2；条目保存公开 URL。旧封面 data URL 和手工链接仍兼容。个人头像压缩方式不变。
- DELETE 通知可能暴露删除 UUID 元数据；多空间严格隔离需私有 Broadcast。
- 单文件仍有内联脚本/样式；移除 img onerror 不代表已经满足 strict CSP。

迁移日期：2026-10-19。旧设备上的下载包不是今后的源码依据，后续以仓库最新提交为准。

## GitHub Pages 首次启用

1. 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
2. Settings → Secrets and variables → Actions → Variables 新建两个仓库变量：
   - `SUPABASE_URL`：你的 Supabase Project URL。
   - `SUPABASE_PUBLISHABLE_KEY`：之前提供的 sb_publishable_ 开头公共 key。
3. Actions → Deploy GitHub Pages → Run workflow，分支选择 master。
4. 等待 build 与 deploy 都成功。网址由 GitHub 的 deployment 输出确认；本项目预期为 https://Jaime-Lannister-debug.github.io/Two-of-us/ 。不要把预期 URL 当作已上线验证。

部署只上传网页和生成的配置，不包含 SQL、测试、README 或数据库内容。public key 仅写入构建产物，不提交源码。GitHub Pages 的网页公开访问，但条目仍需登录并通过 Supabase 成员 RLS；上线不等于授予任意访问者读取记录的权限。

邮箱确认若跳转地址仍是 localhost，请在 Supabase Authentication → URL Configuration 将 Site URL 及允许的确认跳转地址改为当前 Pages 站点；本次部署不会自动修改 Supabase 设置。

首次缺少变量或尚未启用 Pages 时，工作流会明确失败；补齐设置后重新运行即可。

## 双人头像、昵称与左上角菜单（2026-10-19）

用户确认 GitHub Pages 已可打开。最新个人资料功能需另在 Supabase SQL Editor 执行 `supabase/04-shared-profiles.sql`（基于已启用的成员方案 B），无需重跑 A/B，也不修改现有条目。

左上角显示两位成员的头像与昵称，并显示“实时同步已连接”“共享列表已更新”等状态。点击双人头像打开菜单，包含个人头像/昵称设置、JSON 导出、生成邀请码、邀请码加入及退出。

个人头像自动居中裁剪为 192×192 JPEG，最多 60,000 字符；昵称最多 24 字。空昵称使用 A/B，双方以成员 UUID 排序，显示顺序一致。资料仅本人可写，同一空间成员可读；不会把昵称或图片提交 GitHub。

SQL 新建 shared_profiles、RLS、get_shared_people RPC，并将资料表加入实时复制。前端使用独立资料订阅；未执行 SQL 时菜单会提示个人资料同步未启用，原条目列表仍能使用。

验收：两人分别登录；设置自己的昵称/头像，另一端应自动更新；刷新后保留；不能修改他人的 user_id 资料；非成员不能读取 get_shared_people；退出后清空；手机和桌面左上角菜单可开合，键盘方向键/Escape/Tab 可操作，个人资料对话框焦点不能跳到背景。

资料相关模拟测试覆盖头像协议/大小、昵称默认值、读取与实时过滤、退出后的旧响应丢弃。SQL 及真实双账号头像同步尚需在项目内验收。

## R2 封面上传（2026-10-19）

上传签名接口：https://r2-presigner.baopengtoskr.workers.dev/
公开图片根地址：https://pub-e97c7ebcf6e7475d85a27152bc869d5f.r2.dev

这两个公开地址是 shared.html 的封面相关常量。R2 访问密钥只保存在 Worker，不进前端和仓库。Worker POST 接收 filename/contentType，并使用现有 Supabase 会话 Bearer token 核验空间成员；浏览器取得 uploadUrl 后仅用 Content-Type:image/jpeg PUT，不向 R2 发送 Supabase token。

保留图片链接输入框。上传失败不覆盖旧链接；成功后仍需点击“保存记录”，公开 URL 才写入 Supabase 并同步给对方。个人头像未迁移。旧封面不自动重传或删除；取消编辑可能留下已上传但未被条目引用的对象。

R2 covers 桶的 CORS 必须允许 https://jaime-lannister-debug.github.io 的 PUT/GET，及 Content-Type 请求头。当前只读 Worker 检查 GET=405 JSON、OPTIONS=204，来源与 Authorization/Content-Type 预检正常；未用真实成员 JWT 做实际上传。

Node 环境下 python3 scripts/check.py 会运行 tests/cover-upload.mjs，验证压缩、POST/PUT、只保存 URL、上传失败保留旧值和手填链接；测试不连接真实 R2。

## 旅行地图修复与使用

CARTO 原匿名底图出现 API key required 水印，当前改用 OpenStreetMap 标准瓦片，无需地图 key，保留可见版权署名，适用于本项目两人低流量交互查看。地图建立独立层叠上下文，条目编辑与个人资料弹窗位于其上方，Leaflet 控件和提示不再穿透弹窗。

打开旅行足迹 → 在地图点击目的地（可缩放或拖动）→ 点击新增回忆，表单会带入所选经纬度 → 填写目的地、日期、游玩及住宿信息 → 保存记录。地图标点来自数据库条目 lat/lng；仅填写地点名称不会自动地理编码。也可在表单手动填写 WGS84 纬度（-90～90）和经度（-180～180）。单条有效行程会自动居中，多条会自动适配范围。空坐标不会被误认为 0,0。

标点与行程通过现有 Supabase 同步，不需新的 SQL。底图依赖 Leaflet CDN 与 tile.openstreetmap.org 的正常网络访问；网络错误会提示，时间线和记录仍可使用。不要批量抓取、预下载或隐藏版权标注。若以后流量明显增加，应换用适合该流量的底图服务。

地图模拟测试覆盖底图来源和署名、弹窗层级声明、空/合法零坐标、单点居中、瓦片失败提示、点击选点；尚未使用真实账号做浏览器地图交互验收。

## 条目详情、旅行相册与 QQ 音乐（2026-10-20）

点击卡片／旅行时间线进入详情页，点击「编辑这份回忆」继续使用原编辑弹窗。详情页地址使用 `shared.html#item=记录UUID`，刷新或分享同一地址可重开；查看者仍需登录并是同一空间成员。无须 SQL 迁移，新增字段存于原 content JSON，旧条目兼容。

游戏封面不再叠加名称、评分和平台文字，这些信息显示在图片下方。游戏不再存完成百分比或集数字段；时间条表示累计小时，默认 100 小时标尺，超出后以 50 小时扩展，完成状态手动设置。电视剧仍使用集数进度。

旅行支持开始／结束日期及最多 20 家酒店，每家可填写入住、退房和备注，旧 hotel 字符串会读取为第一家酒店。保存记录后在详情页上传最多十张图片（含封面）；封面居中，其余环绕，点击查看大图，移除封面后下一张成为封面。旅行相册压缩最长边 1000px、JPEG 0.75，沿用现有 R2 Worker 和成员 JWT；原编辑表单封面仍为 400px、JPEG 0.6。照片列表通过原乐观并发 RPC 保存并实时同步；同时修改冲突时不会覆盖他人内容，重新打开后重试。取消或保存失败可能留下未被引用的 R2 对象，移除照片只解除引用，不物理删除 R2 文件。公开 R2 照片持链接可访问。

音乐编辑中粘贴 QQ 音乐歌曲／专辑详情链接，或包含歌名、歌手的完整分享文字，点击「读取音乐信息」再确认保存。QQ 官方 JSONP 接口读取标题、歌手和专辑封面，不下载歌曲、不获取播放授权。纯短链接可能无法解析，需要完整分享文字或展开后的详情链接；接口不可用时仍可手工填写标题、简介与封面链接。

检查：`python3 scripts/check.py` 包括详情渲染、旧酒店迁移、日期范围、照片十张上限、照片保存并发契约、游戏时长和 QQ 分享链接／元数据模拟。真实项目双账号、真实 R2 多图及 QQ 浏览器网络仍应在登录后验收。
