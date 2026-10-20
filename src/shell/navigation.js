// 页面导航、搜索、分类切换与详情地址。
import { $ } from '../core/dom.js';
import { cats } from '../collections/model.js';
export function createShellNavigation(app) {
  const store = app.state;
  function go(p, s = '') {
    history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search,
    );
    store.page = p;
    store.filter = '全部';
    store.genreFilter = '';
    store.stateFilter = s;
    store.selectedDate = '';
    app.actions.render();
  }
  function detailId() {
    return new URLSearchParams(window.location.hash.slice(1)).get('item');
  }
  function openDetails(id) {
    void app.actions.markItemRead(id);
    window.location.hash = 'item=' + encodeURIComponent(id);
  }
  function leaveDetails() {
    history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search,
    );
    app.actions.render();
  }
  function initNavigation() {
    $('#nav').innerHTML = Object.entries(cats)
      .map(
        ([k, v]) => `<button data-page="${k}"><i>${v[0]}</i>${v[1]}</button>`,
      )
      .join('');
    $('#nav').onclick = (e) => {
      const b = e.target.closest('[data-page]');
      if (b) go(b.dataset.page);
    };
    document
      .querySelectorAll('[data-list]')
      .forEach((b) => (b.onclick = () => go('home', b.dataset.list)));
    $('#search').oninput = (e) => {
      const value = e.target.value;
      app.timers.clearTimeout(store.searchDebounce);
      store.searchDebounce = app.timers.setTimeout(() => {
        store.query = value;
        app.actions.render();
      }, 200);
    };
    $('#add').onclick = () => app.actions.openForm();
  }
  return {
    go,
    detailId,
    openDetails,
    leaveDetails,
    initNavigation,
  };
}
