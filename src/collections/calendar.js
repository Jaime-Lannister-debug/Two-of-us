// 亲密记录日历。

export function createCollectionsCalendar(app) {
  const store = app.state;
  function calendar() {
    let year = store.month.getFullYear(),
      m = store.month.getMonth(),
      offset = (new Date(year, m, 1).getDay() + 6) % 7,
      count = new Date(year, m + 1, 0).getDate();
    return `<div class="calendar"><div class="cal-head"><button data-month="-1" aria-label="上个月">←</button><b>${year} 年 ${m + 1} 月</b><button data-month="1" aria-label="下个月">→</button></div><div class="days">${['一', '二', '三', '四', '五', '六', '日'].map((d) => `<div class="week">${d}</div>`).join('')}${'<div></div>'.repeat(offset)}${Array.from(
      {
        length: count,
      },
      (_, i) => {
        let date = `${year}-${String(m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
          n = store.records.filter(
            (r) => r.cat === 'intimacy' && r.date === date,
          ).length;
        return `<button class="day ${n ? 'marked' : ''} ${date === store.selectedDate ? 'selected' : ''}" data-day="${date}">${i + 1}${n ? ' <span style="float:right">♥</span>' : ''}</button>`;
      },
    ).join('')}</div></div>`;
  }
  return {
    calendar,
  };
}
