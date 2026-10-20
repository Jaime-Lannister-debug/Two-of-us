// 公共错误文案。
export function friendlyError(error) {
  const text = String(error?.message || error || '未知错误');
  if (/记录已被修改|并发|conflict/i.test(text))
    return '记录已被修改，请关闭编辑窗口，刷新列表后重新打开再保存。';
  if (/invalid login credentials/i.test(text))
    return '邮箱或密码不正确，请检查后重试。';
  if (/email not confirmed/i.test(text))
    return '邮箱尚未确认，请先点击确认邮件里的链接。';
  if (/already registered/i.test(text)) return '该邮箱已注册，请直接登录。';
  if (/rate limit|too many requests/i.test(text))
    return '操作过于频繁，请稍后再试。';
  if (/fetch|network|load failed/i.test(text))
    return '连接失败，请检查网络、Project URL 和 CDN 是否可访问。';
  if (/row-level security|permission denied/i.test(text))
    return '没有访问权限，请检查登录状态及数据库 RLS 策略。';
  return text;
}
