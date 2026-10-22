// 复制为 shared.html 同目录的 supabase-config.js 后填写项目配置。
// publishable key 可用于浏览器，禁止使用 service_role / secret key / 数据库密码。
window.TWO_US_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  SHARED_ID: "our-shared-space",
  // 方案 A 为 closed；执行成员方案 B 后改为 members，显示邀请码按钮。
  ACCESS_MODE: "closed",
  // 私有凭证 Worker 地址；没有凭证时仍可记账。不要填写 R2 密钥。
  LEDGER_RECEIPTS_WORKER_URL: "",
};
