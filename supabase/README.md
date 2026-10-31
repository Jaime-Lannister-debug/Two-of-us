# 两个人共享条目：修复版

## 文件与运行

- shared.html：网页骨架；原生模块在 src/，样式在 styles/，功能定位见根目录 project map.md。
- supabase-config.js：唯一运行配置来源。已配置包中直接提供；源码包中将 supabase-config.example.js 复制为此文件再填写。
- 01-option-a.sql：首次初始化表、基础 RLS、编辑 RPC 与 Realtime；已有 B 的项目不要单独重跑。
- 02-option-b-members.sql：在基础 SQL 上升级成员授权，附一次性邀请码 RPC。
- 03-bootstrap-owner.sql：管理员手动指定第一位成员，执行前必须替换邮箱。
- src/data/items.js 与 src/auth/controller.js：模块化后的数据访问、会话与条目订阅。

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

## 05：纪念日、心情瓶子与通知

在 SQL Editor 一次性完整执行 `05-together-features.sql`。依赖已启用的成员方案 B 以及 `04-shared-profiles.sql`；脚本会检查依赖并在缺失时回滚。不要重跑方案 A。新表全部启用 RLS，新功能不增加任何空间成员，也不需要数据库密码或新的前端配置。

脚本将 mood_entries、mood_reads、item_notifications 加入 supabase_realtime；milestones 不加入。若正式项目仍收不到事件，在 Database → Replication / Publications 确认上述三张表已勾选。通知触发器从迁移成功之后的条目变更开始记录，历史操作不会补发。

双账号验收：

1. A 登录，好心情瓶放一条。A 自己未读保持原值；B 登录应看到好心情未读 +1，坏心情不变。
2. B 打开好心情瓶，看到 A 的心情，未读归零；关闭、刷新、换设备登录，已读应保留。
3. B 放入一条，B 自己未读不增加，A 自动出现未读。A 再放自己的条目，A 的未读不增加。
4. 打开期间对方再发送一条，确认它没有被先前的阅读请求误标已读；点击「将当前心情标为已读」清除。
5. 第三位非成员登录，不显示新功能入口；直接 REST 查新表无数据，调用添加与已读 RPC 被拒绝；匿名不能访问。不能直接插入 mood_entries 绕过容量限制，不能写别人的回执或伪造通知。
6. 每瓶两人合计达到 100 条后不能继续放入，旧内容不丢失。临界 99 条时两人同时投放，只能有一条成功。
7. A 新增、修改、删除「王国之泪」，B 有铃铛未读和消息，A 没有自己操作的消息；未删除的卡片有红点。点卡片或已展示消息后红点消失；删除消息仍保留标题与当时昵称。
8. 消息中心打开期间发生新修改，新消息仍未读；两台属于同一账号的设备阅读后，另一台的状态也应同步。
9. 首页添加开始日、生日和第一次约会；当天为第 1 天；跨年、闰年与 2 月 29 日倒计时正确。另一人重新打开网页后能看到修改；纪念日无实时订阅。

隔离 PostgreSQL 与 DOM 的上述核心验证已自动化，不代表已在正式 Supabase 和真实账号中执行。


## 模块化维护

2026-10-20 的工程化整理没有修改本目录 SQL 或正式数据库，不需新迁移。新路径与每项功能对应关系请读根目录 `project map.md`；新增功能涉及数据库时新增编号 SQL 并更新地图、说明和测试，不把旧单文件重新上传覆盖模块化网页。

## 06：纪念日对方提醒

在 SQL Editor → New query 完整执行 `06-milestone-notifications.sql`。依赖已有 05，可重复执行；不重跑 A/B/05，不改变现有记录或 RLS，也不增加空间成员。新触发器把纪念日新增、修改、删除写入原 item_notifications，item_cat 为 milestone；只发给另一位成员，不发给操作本人。消息到达后页面会重新读取完整纪念日列表，milestones 仍不加入 Realtime。

验收：A 新增生日 → B 铃铛及「我们的纪念日」未读 +1 → 点击通知进入板块，看到完整列表且已读消失；B 修改/删除 → A 收到对应昵称与纪念日标题。第三账号无权查看纪念日或消息，也不能伪造提醒。只记录迁移执行后的操作，不补发历史消息。网页发布不代表已经在正式数据库执行了该脚本。

## 07：双人账本

成员方案 B + 04 后执行 `07-ledger.sql`，与 05/06 相互独立。新增账目、金额分配、分类、凭证表和只允许成员调用的 RPC。写入只走服务端事务，检查创建人、分摊合计、类别归属、日期、版本和幂等请求。只有创建者可以编辑和软删除，报表和正常列表排除软删除。金额 bigint 分，RPC 返回字符串；汇总不受分页影响。ledger_entries 加入 Realtime，订阅 INSERT/UPDATE，删除通过受 RLS 保护的 UPDATE 同步。凭证读写权限 RPC 与 Worker 设置见 docs/ledger.md。

## 08：消费用途

在 Supabase SQL Editor 完整执行 `08-ledger-purpose.sql`，依赖已执行的 07；可重复执行，不重跑 07。新增 purpose 字段（self 自己消费 / romance 恋爱消费），与一起/各自消费及金额分配独立，收入也可归类。旧账保持 NULL 未分类，不回填猜测。迁移保留原权限、版本和幂等检查；明细筛选及月报/年报按用途汇总。新版网页检测 bootstrap.purpose_enabled，未升级时保存提示执行 08，避免字段被旧 RPC 静默忽略。

## 09：纪念日的纪念记录

在 SQL Editor 完整执行 `09-milestone-memories.sql`，依赖成员方案 B、04 和 05。可重复执行，只执行 09，不重跑旧迁移。新表 milestone_memories 按父纪念日关联，包含日期、活动、感想和最多 5 个 HTTPS 照片 URL。RLS 仅允许空间成员读取，写入走 RPC；本人才能编辑或软删除，版本检查避免覆盖。INSERT/UPDATE 已注册 Realtime，正常列表排除软删除记录。删除父纪念日会级联删除其记录。

双方可各自添加、多次纪念记录按日期倒序；照片沿用原旅行 R2 上传服务，不修改桶权限或凭证 Worker。图片链接访问规则与现有旅行照片一致；数据库权限不替代图片服务权限。正式双账号与真实上传仍需部署后验证。
