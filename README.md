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

部署时上传 `index.html`、`shared.html`、实际的 `supabase-config.js` 到同一目录。若部署平台直接从 Git 构建，需要通过该平台的环境变量生成配置文件，或单独配置发布文件；当前仓库没有自动部署工作流，提交不会由本仓库新增工作流自动部署。

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
- 图片暂用压缩后的 data URL，最多 300,000 字符；未迁移 Storage。
- DELETE 通知可能暴露删除 UUID 元数据；多空间严格隔离需私有 Broadcast。
- 单文件仍有内联脚本/样式；移除 img onerror 不代表已经满足 strict CSP。

迁移日期：2026-10-19。旧设备上的下载包不是今后的源码依据，后续以仓库最新提交为准。
