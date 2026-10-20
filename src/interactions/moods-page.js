// 心情独立二级页面。实时刷新只改计数和历史，不打断添加草稿或信件。
import { $, esc } from "../core/dom.js";
import { socialTime } from "../core/dates.js";
export function createMoodsPage(app) {
  const store = app.state;
  function isMoodPage() {
    return (
      new URLSearchParams(window.location.hash.slice(1)).get("view") === "moods"
    );
  }
  function openMoodPage(kind = "happy") {
    if (!app.actions.memberFeature()) return;
    store.together.kind = kind === "sad" ? "sad" : "happy";
    history.pushState(null, "", "#view=moods");
    app.actions.render();
  }
  function renderMoodPage() {
    app.actions.disposeStarBottles();
    $("#add").textContent = "＋ 放入心情";
    document
      .querySelectorAll("[data-page]")
      .forEach((b) => b.classList.remove("active"));
    $("#moodBottles").classList.add("active");
    if (!store.together.member || !store.together.ready) {
      $("#content").innerHTML =
        '<p class="empty" role="status">请先登录并加入共享空间，加载完成后即可打开我们的心情瓶子。</p>';
      return;
    }
    $("#content").innerHTML =
      `<section class="moods-page" aria-labelledby="moodsPageTitle"><button class="btn secondary" id="moodsBack">← 返回首页</button><div class="moods-heading"><span class="eyebrow">LITTLE STARS, SHARED FEELINGS</span><h1 id="moodsPageTitle">我们的心情瓶子</h1><p class="subtitle">把心情折成星星收藏。轻点瓶子，摇一摇今天的心事。</p></div><div class="mood-bottles-grid">${["happy", "sad"].map((kind) => `<section class="bottle-card ${kind}" aria-labelledby="${kind}BottleTitle"><h2 id="${kind}BottleTitle">${kind === "happy" ? "好心情" : "坏心情"}</h2><p>${kind === "happy" ? "收藏每一个闪闪发光的小确幸" : "把不开心轻轻放下，有我陪你"}</p><button type="button" class="glass-bottle" data-shake="${kind}" aria-label="摇动${kind === "happy" ? "好" : "坏"}心情瓶子"><span class="bottle-neck" aria-hidden="true"></span><span class="bottle-glass"><canvas data-stars="${kind}" aria-hidden="true"></canvas><span class="star-fallback" aria-hidden="true"></span><span class="bottle-shine" aria-hidden="true"></span></span></button><p class="bottle-count" data-bottle-count="${kind}" aria-live="polite"></p><div class="bottle-actions"><button class="btn" data-compose="${kind}">＋ 放入${kind === "happy" ? "好" : "坏"}心情</button><button class="btn secondary" data-open-new="${kind}"></button></div><button class="bottle-history-link" data-history="${kind}">查看这个瓶子的心情 ↓</button></section>`).join("")}</div><section class="bottle-history" aria-labelledby="moodHistoryTitle"><div class="social-dialog-head"><h2 id="moodHistoryTitle">瓶子里的心情</h2><div class="chips"><button class="chip" data-kind="happy">好心情</button><button class="chip" data-kind="sad">坏心情</button></div></div><div id="moodHistoryList"></div></section></section>`;
    $("#content").setAttribute("aria-busy", "false");
    $("#moodsBack").onclick = () => app.actions.go("home");
    document
      .querySelectorAll("[data-shake]")
      .forEach(
        (b) => (b.onclick = () => app.actions.shakeBottle(b.dataset.shake)),
      );
    document
      .querySelectorAll("[data-compose]")
      .forEach(
        (b) =>
          (b.onclick = () => app.actions.openMoodComposer(b.dataset.compose)),
      );
    document.querySelectorAll("[data-open-new]").forEach(
      (b) =>
        (b.onclick = () => {
          const mood = app.actions.moodUnread(b.dataset.openNew)[0];
          if (mood) app.actions.showMoodLetter(mood.id);
        }),
    );
    document.querySelectorAll("[data-history], [data-kind]").forEach(
      (b) =>
        (b.onclick = () => {
          store.together.kind = b.dataset.history || b.dataset.kind;
          refreshMoodPage();
          if (b.dataset.history)
            $("#moodHistoryTitle").scrollIntoView?.({
              behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
                .matches
                ? "auto"
                : "smooth",
              block: "start",
            });
        }),
    );
    refreshMoodPage();
  }
  function refreshMoodPage() {
    if (!isMoodPage()) return;
    if (!store.together.member || !store.together.ready) {
      app.actions.closeMoodLetter();
      renderMoodPage();
      return;
    }
    if (!$("#moodHistoryList")) {
      renderMoodPage();
      return;
    }
    for (const kind of ["happy", "sad"]) {
      const count = Math.min(
          100,
          store.together.moods.filter((m) => m.kind === kind).length,
        ),
        unread = app.actions.moodUnread(kind).length;
      $(`[data-bottle-count="${kind}"]`).textContent =
        `${count} / 100 颗星星${count === 100 ? " · 已装满" : ""} · ${unread} 条未读`;
      $(`[data-compose="${kind}"]`).disabled = count >= 100;
      const button = $(`[data-open-new="${kind}"]`);
      button.textContent = unread
        ? `✈ 打开新心情 (${unread})`
        : "暂时没有新心情";
      button.disabled = !unread;
    }
    const kind = store.together.kind,
      entries = store.together.moods.filter((m) => m.kind === kind);
    document
      .querySelectorAll("[data-kind]")
      .forEach((b) => b.classList.toggle("active", b.dataset.kind === kind));
    $("#moodHistoryList").innerHTML =
      entries
        .map(
          (m) =>
            `<button type="button" class="mood-history-entry" data-letter="${esc(m.id)}"><span><b>${esc(app.actions.personLabel(m.created_by))}</b>${m.created_by !== store.cloudUser?.id && !store.together.reads.has(m.id) ? '<span class="unread-pill">未读</span>' : ""}<time>${esc(socialTime(m.created_at))}</time></span><span class="mood-preview">${esc(m.content.slice(0, 45))}${m.content.length > 45 ? "…" : ""}</span><small>✈ 展开心情</small></button>`,
        )
        .join("") ||
      '<p class="empty">瓶子里还没有星星，放入第一份心情吧。</p>';
    document
      .querySelectorAll("[data-letter]")
      .forEach(
        (b) => (b.onclick = () => app.actions.showMoodLetter(b.dataset.letter)),
      );
    app.actions.mountStarBottles();
  }
  return { isMoodPage, openMoodPage, renderMoodPage, refreshMoodPage };
}
