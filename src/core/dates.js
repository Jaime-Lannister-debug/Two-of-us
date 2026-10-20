// 本地日历日期与周年计算，不依赖登录或页面。
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dayIndex(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return NaN;
  const [y, m, d] = value.split('-').map(Number),
    date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
    ? date.getTime() / 86400000
    : NaN;
}
export function nextMilestoneDay(item, today = localDay()) {
  const start = dayIndex(item.date),
    now = dayIndex(today);
  if (!Number.isFinite(start) || !Number.isFinite(now)) return NaN;
  if (!item.repeat_yearly) return start;
  const [originYear, m, d] = item.date.split('-').map(Number);
  let year = Math.max(Number(today.slice(0, 4)), originYear);
  const inYear = (y) =>
    Date.UTC(y, m - 1, Math.min(d, new Date(Date.UTC(y, m, 0)).getUTCDate())) /
    86400000;
  let candidate = inYear(year);
  if (candidate < now) candidate = inYear(++year);
  return candidate;
}
export function milestoneCaption(item, today = localDay()) {
  const now = dayIndex(today),
    start = dayIndex(item.date),
    next = nextMilestoneDay(item, today),
    delta = next - now;
  if (!Number.isFinite(delta)) return '请检查日期';
  const togetherDays =
    item.is_relationship && now >= start
      ? `在一起第 ${now - start + 1} 天 · `
      : '';
  return (
    togetherDays +
    (delta === 0
      ? '今天就是纪念日'
      : delta > 0
        ? `距离${item.repeat_yearly ? '下次纪念日' : '这一天'}还有 ${delta} 天`
        : `已经过去 ${Math.abs(delta)} 天`)
  );
}
export function socialTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('zh-CN', {
        hour12: false,
      });
}
