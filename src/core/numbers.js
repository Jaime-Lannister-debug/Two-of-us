// 数值与坐标校验，不访问 DOM。
export const finiteNumber = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
export const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, finiteNumber(value)));
export function coordinate(value, limit) {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    String(value).trim() === ''
  )
    return undefined;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit
    ? number
    : undefined;
}
