# 两个人共享条目：修复版

## 文件与运行

- shared.html：完整网页，原生 HTML/JS，保持五个板块和原视觉动效。
- supabase-config.js：唯一运行配置来源。已配置包中直接提供；源码包中将 supabase-config.example.js 复制为此文件再填写。
- 01-option-a.sql：初始化 / 迁移表、基础 RLS、SECURITY DEFINER 编辑 RPC、Realtime。schema.sql 是同内容的兼容副本。
- 02-option-b-members.sql：在基础 SQL 上升级成员授权，附一次性邀请码 RPC。
- 03-bootstrap-owner.sql：管理员手动指定第一位成员，执行前必须替换邮箱。
- shared-cloud.js：网页内嵌云端逻辑的审阅副本；不需重复引入。

在 Supabase 项目 SQL Editor 执行 SQL；无需浏览器数据库密码或 service_role。前端继续使用 publishable key（也兼容旧 anon key）。实际配置和已配置压缩包均通过 .gitignore 排除。不要将配置包提交公开仓库。

使用 HTTP/HTTPS 运行，例如在网页目录运行 `python3 -m http.server 8000`，访问 http://localhost:8000/shared.html。正式共享放到 HTTPS 静态托管。源码未自动上传原浏览器数据。

## 修改点逐条对应

1. 删除 seeds、switchCatalog 和相关合并循环。HTML 由约 1.23 MB 缩小到约 59 KB。不再附带无效 base64 示例。
2. 提供关闭注册的 A 方案和成员表的 B 方案；B 有真实的邀请生成、加入 UI 与数据库事务。
3. replace_shared_item 使用 SECURITY DEFINER + UPDATE；显式检查登录、空间访问权限和原 content。锁定行后做乐观并发比较。保留 id、created_by、created_at。前端新增 UPDATE 订阅。
4. 日历初始化使用当前年份和月份。
5. decodeRow 和提交均跳过空 / null / undefined 经纬度；地图再次验证范围。真实 0 经度或纬度仍允许。新旅行表单不再预填示例坐标。
6. 本次采用用户允许的低风险兼容方案，不引入 Storage：压缩后 data URL 最大 300,000 字符，UI 提示，上传和保存双重检查；旧超限 data URL 解码时不渲染。图片与封面 URL 仍兼容。若要全量迁移 Storage，需要额外 bucket、访问策略和历史图片迁移，本次未实施。
7. 并发冲突提示关闭编辑窗口、刷新列表再编辑。
8. score 限定 0–10，progress 0–100，集数为非负整数，时长为非负有限数字。
9. 电影 / 音乐 / 旅行 / 亲密记录移除所有进度与集数字段；非游戏移除 playHours。
10. 配置只读外部 supabase-config.js，不再在 HTML 内重复项目占位值；未配置时显示友好提示。
11. SQL 注释和本文均提醒启用 Replication。
12. 编辑表单 role=dialog、aria-modal、aria-labelledby；Tab / Shift+Tab 焦点循环，关闭恢复触发元素。实时重绘时寻找同一条目或回到新增按钮。
13. 卡片 Enter / Space 均可打开，并阻止 Space 滚动页面。
14. 删除 HTML onerror 属性，改用 addEventListener('error')。这只消除该 CSP 阻碍，不表示整份单文件的内联脚本已满足 strict CSP；上线 strict CSP 还需脚本 nonce/hash 或外置脚本。
15. 搜索 200ms debounce，原搜索动效保留。
16. 加载提示与 aria-busy；空卡片列表显示新增引导。
17. 导出 JSON 备份，包含当前已加载记录；不导出会话、密码或项目 key。备份可能含私密记录，请自行保管。
18. 删除地图空 click 回调。
19. 所有状态筛选及表单标签统一为“将要看 / 玩、正在看 / 玩、已看 / 玩”。

## 方案 A：最低成本

1. 在 Authentication → Users 手动创建并确认两个账号。
2. 在 Authentication 的注册设置中关闭 Allow new users to sign up（菜单位置可能调整）。不能只隐藏网页注册按钮。
3. 审计项目现有用户，确认没有其他不应访问该空间的已登录账号。仅关闭新注册不会撤销旧账号访问。
4. 在 SQL Editor 执行 01-option-a.sql。
5. 外部配置 ACCESS_MODE 使用 closed，SHARED_ID 为 our-shared-space。

该方案的限制：所有项目内 authenticated 用户仍可访问固定空间，因此它依赖账号管理，不是逐空间成员授权。不能把 SHARED_ID 当作密码。

## 方案 B：成员授权，推荐

新项目先执行 01-option-a.sql，再执行 02-option-b-members.sql。已有 B 方案的项目不要单独重跑 A，因为 A 会退回固定空间授权。数据库已有其他策略时，先审计；基础脚本会替换 shared_items 的旧策略，避免 OR 放宽权限。

1. 确认两位使用者已注册、确认邮箱；也可以开放邮箱注册，让对方先注册，此时非成员读取为空、写入被拒绝。
2. 管理员将 03-bootstrap-owner.sql 的邮箱替换为第一位使用者邮箱并执行，确认返回成员记录。第一位成员不能靠网页自我授权。
3. 两人的配置 ACCESS_MODE 均改为 members，SHARED_ID 相同。
4. 第一位成员登录，点击“生成邀请码”，复制一次性码发给对方。邀请码有效期 24 小时，只保存 SHA-256 摘要，最多同时存在 5 个有效邀请。
5. 对方先登录再点击“邀请码加入”。成功后无需刷新即可重新加载共享条目。
6. 数据库加锁确保邀请一次使用且每个空间最多两位成员；已有两位、过期、重复使用、邀请者已不再是成员均拒绝。
7. 第三个已注册但未加入的账号查询为空，插入、删除和编辑 RPC 均不能访问该空间。

成员表不授予客户端写权限；不能通过直接插入 shared_members 自行加入。SQL Editor 管理员可管理成员。若需解除关系，由管理员撤销成员，并让相关浏览器退出；撤销数据库权限不会远程擦掉对方已经看到或导出的内容。

B 方案不把邀请 token 放在 URL 中。只需将邀请码通过你们自己的渠道发送；网页不会自动发送任何消息。

## SECURITY DEFINER 和 Realtime

编辑 RPC 的函数名仍叫 replace_shared_item，但现在内部只 UPDATE content。id 不变，创建者和创建时间也不变，因此卡片引用、排序和外部关联不受影响。不再使用 DELETE+INSERT，也没有新 id。函数固定 search_path=''、对象使用 schema 限定、撤销 public/anon EXECUTE，并在函数体内显式鉴权；不能依赖函数拥有者受到 RLS 约束。

前端监听带 shared_id 过滤的 INSERT、UPDATE。DELETE 仍采用不带列 filter 的通知后重新 SELECT；查询仍受 RLS。DELETE 事件自身不能逐行使用 SELECT RLS 过滤，因此跨空间可能看到删除 UUID 元数据（不显示条目内容）。若需要连删除 UUID 都不泄露的多空间隔离，应另做受成员授权的私有 Broadcast；不要把当前 DELETE 通知当作空间级保密信道。

**必须检查 Supabase Dashboard → Database → Replication（部分控制台为 Publications）→ supabase_realtime，勾选 shared_items。** 基础 SQL 同时给出等价注册语句。只开启 RLS 不会自动启用实时复制。

## 验收

- A 登录用户一，B 无痕登录用户二。A 新增，B 自动出现；B 编辑评分/进度，A 自动变化；B 删除，A 自动消失。
- 同时打开一条记录，A 先保存，B 后保存应收到冲突提示，不覆盖 A 的修改。
- 旅行空坐标不出现地图标记；(0,0) 只有显式输入两个 0 时才保留；越界、NaN、Infinity 坐标不保存。
- 游戏填写时长和进度后改为电影/音乐/旅行/亲密，保存后导出 JSON，确认进度/集数被清除。
- 测试 score=99、progress=130、负集数及非有限值的旧条目，解码显示被约束到合法范围。
- 本地超大图片压缩后仍过大时提示并不替换旧封面；手动贴超长 data URL 保存也被拒绝。
- Tab/Shift+Tab 不离开模态框；Escape 关闭；关闭后恢复焦点；Space 能打开卡片而不滚动。
- 快速输入搜索，只在最后一次输入后约 200ms 过滤。
- 未登录无列表；B 方案第三账号不能用 REST 或 RPC 越权；直接写 shared_members 被拒绝。
- 导出 JSON 能正常解析，只有条目、空间 ID、导出时间等数据，不包含项目 key 或会话。

## 测试范围

完整脚本语法及模拟数据层测试通过，覆盖空坐标/合法零/范围、数值约束、非进度类型清理、封面上限、冲突提示、共享插入/RPC、加载状态、退出后异步请求丢弃。当前环境无 PostgreSQL 服务，且阻止本地 HTTP 服务监听，因此没有宣称 SQL 已在真实项目执行或完成浏览器焦点/双账号实时验收。请按上述步骤在自己的项目验证；无需提供数据库密码或 service_role。

## 新增个人资料迁移

在 SQL Editor 执行 `04-shared-profiles.sql`，此脚本要求已经有成员方案 B 的 shared_members。只新增 shared_profiles 资料表、本人写入 RLS、成员读取 RPC 和 Realtime 注册，不修改原条目。不要重跑方案 A。

如菜单提示找不到 get_shared_people / shared_profiles，请执行本迁移后刷新。头像最大 60,000 字符，昵称最多 24 字。实时更新依赖 supabase_realtime 已包含 shared_profiles（脚本已注册）。
