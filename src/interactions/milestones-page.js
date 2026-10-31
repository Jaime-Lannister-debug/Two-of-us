// 独立纪念日板块：完整列表、倒计时和对方更新红点，复用原管理弹窗。
import { $, esc } from "../core/dom.js";
import { nextMilestoneDay, milestoneCaption } from "../core/dates.js";
export function createMilestonesPage(app) {
  function isMilestonePage() {
    return (
      new URLSearchParams(window.location.hash.slice(1)).get("view") ===
      "milestones"
    );
  }
  function openMilestonePage(id = "") {
    if (!app.actions.memberFeature()) return;
    const params = new URLSearchParams({ view: "milestones" });
    if (id) params.set("milestone", id);
    history.pushState(null, "", "#" + params);
    app.actions.render();
    if (id)
      document
        .getElementById("milestone-card-" + id)
        ?.scrollIntoView?.({ block: "center" });
  }
  function renderMilestonePage() {
    if (app.actions.milestoneMemoryRoute()) {
      app.actions.disposeStarBottles();
      document
        .querySelectorAll("[data-page]")
        .forEach((b) => b.classList.remove("active"));
      $("#moodBottles").classList.remove("active");
      $("#milestonesNav").classList.add("active");
      app.actions.renderMilestoneMemories();
      return;
    }
    app.actions.stopMilestoneMemories();
    app.actions.disposeStarBottles();
    $("#add").textContent = "＋ 新增纪念日";
    document
      .querySelectorAll("[data-page]")
      .forEach((b) => b.classList.remove("active"));
    $("#moodBottles").classList.remove("active");
    $("#milestonesNav").classList.add("active");
    const state = app.state.together;
    if (!state.member || !state.ready) {
      $("#content").innerHTML =
        '<p class="empty" role="status">请先登录并加入共享空间，加载完成后即可查看纪念日。</p>';
      return;
    }
    const sorted = [...state.milestones].sort(
      (a, b) =>
        Number(b.is_relationship) - Number(a.is_relationship) ||
        nextMilestoneDay(a) - nextMilestoneDay(b),
    );
    $("#content").innerHTML =
      `<section class="milestones-page" aria-labelledby="milestonesPageTitle"><button class="btn secondary" id="milestonesBack">← 返回首页</button><div class="milestones-heading"><span class="eyebrow">EVERY DATE HAS A STORY</span><h1 id="milestonesPageTitle">我们的纪念日</h1><p class="subtitle">${sorted.length} 个值得记住的日子，都在这里。日期倒计时每天自动计算。</p><button class="btn" id="addMilestonePage">＋ 添加纪念日</button></div><div class="milestones-board">${sorted.map((m) => `<article class="milestone-card ${m.is_relationship ? "relationship" : ""}" id="milestone-card-${esc(m.id)}" data-milestone-id="${esc(m.id)}"><span class="eyebrow">${m.is_relationship ? "OUR STORY" : "A DAY TO REMEMBER"}</span><h2>${esc(m.title)}${app.actions.itemUnreadBadge(m.id)}</h2><strong>${esc(milestoneCaption(m))}</strong><p>${esc(m.date)}${m.repeat_yearly ? " · 每年纪念" : ""}</p><button class="btn" data-memory-milestone="${esc(m.id)}">查看纪念记录 →</button><button class="btn secondary" data-view-milestone="${esc(m.id)}">查看 / 编辑</button></article>`).join("") || '<p class="empty">还没有纪念日。添加在一起的日子、第一次约会或生日，记录属于我们的时光。</p>'}</div></section>`;
    $("#content").setAttribute("aria-busy", "false");
    document
      .querySelectorAll("[data-memory-milestone]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            app.actions.openMilestoneMemories(b.dataset.memoryMilestone)),
      );
    $("#milestonesBack").onclick = () => app.actions.go("home");
    $("#addMilestonePage").onclick = () => app.actions.openMilestones();
    document.querySelectorAll("[data-view-milestone]").forEach(
      (b) =>
        (b.onclick = () => {
          void app.actions.markItemRead(b.dataset.viewMilestone);
          app.actions.openMilestones(b.dataset.viewMilestone);
        }),
    );
  }
  function refreshMilestonePage() {
    if (isMilestonePage()) renderMilestonePage();
  }
  return {
    isMilestonePage,
    openMilestonePage,
    renderMilestonePage,
    refreshMilestonePage,
  };
}
