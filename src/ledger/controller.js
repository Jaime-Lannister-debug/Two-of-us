// 常驻轻量入口；完整账本只在进入时加载，成员验证独立于收藏和互动表。
import { $, toast } from "../core/dom.js";
import { ledgerState } from "./state.js";
export function createLedgerController(app) {
  const state = (app.state.ledger = ledgerState());
  state.member = false;
  let workspace, pending;
  const isLedgerPage = () =>
    new URLSearchParams(window.location.hash.slice(1)).get("view") === "ledger";
  async function component() {
    pending ||= import("./workspace.js").then(
      (m) => (workspace = m.createLedgerWorkspace(app, state)),
    );
    return pending;
  }
  function resetLedger() {
    workspace?.stop();
    Object.assign(state, ledgerState(), { member: false });
    const button = $("#ledgerNav");
    if (button) {
      button.hidden = true;
      button.classList.remove("active");
    }
  }
  async function activateLedger() {
    if (!app.state.cloudUser || !app.state.cloud) return;
    const epoch = app.state.cloudEpoch;
    try {
      const { data, error } = await app.state.cloud
        .from("shared_members")
        .select("user_id")
        .eq("shared_id", app.config.SHARED_ID)
        .eq("user_id", app.state.cloudUser.id);
      if (epoch !== app.state.cloudEpoch) return;
      if (error) throw error;
      state.member = !!data?.length;
      $("#ledgerNav").hidden = !state.member;
      if (!state.member) workspace?.stop();
      if (isLedgerPage()) void renderLedger();
    } catch (e) {
      if (epoch === app.state.cloudEpoch) {
        state.member = false;
        $("#ledgerNav").hidden = true;
        if (isLedgerPage())
          $("#content").textContent = "无法验证账本成员身份：" + e.message;
      }
    }
  }
  function openLedger(view = "entries") {
    if (!state.member) {
      toast("请先登录并加入共享空间。");
      return;
    }
    state.view = ["entries", "month", "year"].includes(view) ? view : "entries";
    history.pushState(null, "", "#view=ledger&tab=" + state.view);
    app.actions.render();
  }
  async function renderLedger() {
    if (!app.state.cloudUser || !state.member) {
      $("#content").innerHTML =
        '<p class="empty">请先登录并加入共享空间后查看账本。</p>';
      return;
    }
    const epoch = app.state.cloudEpoch;
    state.view =
      new URLSearchParams(window.location.hash.slice(1)).get("tab") ||
      "entries";
    if (!["entries", "month", "year"].includes(state.view))
      state.view = "entries";
    document
      .querySelectorAll("[data-page]")
      .forEach((b) => b.classList.remove("active"));
    $("#milestonesNav").classList.remove("active");
    $("#moodBottles").classList.remove("active");
    $("#ledgerNav").classList.add("active");
    $("#add").textContent = "＋ 记一笔";
    if (!workspace)
      $("#content").innerHTML =
        '<p class="empty" role="status">正在加载双人账本…</p>';
    try {
      const view = await component();
      if (epoch === app.state.cloudEpoch && state.member && isLedgerPage())
        view.open();
    } catch (e) {
      if (epoch === app.state.cloudEpoch && isLedgerPage())
        $("#content").textContent = "账本加载失败：" + e.message;
    }
  }
  function leaveLedger() {
    if (state.active) workspace?.stop();
    $("#ledgerNav")?.classList.remove("active");
  }
  async function newLedgerEntry() {
    if (!state.member) return;
    const epoch = app.state.cloudEpoch;
    try {
      const view = await component();
      if (epoch === app.state.cloudEpoch && state.member) view.newEntry();
    } catch (e) {
      toast(e.message);
    }
  }
  function initLedgerUI() {
    $("#ledgerNav").onclick = () => openLedger();
    app.events.listen(window, "online", () => {
      void activateLedger();
      if (state.active) void workspace?.reload();
    });
    app.events.listen(document, "visibilitychange", () => {
      if (!document.hidden) {
        void activateLedger();
        if (state.active) void workspace?.reload();
      }
    });
  }
  app.onDispose(resetLedger);
  return {
    isLedgerPage,
    openLedger,
    renderLedger,
    leaveLedger,
    newLedgerEntry,
    resetLedger,
    activateLedger,
    initLedgerUI,
  };
}
