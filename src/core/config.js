// 浏览器公开地址与配置读取；真实 Supabase 配置仍在外部文件。
export const COVER_UPLOAD_WORKER_URL =
  'https://r2-presigner.baopengtoskr.workers.dev/';
export const R2_PUBLIC_BASE_URL =
  'https://pub-e97c7ebcf6e7475d85a27152bc869d5f.r2.dev';
export const MAX_COVER_DATA_LENGTH = 300000;

export function getRuntimeConfig() {
  return Object.freeze({ ...(window.TWO_US_CONFIG || {}) });
}
