// 按需加载的账本工作区；列表刷新不替换筛选控件或编辑弹窗。
import { $, esc, toast } from "../core/dom.js";
import { ledgerData } from "./data.js";
import { ledgerEditor } from "./editor.js";
import { ledgerReceipts } from "./receipts.js";
import { summaryHTML, reportHTML } from "./reports.js";
import { money } from "./money.js";
export function createLedgerWorkspace(app, state) {
  const data = ledgerData(app, state),
    receipts = ledgerReceipts(app);
  const label = (id) => {
    const p = state.people.find((p) => p.user_id === id);
    return (
      (id === app.state.cloudUser?.id ? "我" : p ? "对方" : "历史成员") +
      (p?.nickname ? "（" + p.nickname + "）" : "")
    );
  };
  const editor = ledgerEditor(app, state, data, receipts, load, label);
  function mount() {
    if ($("#ledgerWorkspace")) return;
    $("#content").innerHTML =
      `<section class="ledger-workspace" id="ledgerWorkspace" aria-labelledby="ledgerTitle"><div class="ledger-heading"><div><span class="eyebrow">OUR SHARED LEDGER</span><h1 id="ledgerTitle">双人记账</h1><p class="subtitle">一起生活，也把每一笔收支记清楚。</p></div><button class="btn" id="ledgerNew">＋ 记一笔</button></div><div class="ledger-tabs" role="group" aria-label="账本页面">${[
        ["entries", "账目明细"],
        ["month", "月度报表"],
        ["year", "年度报表"],
      ]
        .map(
          ([v, t]) =>
            `<button class="chip" data-ledger-tab="${v}">${t}</button>`,
        )
        .join(
          "",
        )}</div><form id="ledgerFilters" class="ledger-filters"><label>月份（清空看全部）<input id="ledgerFilterMonth" type="month"></label><label>收支<select id="ledgerFilterKind"><option value="">全部</option><option value="expense">支出</option><option value="income">收入</option></select></label><label>消费性质<select id="ledgerFilterScope"><option value="">全部</option><option value="shared">一起消费</option><option value="personal">各自消费</option></select></label><label>分类<select id="ledgerFilterCategory"></select></label><label>付款 / 收款人<select id="ledgerFilterPayer"></select></label><label>关键词<input id="ledgerFilterQuery" type="search" maxlength="120" placeholder="搜索说明和备注"></label><button class="btn secondary" type="button" id="ledgerResetFilters">清空筛选</button></form><div class="ledger-period" id="ledgerReportPeriod"><label id="ledgerMonthLabel">年月<input id="ledgerMonth" type="month" required></label><label id="ledgerYearLabel">年份<input id="ledgerYear" type="number" min="1900" max="2200" step="1"></label></div><div class="ledger-status-line"><span id="ledgerConnection" role="status"></span><button class="btn secondary" id="ledgerRefresh">刷新账本</button></div><p id="ledgerStatus" role="status" aria-live="polite"></p><div id="ledgerResults"></div><div id="ledgerPagination" class="social-actions"></div></section>`;
    $("#ledgerNew").onclick = () => editor.open();
    $("#ledgerRefresh").onclick = () => load(true);
    for (const button of document.querySelectorAll("[data-ledger-tab]"))
      button.onclick = () => app.actions.openLedger(button.dataset.ledgerTab);
    const controls = {
      Month: "month",
      Kind: "kind",
      Scope: "scope",
      Category: "category_id",
      Payer: "payer_user_id",
    };
    for (const [suffix, key] of Object.entries(controls)) {
      const node = $("#ledgerFilter" + suffix);
      node.value = state.filters[key];
      node.onchange = () => {
        state.filters[key] = node.value;
        state.offset = 0;
        void load();
      };
    }
    $("#ledgerResetFilters").onclick = () => {
      state.filters = {
        month: "",
        kind: "",
        scope: "",
        category_id: "",
        payer_user_id: "",
        query: "",
      };
      state.offset = 0;
      for (const suffix of [
        "Month",
        "Kind",
        "Scope",
        "Category",
        "Payer",
        "Query",
      ])
        $("#ledgerFilter" + suffix).value = "";
      void load();
    };
    $("#ledgerFilters").onsubmit = (e) => e.preventDefault();
    $("#ledgerFilterQuery").value = state.filters.query;
    $("#ledgerFilterQuery").oninput = (e) => {
      const value = e.target.value;
      app.timers.clearTimeout(state.searchTimer);
      state.searchTimer = app.timers.setTimeout(() => {
        state.filters.query = value;
        state.offset = 0;
        void load();
      }, 200);
    };
    $("#ledgerMonth").value = state.month;
    $("#ledgerYear").value = state.year;
    $("#ledgerMonth").onchange = () => {
      if ($("#ledgerMonth").value) {
        state.month = $("#ledgerMonth").value;
        void load();
      }
    };
    $("#ledgerYear").onchange = () => {
      const y = $("#ledgerYear").value;
      if (!/^\d{4}$/.test(y) || Number(y) < 1900 || Number(y) > 2200) {
        $("#ledgerStatus").textContent = "请选择 1900–2200 年。";
        return;
      }
      state.year = y;
      void load();
    };
  }
  function controls() {
    if (!$("#ledgerWorkspace")) return;
    for (const b of document.querySelectorAll("[data-ledger-tab]")) {
      b.classList.toggle("active", b.dataset.ledgerTab === state.view);
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.ledgerTab === state.view),
      );
    }
    $("#ledgerFilters").hidden = state.view !== "entries";
    $("#ledgerReportPeriod").hidden = state.view === "entries";
    $("#ledgerMonthLabel").hidden = state.view !== "month";
    $("#ledgerYearLabel").hidden = state.view !== "year";
    const cat = $("#ledgerFilterCategory"),
      payer = $("#ledgerFilterPayer");
    const options =
      '<option value="">全部分类</option>' +
      state.categories
        .filter((c) => !c.parent_id)
        .map(
          (c) =>
            `<option value="${esc(c.id)}">${c.kind === "expense" ? "支出" : "收入"} · ${esc(c.name)}</option>`,
        )
        .join("");
    if (cat.innerHTML !== options) {
      cat.innerHTML = options;
      cat.value = state.filters.category_id;
    }
    const people =
      '<option value="">全部成员</option>' +
      state.people
        .map(
          (p) =>
            `<option value="${esc(p.user_id)}">${esc(label(p.user_id))}</option>`,
        )
        .join("");
    if (payer.innerHTML !== people) {
      payer.innerHTML = people;
      payer.value = state.filters.payer_user_id;
    }
  }
  function render() {
    controls();
    const host = $("#ledgerResults");
    if (!host) return;
    if (state.view !== "entries") {
      host.innerHTML = reportHTML(state.report, state, label);
      $("#ledgerPagination").innerHTML = "";
      return;
    }
    host.innerHTML =
      summaryHTML(state.summary, label, "当前完整筛选结果") +
      `<div class="ledger-entry-list">${state.entries.map((e) => `<button class="ledger-entry" data-ledger-entry="${esc(e.id)}"><span><b>${esc(e.description)}</b><small>${esc(e.occurred_on)} · ${esc(e.category_name)}${e.subcategory_name ? " / " + esc(e.subcategory_name) : ""} · ${e.scope === "shared" ? "一起消费" : "各自消费"}</small><small>${e.kind === "expense" ? "付款" : "收款"}：${esc(label(e.payer_user_id))} · 记账：${esc(label(e.created_by))} · ${esc(new Date(e.created_at).toLocaleString("zh-CN"))}${e.receipt_key ? " · 有凭证" : ""}</small></span><strong class="${e.kind}">${e.kind === "expense" ? "-" : "+"}${money(e.amount_minor)}</strong></button>`).join("") || '<p class="empty">当前筛选条件下没有账目。点击「记一笔」开始记录。</p>'}</div>`;
    for (const b of host.querySelectorAll("[data-ledger-entry]"))
      b.onclick = () =>
        editor.detail(
          state.entries.find((e) => e.id === b.dataset.ledgerEntry),
        );
    $("#ledgerPagination").innerHTML =
      `<button class="btn secondary" id="ledgerPrevious" ${state.offset === 0 ? "disabled" : ""}>上一页</button><span>共 ${state.total} 笔 · 第 ${Math.floor(state.offset / 50) + 1} 页</span><button class="btn secondary" id="ledgerNext" ${state.offset + 50 >= state.total ? "disabled" : ""}>下一页</button>`;
    $("#ledgerPrevious").onclick = () => {
      state.offset = Math.max(0, state.offset - 50);
      void load();
    };
    $("#ledgerNext").onclick = () => {
      state.offset += 50;
      void load();
    };
  }
  async function load(withBootstrap = false) {
    if (!state.active || !state.member || !app.actions.isLedgerPage()) return;
    const epoch = app.state.cloudEpoch,
      version = ++state.version,
      view = state.view;
    state.loading = true;
    state.error = "";
    if ($("#ledgerStatus")) {
      $("#ledgerStatus").textContent = "正在加载账本…";
      $("#ledgerResults").setAttribute("aria-busy", "true");
    }
    try {
      if (!state.ready || withBootstrap) await data.bootstrap();
      if (
        epoch !== app.state.cloudEpoch ||
        version !== state.version ||
        !state.active ||
        view !== state.view
      )
        return;
      const result =
        view === "entries" ? await data.list() : await data.report();
      if (
        epoch !== app.state.cloudEpoch ||
        version !== state.version ||
        !state.active ||
        view !== state.view
      )
        return;
      if (view === "entries") {
        state.entries = result.entries;
        state.summary = result.summary;
        state.total = Number(result.summary.count);
        if (state.offset > 0 && !result.entries.length) {
          state.offset = Math.max(0, state.offset - 50);
          void load();
          return;
        }
      } else state.report = result;
      render();
      editor.refreshDetail();
      $("#ledgerStatus").textContent = "";
    } catch (e) {
      if (
        epoch === app.state.cloudEpoch &&
        version === state.version &&
        $("#ledgerStatus")
      ) {
        $("#ledgerStatus").textContent = e.message || "账本读取失败，请重试。";
        $("#ledgerResults").innerHTML = "";
      }
    } finally {
      if (epoch === app.state.cloudEpoch && version === state.version) {
        state.loading = false;
        $("#ledgerResults")?.setAttribute("aria-busy", "false");
      }
    }
  }
  function subscribe() {
    if (state.channel) return;
    const epoch = app.state.cloudEpoch;
    const reload = () => {
      if (epoch !== app.state.cloudEpoch || !state.active) return;
      app.timers.clearTimeout(state.reloadTimer);
      state.reloadTimer = app.timers.setTimeout(() => void load(true), 150);
    };
    state.channel = app.state.cloud
      .channel("ledger-" + app.state.cloudUser.id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ledger_entries",
          filter: `shared_id=eq.${app.config.SHARED_ID}`,
        },
        reload,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ledger_entries",
          filter: `shared_id=eq.${app.config.SHARED_ID}`,
        },
        reload,
      )
      .subscribe((status) => {
        if (epoch !== app.state.cloudEpoch || !state.active) return;
        if ($("#ledgerConnection"))
          $("#ledgerConnection").textContent =
            status === "SUBSCRIBED"
              ? "账本实时同步已连接"
              : "账本连接：" + status;
        if (status === "SUBSCRIBED") reload();
      });
  }
  function open() {
    mount();
    state.active = true;
    controls();
    subscribe();
    void load(true);
  }
  function stop() {
    state.active = false;
    state.version++;
    app.timers.clearTimeout(state.reloadTimer);
    app.timers.clearTimeout(state.searchTimer);
    if (state.channel) {
      void app.state.cloud?.removeChannel(state.channel);
      state.channel = null;
    }
    editor.dispose();
  }
  app.onDispose(stop);
  return {
    open,
    stop,
    newEntry: () => editor.open(),
    reload: () => load(true),
  };
}
