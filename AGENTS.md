# 维护约定

**先读 `project map.md`，再读 README.md；涉及数据库时读 supabase/README.md。** 上下文压缩或换设备后仍从地图定位，只打开相关模块。

- 原生 ES Modules，不引入 React/Vue，不无关重写视觉或交互。shared.html 仅是骨架，业务源码在 src/，样式在 styles/。
- 每增一个功能必须在 `project map.md` 的功能定位表补一行，列主要文件、对外入口、依赖和验证。删除功能同步删行、注册和关联测试；修改入口或路径同步更新地图。静态检查会核对全部 src/ 文件的登记。
- 新功能注册在 src/registry.js，纯函数直接 import，控制器用 createX(app)；共享状态由 src/core/state.js 管理，不在 window 上放业务变量。不合并回巨型脚本。
- 定时器和监听器用 app.timers / app.events.listen；测试清理用 app.dispose()。保留 cloudEpoch 防止退出后的旧请求恢复数据。
- 唯一运行配置来自外部 supabase-config.js；真实文件被 Git 忽略。R2 密钥只在 Worker。
- 不提交数据库密码、service_role、secret key、会话、邀请码、备份或真实私密记录。Supabase 公共 key 也按用户偏好排除真实配置。
- 默认成员方案 B。不为排错关闭 RLS，不单独重跑 A，不扩大共享范围。
- SECURITY DEFINER 固定 search_path、限定对象 schema、检查 auth.uid() 与空间权限、收紧 EXECUTE。
- 保留 replace_shared_item(p_id,p_content,p_expected_content) 乐观并发契约，内部 UPDATE，监听 UPDATE。空坐标丢弃，显式 0 有效；游戏只保留时长，电视剧保留集数，其他类型清理进度。
- 代码注释用中文。重构不等于修改数据库，不声称未执行的迁移或真实账号验证已经完成。
- 改动后 npm ci --ignore-scripts && npm test；也可 python3 scripts/check.py 跑结构、模块、功能与产物检查（需要 Node 22 与测试依赖）。按改动做浏览器验证，说明未完成的正式 RLS/双账号测试。
- 样式入口 styles/app.css 的顺序影响级联；有意改 UI 才更新 tests/fixtures/ui-contracts.json，并先人工核对。
- Pages 必须带上 src/、styles/ 和部署生成的配置；不发布 SQL、测试或 node_modules。
- 换设备先读远端最新代码，不上传旧单文件或下载包覆盖新提交；不擅自更换部署平台或邀请成员。
