// 金额永远用整数分；禁止 parseFloat、隐式四舍五入及 JSON Number 大整数。
export function parseMoney(value, allowZero = false) {
  const text = String(value).trim();
  if (!/^\d{1,11}(?:\.\d{1,2})?$/.test(text))
    throw Error("金额须为正数，最多两位小数。");
  const [yuan, fraction = ""] = text.split(".");
  const cents = BigInt(yuan) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents > 1000000000000n || cents < (allowZero ? 0n : 1n))
    throw Error("金额须大于零且不超过 100 亿元。");
  return cents.toString();
}
export function decimal(cents) {
  const n = BigInt(cents),
    value = n < 0n ? -n : n;
  return `${n < 0n ? "-" : ""}${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}
export const money = (cents) => "¥" + decimal(cents);
export function equalShares(cents, people) {
  if (people.length !== 2) throw Error("请先邀请对方加入共享空间。");
  const n = BigInt(cents),
    ids = people.map((p) => p.user_id).sort();
  return ids.map((user_id, i) => ({
    user_id,
    amount_minor: (n / 2n + (i === 0 ? n % 2n : 0n)).toString(),
  }));
}
export function change(current, previous) {
  const c = BigInt(current),
    p = BigInt(previous);
  if (!p) return c ? "上月为零，本月新增" : "与上月持平";
  const diff = c - p,
    rounded = ((diff < 0n ? -diff : diff) * 10000n + p / 2n) / p;
  return `${diff > 0n ? "+" : diff < 0n ? "-" : ""}${rounded / 100n}.${String(rounded % 100n).padStart(2, "0")}%`;
}
export function bookToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function monthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error("请选择有效年月。");
  const [y, m] = month.split("-").map(Number);
  return {
    from: month + "-01",
    to: `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`,
  };
}
