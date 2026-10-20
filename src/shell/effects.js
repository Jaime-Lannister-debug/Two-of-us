// 按钮、搜索框和背景动效。

export function createShellEffects(app) {
  const store = app.state;
  // 事件委托同时覆盖筛选器、表单和日历动态创建的按钮。
  function buttonWave(button, x, y) {
    if (
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const rect = button.getBoundingClientRect();
    const size = Math.hypot(rect.width, rect.height) * 2;
    const wave = document.createElement('span');
    wave.className = 'click-wave';
    wave.setAttribute('aria-hidden', 'true');
    wave.style.width = wave.style.height = size + 'px';
    wave.style.left = x - rect.left - size / 2 + 'px';
    wave.style.top = y - rect.top - size / 2 + 'px';
    button.appendChild(wave);
    app.events.listen(wave, 'animationend', () => wave.remove(), {
      once: true,
    });
    app.timers.setTimeout(() => wave.remove(), 650);
  }
  const searchBox = document.querySelector('.search');
  const searchInput = document.querySelector('#search');
  function animateSearch(kind = 'is-bouncing') {
    if (
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    if (
      kind === 'is-typing' &&
      (searchBox.classList.contains('is-bouncing') ||
        Date.now() - store.lastSearchMotion < 380)
    )
      return;
    app.timers.clearTimeout(store.searchMotionTimer);
    searchBox.classList.remove('is-bouncing', 'is-typing');
    void searchBox.offsetWidth;
    searchBox.classList.add(kind);
    store.lastSearchMotion = Date.now();
    store.searchMotionTimer = app.timers.setTimeout(
      () => searchBox.classList.remove(kind),
      kind === 'is-bouncing' ? 560 : 340,
    );
  }
  function initEffects() {
    app.events.listen(document, 'pointerdown', (e) => {
      if (e.button !== 0) return;
      const button = e.target.closest('button');
      if (button && !button.disabled) buttonWave(button, e.clientX, e.clientY);
    });
    app.events.listen(document, 'keydown', (e) => {
      if (e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
      const button = e.target.closest('button');
      if (button && !button.disabled) {
        const rect = button.getBoundingClientRect();
        buttonWave(
          button,
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
      }
    });

    // 搜索动效不改变光标位置和焦点。
    app.events.listen(searchBox, 'pointerenter', (e) => {
      if (e.pointerType === 'mouse') animateSearch();
    });
    app.events.listen(searchBox, 'pointerdown', () => animateSearch());
    app.events.listen(searchInput, 'focus', () => animateSearch());
    app.events.listen(searchInput, 'input', () => animateSearch('is-typing'));
    app.events.listen(document, 'visibilitychange', () => {
      document
        .querySelectorAll('.romance-bg [class^="romance-"]')
        .forEach((el) => {
          el.style.animationPlayState = document.hidden ? 'paused' : 'running';
        });
    });
    // 只填写 Project URL 和 anon public key；绝不能放入 service_role 或数据库密码。
    // 配置唯一来源为外部文件；项目配置不重复写在页面中。
  }
  return {
    buttonWave,
    animateSearch,
    initEffects,
  };
}
