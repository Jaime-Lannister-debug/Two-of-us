# 维护约定

先阅读 README.md 和 supabase/README.md。

- 项目是原生单文件网页，不引入 React/Vue，不无关重写视觉或交互。
- 前端唯一源码为根目录 shared.html。index.html 只作为入口。
- 唯一运行配置来自同目录 supabase-config.js；实际文件忽略 Git。模板保持无真实项目配置。
- 不提交数据库密码、service_role、secret key、会话、邀请码、JSON 备份或真实私密记录。
- Supabase publishable key 用于浏览器，但仍按用户偏好排除实际配置，不提交源码。
- 默认使用成员方案 B。不要为排错关闭 RLS，不要单独重跑方案 A，使成员授权退化。
- SECURITY DEFINER 函数必须固定 search_path、明确对象 schema、显式检查 auth.uid() 与空间访问权限，收紧 EXECUTE。
- 保留 replace_shared_item(p_id,p_content,p_expected_content) 乐观并发契约。当前内部 UPDATE，必须监听 UPDATE。
- 空/null/undefined 坐标必须丢弃，真实 0 坐标有效；电影/音乐/旅行/亲密不能保留进度字段。
- 代码注释用中文。
- 改动后运行 python3 scripts/check.py；根据改动执行 README 中相关浏览器/RLS 验收，并诚实说明未完成的验证。
- 修改程序不等于修改远端数据库或完成部署；不要声称未执行的 SQL、迁移或上线已经成功。
- 不擅自更换部署平台、修改 Supabase 账号、邀请成员或扩大共享范围。
- 用户换设备后，先读取远端最新代码，不上传旧下载包覆盖新提交。
