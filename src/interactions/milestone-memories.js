// 每个纪念日的独立回忆。服务端检查成员/创建者/版本；刷新不覆盖编辑草稿。
import { $, esc, toast } from "../core/dom.js";
import { localDay } from "../core/dates.js";
export function createMilestoneMemories(app) {
  const store = app.state;
  const state = (store.milestoneMemories = {
    parent: "",
    rows: [],
    photos: [],
    editing: null,
    channel: null,
    generation: 0,
    request: 0,
    busy: false,
    uploading: false,
  });
  const routeId = () => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    return p.get("view") === "milestones" && p.get("memories") === "1"
      ? p.get("milestone") || ""
      : "";
  };
  const current = (g, epoch) =>
    g === state.generation &&
    epoch === store.cloudEpoch &&
    state.parent === routeId() &&
    !!store.cloudUser;
  function errorText(e) {
    return /PGRST20[25]|schema cache|does not exist/.test(
      String(e.code) + " " + e.message,
    )
      ? "纪念记录尚未启用，请在 Supabase SQL Editor 执行 09-milestone-memories.sql 后刷新。"
      : e.message || "操作失败，请稍后重试。";
  }
  function stopMilestoneMemories() {
    state.generation++;
    state.request++;
    if (state.channel) void store.cloud?.removeChannel(state.channel);
    Object.assign(state, {
      parent: "",
      rows: [],
      photos: [],
      editing: null,
      channel: null,
      busy: false,
      uploading: false,
    });
  }
  function openMilestoneMemories(id) {
    if (!app.actions.memberFeature()) return;
    history.pushState(
      null,
      "",
      "#" +
        new URLSearchParams({
          view: "milestones",
          milestone: id,
          memories: "1",
        }),
    );
    app.actions.render();
  }
  function draft() {
    state.editing = { id: crypto.randomUUID(), version: 0 };
    state.photos = [];
    $("#memoryForm").reset();
    $("#memoryDate").value = localDay();
    $("#memoryDate").max = localDay();
    $("#memoryFormStatus").textContent = "";
    $("#memorySave").textContent = "保存纪念记录";
    photos();
  }
  function lock() {
    $("#memoryFields").disabled = state.busy || state.uploading;
    $("#memorySave").disabled = state.busy || state.uploading;
    $("#memoryCancel").disabled = state.busy || state.uploading;
  }
  function photos() {
    $("#memoryPhotos").innerHTML = state.photos
      .map(
        (url, i) =>
          `<figure><a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(url)}" alt="待保存的第 ${i + 1} 张纪念照片"></a><button type="button" class="btn secondary" data-memory-remove="${i}">移除照片 ${i + 1}</button></figure>`,
      )
      .join("");
    $("#memoryPhotoCount").textContent =
      `已上传 ${state.photos.length} / 5 张；保存后与对方共享。`;
    for (const b of $("#memoryPhotos").querySelectorAll("[data-memory-remove]"))
      b.onclick = () => {
        if (state.busy || state.uploading) return;
        state.photos.splice(Number(b.dataset.memoryRemove), 1);
        photos();
      };
    bindImages($("#memoryPhotos"));
  }
  function bindImages(host) {
    // 沿用旅行详情的大图弹窗；普通链接仍作为脚本不可用时的备用入口。
    host.querySelectorAll("a").forEach((link) => {
      link.onclick = (event) => {
        event.preventDefault();
        const dialog = $("#photoLightbox");
        $("#largePhoto").src = link.href;
        $("#largePhoto").alt = link.querySelector("img")?.alt || "纪念照片大图";
        if (!dialog.open) dialog.showModal();
      };
    });
    host.querySelectorAll("img").forEach((img) =>
      img.addEventListener(
        "error",
        () => {
          img.alt = "图片暂时无法加载，可点击打开原图重试";
        },
        { once: true },
      ),
    );
  }
  async function upload(event) {
    const input = event.target,
      files = [...input.files];
    if (!files.length || state.busy || state.uploading) return;
    if (state.photos.length + files.length > 5) {
      $("#memoryFormStatus").textContent =
        "每条纪念记录最多上传 5 张照片，请减少所选照片。";
      input.value = "";
      return;
    }
    if (
      files.some(
        (f) =>
          !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
          f.size > 20 * 1024 * 1024,
      )
    ) {
      $("#memoryFormStatus").textContent =
        "请选择不超过 20 MB 的 JPG、PNG 或 WebP 图片。";
      input.value = "";
      return;
    }
    const g = state.generation,
      epoch = store.cloudEpoch;
    state.uploading = true;
    lock();
    try {
      for (let i = 0; i < files.length; i++) {
        $("#memoryFormStatus").textContent =
          `正在压缩第 ${i + 1} / ${files.length} 张照片…`;
        const blob = await app.actions.compressTravelImage(files[i]);
        if (!current(g, epoch)) return;
        const url = await app.actions.uploadR2Photo(
          blob,
          files[i].name,
          (status) => {
            if (current(g, epoch))
              $("#memoryFormStatus").textContent =
                `照片 ${i + 1} / ${files.length}：${status}`;
          },
        );
        if (!current(g, epoch)) return;
        if (!/^https:\/\//.test(url)) throw Error("上传服务未返回有效图片地址");
        if (!state.photos.includes(url)) state.photos.push(url);
        photos();
      }
      $("#memoryFormStatus").textContent = "照片上传完成，点击保存纪念记录。";
    } catch (e) {
      if (current(g, epoch))
        $("#memoryFormStatus").textContent =
          "照片上传失败：" +
          errorText(e) +
          " 已成功上传的照片和文字已保留，可继续选择上传。";
    } finally {
      if (current(g, epoch)) {
        state.uploading = false;
        input.value = "";
        lock();
      }
    }
  }
  async function save(event) {
    event.preventDefault();
    if (state.busy || state.uploading || !app.actions.memberFeature()) return;
    const g = state.generation,
      epoch = store.cloudEpoch;
    const activity = $("#memoryActivity").value.trim(),
      reflection = $("#memoryReflection").value.trim(),
      day = $("#memoryDate").value;
    if (
      !activity ||
      activity.length > 2000 ||
      reflection.length > 5000 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      day < "1900-01-01" ||
      day > localDay()
    ) {
      $("#memoryFormStatus").textContent =
        "请填写今天或过去的日期及 1–2000 字活动，感想最多 5000 字。";
      return;
    }
    state.busy = true;
    lock();
    $("#memoryFormStatus").textContent = "正在保存…";
    try {
      const { error } = await store.cloud.rpc("save_milestone_memory", {
        p_space: app.config.SHARED_ID,
        p_milestone: state.parent,
        p_id: state.editing.id,
        p_version: state.editing.version,
        p_day: day,
        p_activity: activity,
        p_reflection: reflection,
        p_photos: [...state.photos],
      });
      if (error) throw error;
      if (!current(g, epoch)) return;
      draft();
      $("#memoryFormStatus").textContent = "已保存，两个人都能看到。";
      await load();
    } catch (e) {
      if (current(g, epoch)) $("#memoryFormStatus").textContent = errorText(e);
    } finally {
      if (current(g, epoch)) {
        state.busy = false;
        lock();
      }
    }
  }
  async function remove(row) {
    if (
      state.busy ||
      state.uploading ||
      !confirm("删除这条纪念记录？照片只移除引用，不删除 R2 原文件。")
    )
      return;
    const g = state.generation,
      epoch = store.cloudEpoch;
    state.busy = true;
    lock();
    try {
      const { error } = await store.cloud.rpc("delete_milestone_memory", {
        p_space: app.config.SHARED_ID,
        p_id: row.id,
        p_version: row.version,
      });
      if (error) throw error;
      if (!current(g, epoch)) return;
      if (state.editing?.id === row.id) draft();
      await load();
    } catch (e) {
      if (current(g, epoch)) $("#memoryListStatus").textContent = errorText(e);
    } finally {
      if (current(g, epoch)) {
        state.busy = false;
        lock();
      }
    }
  }
  function renderRows() {
    const person = (id) =>
      store.sharedPeople.find((p) => p.user_id === id)?.nickname ||
      (id === store.cloudUser?.id ? "我" : "对方");
    $("#memoryList").innerHTML =
      state.rows
        .map(
          (r) =>
            `<article class="memory-entry"><p class="subtitle">${esc(r.occurred_on)} · ${esc(person(r.created_by))}记录 · ${esc(new Date(r.created_at).toLocaleString("zh-CN"))}</p><h3>这一天的活动</h3><p class="memory-text">${esc(r.activity)}</p>${r.reflection ? `<h3>感想</h3><p class="memory-text">${esc(r.reflection)}</p>` : ""}<div class="memory-photos">${r.photos.map((url, i) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="${esc(url)}" alt="${esc(r.occurred_on)} 的第 ${i + 1} 张纪念照片"></a>`).join("")}</div>${r.created_by === store.cloudUser?.id ? `<div class="social-actions"><button type="button" class="btn secondary" data-memory-edit="${esc(r.id)}">编辑记录</button><button type="button" class="btn secondary" data-memory-delete="${esc(r.id)}">删除记录</button></div>` : ""}</article>`,
        )
        .join("") ||
      '<p class="empty">还没有纪念记录。在上方写下这一天的活动和感想，留下第一份回忆。</p>';
    bindImages($("#memoryList"));
    for (const b of $("#memoryList").querySelectorAll("[data-memory-edit]"))
      b.onclick = () => {
        if (state.busy || state.uploading) return;
        const r = state.rows.find((r) => r.id === b.dataset.memoryEdit);
        state.editing = { id: r.id, version: r.version };
        state.photos = [...r.photos];
        $("#memoryDate").value = r.occurred_on;
        $("#memoryActivity").value = r.activity;
        $("#memoryReflection").value = r.reflection;
        $("#memorySave").textContent = "保存修改";
        $("#memoryFormStatus").textContent = "正在编辑记录";
        photos();
        $("#memoryActivity").focus();
      };
    for (const b of $("#memoryList").querySelectorAll("[data-memory-delete]"))
      b.onclick = () =>
        void remove(state.rows.find((r) => r.id === b.dataset.memoryDelete));
  }
  async function load() {
    const g = state.generation,
      epoch = store.cloudEpoch,
      request = ++state.request;
    if (!current(g, epoch)) return;
    $("#memoryListStatus").textContent = "正在加载纪念记录…";
    try {
      const rows = [];
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await store.cloud
          .from("milestone_memories")
          .select(
            "id,occurred_on,activity,reflection,photos,created_by,created_at,version",
          )
          .eq("shared_id", app.config.SHARED_ID)
          .eq("milestone_id", state.parent)
          .is("deleted_at", null)
          .order("occurred_on", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + 99);
        if (error) throw error;
        if (!current(g, epoch) || request !== state.request) return;
        rows.push(...data);
        if (data.length < 100) break;
      }
      state.rows = rows;
      renderRows();
      $("#memoryListStatus").textContent = `共 ${rows.length} 条纪念记录`;
    } catch (e) {
      if (current(g, epoch) && request === state.request)
        $("#memoryListStatus").textContent = errorText(e);
    }
  }
  function renderMilestoneMemories() {
    const id = routeId();
    if (!id || !app.actions.memberFeature()) return;
    const parent = store.together.milestones.find((m) => m.id === id);
    if (!parent) {
      stopMilestoneMemories();
      $("#content").innerHTML =
        '<p class="empty">这条纪念日已删除或没有访问权限，请返回纪念日列表。</p><button class="btn secondary" id="memoryMissingBack">返回纪念日</button>';
      $("#memoryMissingBack").onclick = () => app.actions.openMilestonePage();
      return;
    }
    $("#add").textContent = "＋ 新增纪念记录";
    if (state.parent === id && $("#milestoneMemoryPage")) {
      $("#memoryParentTitle").textContent = parent.title;
      void load();
      return;
    }
    stopMilestoneMemories();
    state.parent = id;
    $("#content").innerHTML =
      `<section class="milestones-page" id="milestoneMemoryPage"><div class="social-actions"><button class="btn secondary" id="memoryBack">← 返回纪念日</button><button class="btn secondary" id="memoryEditParent">编辑纪念日</button><button class="btn secondary" id="memoryRefresh">刷新记录</button></div><div class="milestones-heading"><span class="eyebrow">OUR ANNIVERSARY MEMORIES</span><h1 id="memoryParentTitle">${esc(parent.title)}</h1><p class="subtitle">${esc(parent.date)} · 每次纪念，都有新的故事。</p></div><form id="memoryForm" class="memory-form"><h2>记录这一天</h2><fieldset id="memoryFields"><label class="field">纪念日期<input id="memoryDate" type="date" min="1900-01-01" required></label><label class="field">活动（必填）<textarea id="memoryActivity" rows="3" maxlength="2000" required placeholder="一起去了哪里、做了什么…"></textarea></label><label class="field">感想<textarea id="memoryReflection" rows="4" maxlength="5000" placeholder="写下这一天的心情和想对彼此说的话…"></textarea></label><label class="field">上传纪念照片（最多 5 张）<input id="memoryUpload" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><p class="subtitle" id="memoryPhotoCount"></p><div class="memory-photos" id="memoryPhotos"></div></fieldset><p id="memoryFormStatus" role="status" aria-live="polite"></p><div class="social-actions"><button class="btn" id="memorySave" type="submit">保存纪念记录</button><button class="btn secondary" id="memoryCancel" type="button">清空 / 取消编辑</button></div></form><p id="memoryListStatus" role="status" aria-live="polite"></p><div id="memoryList"></div></section>`;
    $("#memoryBack").onclick = () => app.actions.openMilestonePage();
    $("#memoryEditParent").onclick = () => app.actions.openMilestones(id);
    $("#memoryRefresh").onclick = () => void load();
    $("#memoryCancel").onclick = draft;
    $("#memoryForm").onsubmit = save;
    $("#memoryUpload").onchange = upload;
    draft();
    const g = state.generation,
      epoch = store.cloudEpoch;
    state.channel = store.cloud
      .channel("milestone-memories-" + id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "milestone_memories",
          filter: `milestone_id=eq.${id}`,
        },
        () => {
          if (current(g, epoch)) void load();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "milestone_memories",
          filter: `milestone_id=eq.${id}`,
        },
        () => {
          if (current(g, epoch)) void load();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && current(g, epoch)) void load();
      });
    void load();
  }
  function focusMilestoneMemoryForm() {
    if (routeId()) $("#memoryActivity")?.focus();
  }
  app.events.listen(window, "online", () => {
    if (state.parent) void load();
  });
  app.events.listen(document, "visibilitychange", () => {
    if (!document.hidden && state.parent) void load();
  });
  app.onDispose(stopMilestoneMemories);
  return {
    milestoneMemoryRoute: routeId,
    openMilestoneMemories,
    renderMilestoneMemories,
    stopMilestoneMemories,
    focusMilestoneMemoryForm,
  };
}
