# 双人记账交付与验收

开发分支：feature/ledger。保留原项目原生模块、样式、收藏、心情与消息行为。人民币单币种，发生日期为 DATE，默认北京时间今天。金额用分和 BigInt，不使用浮点加总。

## 数据库启用

已有成员方案 B、04 资料表的项目，在 Supabase SQL Editor 完整执行 supabase/07-ledger.sql。可重复执行，不重跑 01/02，不修改原收藏、互动权限。脚本只新增账本对象并把 ledger_entries 加入 supabase_realtime。

四张账本表只允许成员读取；写入只走 RPC。创建者取 auth.uid，不能编辑/删除对方记录，版本不匹配拒绝覆盖。各自消费全部归属指定的人；共同消费按平摊或自定义金额分配；付款人只表示实际资金流。共同收入同样分配，但报表显示为收入归属而非支出承担。平摊余 1 分归固定 UUID 排序的第一人，不随登录人变化。自定义可有一人分配 0，合计必须等于总额。

ledger_mutations 存在 private schema，实现幂等重试。软删除使用 UPDATE，正常明细与报表排除 deleted_at；成员 SELECT RLS 不排除软删除行以便 Realtime 能传递受保护的更新。表没有客户端写权限。前端不发送未过滤 DELETE 订阅。

## 私有 R2 凭证 Worker

使用现有私有桶即可；不修改原封面 Worker。新的 Worker 通过 R2 binding 流式读取图片，浏览器不依赖公开域名。独立路径前缀 ledger/空间/创建人/账目UUID/随机UUID.jpg。

1. 新建 Cloudflare Worker，将 workers/ledger-receipts.js 粘贴进去；也可用官方 Wrangler 指定 workers/wrangler.ledger.jsonc 部署。
2. 为 Worker 添加名为 LEDGER_RECEIPTS 的 R2 binding，指向现有私有桶（示例 bucket_name 为 covers）。不需要把 R2 密钥放到网页，也不需要桶 Public Development URL。
3. 设置 SUPABASE_URL、SUPABASE_PUBLIC_KEY（浏览器 public/publishable key）和 ALLOWED_ORIGIN=https://jaime-lannister-debug.github.io。禁止 service_role。Worker 将用户 JWT 原样交给 Supabase 验证，并调用 ledger_receipt_access 检查成员/所有权。
4. 外部 supabase-config.js 增加 LEDGER_RECEIPTS_WORKER_URL，值为新 Worker 根地址；未来正式 Pages 部署时添加同名 Actions Variable，本分支的 pages.yml 已将此变量映射到构建环境。不要提交真实配置或会话。
5. Worker OPTIONS 允许 Authorization、Content-Type、X-Shared-Id、X-Entry-Id；上传 POST /upload，读取 GET /receipt。凭证经 Worker 代理，不需要开放桶 CORS。所有读取 no-store。

上传在保存账目前完成；取消草稿、替换或删除引用不会自动删除 R2 原对象，可能产生未引用文件。只有已关联、未删除且有成员权限的账目能通过 Worker 读取；不要把 ledger/ 前缀暴露为公开域名。

未配置私有凭证 Worker 时，账本的无凭证记账仍可使用；选择上传会明确提示需要配置，不会偷偷改用公开封面 URL。

## 报表与筛选

账目按发生日期、创建时间、UUID 倒序，50 条分页。列表合计查询全部符合条件的账目，而非当前页。月报按自然月、年报按自然年聚合；共同/个人各显示收入、支出、净额。两人承担/收入归属与实际付款/收款分别展示。上月为零时不除零。年度 SVG 只计算像素比例，精确金额在表格中完整保留。

## 验收

- A 支出 120 元共同平分：两人各承担60；A 代付 B 的80元个人支出：A实际付款80，但B承担80，共同消费不增加。
- A 工资8000元归A，共同收入10.01元平分，核对收入归属及固定余分。
- 自定义金额合计不等于总额、负数、0、三位小数、未来日期、不匹配的分类/子分类、非成员或伪造创建者应被拒绝。
- B 能看到 A 的账，不能编辑删除；A 同时两设备编辑旧版本应收到冲突。重复同一保存请求只记录一次。
- 明细月份、分类、性质、人员、收支、关键词可组合；超过50条时合计仍计全部；月报/年报与明细核对一致。
- A新增/编辑/删除，B账本自动更新；重新连接后重读；更新不清空B的表单草稿；退出清空账本和凭证Blob。
- 手机和电脑查看详情、记账、切报表；未知 Worker 配置和上传错误有明确提示；第三账号不能读写或取凭证。
- 原有收藏、心情瓶、纪念日、消息和菜单跑原回归；feature 分支仅跑检查，不自动发布正式 Pages。

隔离 PostgreSQL、DOM 与 Worker 替身测试不等于已执行正式 SQL、部署 Cloudflare 或完成真实账号联调。
