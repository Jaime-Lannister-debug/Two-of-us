// 所有金额来自数据库整数汇总；SVG 只把整数比例映射为像素。
import { esc } from "../core/dom.js";
import { money, change } from "./money.js";
export function summaryHTML(s, people, label) {
  if (!s) return "";
  const metric = (title, value) =>
    `<article class="ledger-metric"><span>${esc(title)}</span><strong>${money(value)}</strong></article>`;
  const purposes = s.purposes
    ? `<h3>消费用途</h3><div class="ledger-scope-grid">${Object.entries({
        self: "自己消费",
        romance: "恋爱消费",
        unclassified: "未分类（历史账目）",
      })
        .map(
          ([key, title]) =>
            `<article><h3>${title}</h3><p>支出 <b>${money(s.purposes[key].expense)}</b></p><p>收入 <b>${money(s.purposes[key].income)}</b></p><p>净结余 ${money(s.purposes[key].net)}</p></article>`,
        )
        .join("")}</div>`
    : `<p class="subtitle">消费用途统计需要执行 08-ledger-purpose.sql 后刷新账本。</p>`;
  return `${purposes}<div class="ledger-metrics">${metric("总收入", s.income)}${metric("总支出", s.expense)}${metric("净结余", s.net)}</div><p class="subtitle">${esc(label)} · 共 ${s.count} 笔记录</p><div class="ledger-scope-grid">${["shared", "personal"].map((scope) => `<article><h3>${scope === "shared" ? "一起消费" : "各自消费"}</h3><p>支出 <b>${money(s.scopes[scope].expense)}</b></p><p>收入 <b>${money(s.scopes[scope].income)}</b></p><p>净结余 ${money(s.scopes[scope].net)}</p></article>`).join("")}</div><h3>金额归属与实际收付</h3><div class="ledger-table-wrap"><table><thead><tr><th>成员</th><th>承担支出</th><th>归属收入</th><th>实际付款</th><th>实际收款</th></tr></thead><tbody>${s.people.map((p) => `<tr><th>${esc(people(p.user_id))}</th><td>${money(p.expense)}</td><td>${money(p.income)}</td><td>${money(p.paid)}</td><td>${money(p.received)}</td></tr>`).join("")}</tbody></table></div>`;
}
export function reportHTML(data, state, label) {
  if (!data) return "";
  const s = data.current,
    year = Number(state.year);
  const categories = (kind) =>
    `<section><h3>${kind === "expense" ? "支出分类排行" : "收入分类汇总"}</h3>${
      s.categories
        .filter((c) => c.kind === kind)
        .map(
          (c, i) =>
            `<div class="ledger-category-row"><span>${i + 1}. ${esc(c.name)} <small>${c.count} 笔</small></span><b>${money(c.amount)}</b></div>`,
        )
        .join("") || '<p class="subtitle">本期暂无记录。</p>'
    }</section>`;
  return (
    summaryHTML(
      s,
      label,
      state.view === "year" ? `${year} 年` : `${state.month} 月`,
    ) +
    (data.previous
      ? `<div class="ledger-comparison"><p>支出环比 <b>${change(s.expense, data.previous.expense)}</b></p><p>收入环比 <b>${change(s.income, data.previous.income)}</b></p></div>`
      : "") +
    (state.view === "year" ? trendHTML(s.months, year) : "") +
    `<div class="ledger-scope-grid">${categories("expense")}${categories("income")}</div>`
  );
}
export function trendHTML(months, year) {
  const rows = Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}`;
    return (
      months.find((r) => r.month === month) || {
        month,
        income: "0",
        expense: "0",
      }
    );
  });
  const maximum = rows.reduce(
    (max, r) =>
      [BigInt(r.income), BigInt(r.expense)].reduce(
        (m, n) => (n > m ? n : m),
        max,
      ),
    1n,
  );
  const height = (v) => Number((BigInt(v) * 150n) / maximum);
  const svg = rows
    .map((r, i) => {
      const x = 25 + i * 48,
        hi = height(r.income),
        he = height(r.expense);
      return `<g><title>${r.month} 收入 ${money(r.income)}，支出 ${money(r.expense)}</title><rect x="${x}" y="${175 - hi}" width="15" height="${hi}" fill="#8dbda8"/><rect x="${x + 17}" y="${175 - he}" width="15" height="${he}" fill="#efb994"/><text x="${x + 16}" y="198" text-anchor="middle">${i + 1}月</text></g>`;
    })
    .join("");
  return `<section class="ledger-trend"><h3>12 个月收支趋势</h3><p class="subtitle">绿色：收入 · 暖橙：支出</p><svg viewBox="0 0 620 210" role="img" aria-label="年度十二个月收入和支出对比柱状图">${svg}</svg><details><summary>查看每月精确金额</summary><div class="ledger-table-wrap"><table><thead><tr><th>月份</th><th>收入</th><th>支出</th><th>净结余</th></tr></thead><tbody>${rows.map((r) => `<tr><th>${r.month}</th><td>${money(r.income)}</td><td>${money(r.expense)}</td><td>${money(BigInt(r.income) - BigInt(r.expense))}</td></tr>`).join("")}</tbody></table></div></details></section>`;
}
