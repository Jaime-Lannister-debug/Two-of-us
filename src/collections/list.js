// 首页和收藏列表渲染，协调分类展示。
import { esc, $ } from "../core/dom.js";
import {
  status,
  parseGenres,
  cats,
  subs,
  stateLabels,
  travelDates,
} from "./model.js";
export function createCollectionsList(app) {
  const store = app.state;
  function card(r) {
    return `<article class="card ${r.cat === "music" ? "music" : ""} ${r.cat === "game" ? "game-card" : ""}" data-id="${r.id}" tabindex="0" role="button" aria-label="查看${esc(r.title)}详情"><div class="poster ${!r.image && r.coverImage && r.coverWrap ? "wrap-cover" : ""}">${r.image || r.coverImage ? `<img src="${esc(r.image || r.coverImage)}" alt="${esc(r.title)}${r.coverImage && !r.image ? "游戏封面" : "海报"}" loading="lazy">` : ""}${r.cat === "game" && !r.image && !r.coverImage ? `<span class="cover-pending">${esc(r.coverStatus || "封面待补充")}</span>` : ""}<span class="tag">${esc(r.cat === "game" ? r.platform || r.sub : status[r.state])}</span><div class="poster-title">${esc(r.title)}</div><span class="score">★ ${r.score ? Number(r.score).toFixed(1) : "待评分"}</span></div><h3>${esc(r.title)}</h3><div class="meta"><span>${esc(r.desc)}</span></div>${genreBadges(r)}${r.cat === "game" ? `<p class="game-meta">${esc(r.platform || r.sub)} · ${esc(status[r.state])} · ★ ${r.score ? Number(r.score).toFixed(1) : "待评分"}</p>` : ""}${r.cat === "film" && r.sub === "电视剧" && Number(r.currentEpisode) > 0 ? `<div class="progress-caption">正在看第 ${Number(r.currentEpisode)} 集</div>` : ""}${app.actions.progressCard(r)}${app.actions.itemUnreadBadge(r.id)}</article>`;
  }
  function genreBadges(r) {
    return `<div class="genre-badges">${parseGenres(r.genres)
      .map((t) => `<span>${esc(t)}</span>`)
      .join("")}</div>`;
  }
  function render() {
    if (!store.cloudUser) return;
    if (store.map) {
      store.map.remove();
      store.map = null;
    }
    if (app.actions.isMoodPage()) {
      app.actions.renderMoodPage();
      return;
    }
    app.actions.disposeStarBottles();
    $("#moodBottles").classList.remove("active");
    $("#add").textContent = "＋ 新增回忆";
    if (app.actions.detailId()) {
      app.actions.renderDetail(app.actions.detailId());
      return;
    }
    document
      .querySelectorAll("[data-page]")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.page === store.page),
      );
    let arr = store.records.filter(
      (r) =>
        (store.page === "home" || r.cat === store.page) &&
        (store.filter === "全部" || r.sub === store.filter) &&
        (!store.stateFilter || r.state === store.stateFilter) &&
        (!store.genreFilter ||
          parseGenres(r.genres).includes(store.genreFilter)) &&
        (!store.query ||
          (r.title + r.desc + (r.place || "") + parseGenres(r.genres).join(" "))
            .toLowerCase()
            .includes(store.query.toLowerCase())),
    );
    let html = "";
    if (
      store.page === "home" &&
      !store.stateFilter &&
      !store.query &&
      !store.genreFilter
    ) {
      html = `<section class="hero"><div><span class="eyebrow">A LITTLE WORLD, JUST FOR TWO</span><h1>把喜欢的事，<br>都和你一起。</h1><p>一部电影，一首歌，一场说走就走的旅行。<br>这里收藏我们的共同喜好，也记录每一次心动。</p><div class="small">✧ &nbsp; 下一次约会，从一个小小的心愿开始</div></div><div class="hero-count"><div><strong>${store.records.filter((r) => r.state === "done").length}</strong><small>共同回忆</small></div><div><strong>${store.records.filter((r) => r.state === "wish").length}</strong><small>未来可期</small></div></div></section><div id="milestoneHome">${app.actions.milestoneHome()}</div><div class="heading"><h2>◷ &nbsp;我们的进行时</h2><small>有你在，每件事都变得有趣</small><a data-more="doing">查看全部 →</a></div><div class="grid">${store.records
        .filter((r) => r.state === "doing" && r.cat !== "intimacy")
        .map(card)
        .join(
          "",
        )}</div><div class="heading"><h2>一起收藏的美好</h2><small>慢慢体验，慢慢喜欢</small><a data-more="wish">心愿清单 →</a></div>`;
    } else {
      html = `<h1 class="section-title">${
        store.stateFilter
          ? {
              wish: "我们的心愿单",
              doing: "正在一起做",
              done: "已完成的美好",
            }[store.stateFilter]
          : cats[store.page][1]
      }</h1><p class="subtitle">${
        {
          home: "把想做的事放在这里，把未来留给我们。",
          film: "从片头到片尾，身边一直是你。",
          music: "有些旋律一响起，就想起了你。",
          game: "最佳队友，永远是你。",
          travel: "把世界慢慢走成我们的地图。",
          intimacy: "只属于我们共同记录的亲密时光。",
        }[store.page]
      }</p>`;
    }
    if (store.page !== "home" || store.stateFilter || store.query)
      html += `<div class="chips">${["全部", ...(subs[store.page] || [])].map((x) => `<button class="chip ${store.filter === x ? "active" : ""}" data-sub="${x}">${x}</button>`).join("")}<span class="spacer"></span>${["", "wish", "doing", "done"].map((s) => `<button class="chip ${store.stateFilter === s ? "active" : ""}" data-state="${s}">${s ? stateLabels(store.page, "")[s] : "所有状态"}</button>`).join("")}</div>`;
    const availableGenres = [
      ...new Set(
        store.records
          .filter((r) => store.page === "home" || r.cat === store.page)
          .flatMap((r) => parseGenres(r.genres)),
      ),
    ].sort((a, b) => a.localeCompare(b, "zh"));
    if (availableGenres.length)
      html += `<div class="genre-filter"><label>类型 <select id="genreFilter" aria-label="按类型筛选"><option value="">全部类型</option>${availableGenres.map((t) => `<option value="${esc(t)}" ${store.genreFilter === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label><span>${arr.length} 项记录</span></div>`;
    if (store.page === "travel") {
      html +=
        '<div class="map" id="map"></div><p class="subtitle map-guide">先点击地图选择地点，再点「新增回忆」；也可在表单手动填写经纬度。保存后显示旅行标点。</p><div class="heading"><h2>旅途时间线</h2><small>从最近的一次出发说起</small></div><div class="timeline">' +
        arr
          .sort((a, b) => b.date.localeCompare(a.date))
          .map(
            (r) =>
              `<article class="trip" data-id="${r.id}" tabindex="0" role="button"><img src="${esc(r.image)}" alt="${esc(r.title)}"><div class="trip-content"><span class="eyebrow">${esc(travelDates(r))} · ${status[r.state]}${app.actions.itemUnreadBadge(r.id)}</span><h3>${esc(r.title)} <small style="color:#efb994;font-size:13px">★ ${r.score || "待评分"}</small></h3>${genreBadges(r)}<p>游玩 · ${esc(r.desc)}<br>入住 · ${esc(r.hotel)}<br>${esc(r.note)}</p></div></article>`,
          )
          .join("") +
        "</div>";
    } else if (store.page === "intimacy") {
      html +=
        '<div class="privacy">♡ 亲密记录 · 当前共享空间的已登录账号可访问。</div>' +
        app.actions.calendar() +
        `<div class="heading"><h2>${store.selectedDate ? store.selectedDate : "亲密时光"}</h2><small>点击日历中的日期筛选记录</small></div><div class="timeline">` +
        arr
          .filter((r) => !store.selectedDate || r.date === store.selectedDate)
          .map(
            (r) =>
              `<article class="trip" data-id="${r.id}" tabindex="0" role="button"><img src="${esc(r.image)}" alt="夜色示意图"><div class="trip-content"><span class="eyebrow">${r.date} · ★ ${r.score || "待评分"}${app.actions.itemUnreadBadge(r.id)}</span><h3>${esc(r.title)}</h3>${genreBadges(r)}<p>地点 · ${esc(r.place)}　品牌 · ${esc(r.brand)}<br>感受 · ${esc(r.note)}</p></div></article>`,
          )
          .join("") +
        "</div>";
    } else {
      const display =
        store.page === "home" &&
        !store.stateFilter &&
        !store.query &&
        !store.genreFilter
          ? arr.filter((r) => r.cat !== "intimacy" && r.state === "wish")
          : arr.filter((r) => r.cat !== "intimacy");
      html += `<div class="grid">${display.length ? display.map(card).join("") : '<div class="empty">还没有条目。点击右上角「新增回忆」，记录第一份共同收藏。</div>'}</div>`;
    }
    if (
      store.page === "home" &&
      !store.stateFilter &&
      !store.query &&
      !store.genreFilter
    )
      html +=
        '<div class="banner"><span style="font-size:30px;color:#e6b799">⌁</span><div><b>下一站，我们去哪里？</b><p>把想去的地方放进心愿单，让期待有迹可循。</p></div><button class="btn secondary" data-travel>打开旅行地图 ↗</button></div>';
    $("#content").innerHTML =
      (store.listLoading
        ? '<p role="status" class="subtitle">正在加载共享列表…</p>'
        : "") + html;
    $("#content").setAttribute("aria-busy", String(store.listLoading));
    $("#content")
      .querySelectorAll("img")
      .forEach((image) =>
        app.events.listen(
          image,
          "error",
          () => {
            image.hidden = true;
            image.parentElement.classList.add("missing-cover");
          },
          {
            once: true,
          },
        ),
      );
    const gf = $("#genreFilter");
    if (gf)
      gf.onchange = () => {
        store.genreFilter = gf.value;
        render();
      };
    $("#content")
      .querySelectorAll("[data-id]")
      .forEach((el) => {
        el.onclick = () => app.actions.openDetails(el.dataset.id);
        el.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            app.actions.openDetails(el.dataset.id);
          }
        };
      });
    document.querySelectorAll("[data-sub]").forEach(
      (b) =>
        (b.onclick = () => {
          store.filter = b.dataset.sub;
          render();
        }),
    );
    document.querySelectorAll("[data-state]").forEach(
      (b) =>
        (b.onclick = () => {
          store.stateFilter = b.dataset.state;
          render();
        }),
    );
    document
      .querySelectorAll("[data-more]")
      .forEach(
        (b) => (b.onclick = () => app.actions.go("home", b.dataset.more)),
      );
    const tr = $("[data-travel]");
    if (tr) tr.onclick = () => app.actions.go("travel");
    document.querySelectorAll("[data-month]").forEach(
      (b) =>
        (b.onclick = () => {
          store.month = new Date(
            store.month.getFullYear(),
            store.month.getMonth() + Number(b.dataset.month),
            1,
          );
          store.selectedDate = "";
          render();
        }),
    );
    document.querySelectorAll("[data-day]").forEach(
      (b) =>
        (b.onclick = () => {
          store.selectedDate =
            store.selectedDate === b.dataset.day ? "" : b.dataset.day;
          render();
        }),
    );
    if (store.page === "travel") app.actions.initMap(arr);
    const manage = $("#manageMilestones");
    if (manage) manage.onclick = app.actions.openMilestones;
  }
  return {
    card,
    genreBadges,
    render,
  };
}
