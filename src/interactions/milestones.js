// 首页纪念日摘要与管理；完整列表由独立页面负责，消息变化时重新读取。
import {
  nextMilestoneDay,
  milestoneCaption,
  localDay,
  dayIndex,
} from "../core/dates.js";
import { esc, $ } from "../core/dom.js";
export function createInteractionsMilestones(app) {
  const store = app.state;
  function milestoneHome() {
    if (!store.together.member) return "";
    const sorted = [...store.together.milestones].sort(
      (a, b) =>
        Number(b.is_relationship) - Number(a.is_relationship) ||
        nextMilestoneDay(a) - nextMilestoneDay(b),
    );
    const first = sorted[0];
    return `<section class="milestone-home"><div class="heading"><h2>♡ 我们的纪念日</h2><button id="manageMilestones" class="btn secondary" type="button" ${store.together.ready ? "" : "disabled"}>查看全部纪念日 →</button></div><div class="milestone-summary"><strong>${store.together.ready ? esc(first ? milestoneCaption(first) : "收藏值得记住的日子") : "正在读取纪念日…"}</strong><span class="subtitle">${store.together.ready ? `共 ${sorted.length} 个纪念日 · 已移至独立板块` : esc(store.together.error || "")}</span></div></section>`;
  }
  function refreshMilestoneHome() {
    const host = $("#milestoneHome");
    if (host) {
      host.innerHTML = milestoneHome();
      const button = $("#manageMilestones");
      if (button) button.onclick = () => app.actions.openMilestonePage();
    }
  }
  function openMilestones(id = "") {
    if (!app.actions.memberFeature()) return;
    resetMilestoneForm();
    renderMilestoneList();
    $("#milestoneDialog").showModal();
    if (typeof id === "string" && id) editMilestone(id);
  }
  function resetMilestoneForm() {
    const form = $("#milestoneForm");
    form.reset();
    form.dataset.id = "";
    $("#milestoneDate").value = localDay();
    $("#milestoneRepeat").checked = true;
    $("#milestoneMessage").textContent = "";
  }
  function renderMilestoneList() {
    $("#milestoneList").innerHTML =
      store.together.milestones
        .map(
          (m) =>
            `<article><div><b>${esc(m.title)}</b><p>${esc(m.date)} · ${esc(milestoneCaption(m))}</p></div><div class="social-actions"><button class="btn secondary" type="button" data-edit-milestone="${esc(m.id)}">编辑</button><button class="btn secondary" type="button" data-delete-milestone="${esc(m.id)}">删除</button></div></article>`,
        )
        .join("") || '<p class="subtitle">还没有纪念日，先添加一个吧。</p>';
    $("#milestoneList")
      .querySelectorAll("[data-edit-milestone]")
      .forEach(
        (button) =>
          (button.onclick = () => {
            editMilestone(button.dataset.editMilestone);
          }),
      );
    $("#milestoneList")
      .querySelectorAll("[data-delete-milestone]")
      .forEach(
        (button) =>
          (button.onclick = () =>
            void deleteMilestone(button.dataset.deleteMilestone)),
      );
  }
  function editMilestone(id) {
    const m = store.together.milestones.find((m) => m.id === id);
    if (!m) return;
    void app.actions.markItemRead(id);
    $("#milestoneForm").dataset.id = m.id;
    $("#milestoneTitle").value = m.title;
    $("#milestoneDate").value = m.date;
    $("#milestoneRepeat").checked = m.repeat_yearly;
    $("#milestoneRelationship").checked = m.is_relationship;
    $("#milestoneTitle").focus();
  }
  async function allMilestones() {
    const rows = [],
      uid = store.cloudUser?.id,
      epoch = store.cloudEpoch;
    for (let start = 0; ; start += 500) {
      const result = await store.cloud
        .from("milestones")
        .select("id,title,date,repeat_yearly,is_relationship")
        .eq("shared_id", app.config.SHARED_ID)
        .order("date", { ascending: true })
        .order("id", { ascending: true })
        .range(start, start + 499);
      if (result.error) return result;
      if (epoch !== store.cloudEpoch || uid !== store.cloudUser?.id)
        return { data: [], error: null };
      rows.push(...(result.data || []));
      if ((result.data || []).length < 500) return { data: rows, error: null };
    }
  }
  async function saveMilestone(event) {
    event.preventDefault();
    if (!app.actions.memberFeature() || store.together.busy) return;
    const title = $("#milestoneTitle").value.trim(),
      date = $("#milestoneDate").value,
      relationship = $("#milestoneRelationship").checked,
      id = $("#milestoneForm").dataset.id;
    if (
      !title ||
      title.length > 80 ||
      !Number.isFinite(dayIndex(date)) ||
      date < "1900-01-01" ||
      date > "2200-12-31"
    ) {
      $("#milestoneMessage").textContent =
        "请填写名称和有效日期（1900–2200 年）。";
      return;
    }
    if (relationship && dayIndex(date) > dayIndex(localDay())) {
      $("#milestoneMessage").textContent = "在一起的开始日期不能晚于今天。";
      return;
    }
    const epoch = store.cloudEpoch;
    store.together.busy = true;
    $("#milestoneSave").disabled = true;
    try {
      const payload = {
        title,
        date,
        repeat_yearly: $("#milestoneRepeat").checked,
        is_relationship: relationship,
      };
      const result = id
        ? await store.cloud
            .from("milestones")
            .update(payload)
            .eq("id", id)
            .eq("shared_id", app.config.SHARED_ID)
            .select("id")
        : await store.cloud
            .from("milestones")
            .insert({
              ...payload,
              shared_id: app.config.SHARED_ID,
            })
            .select("id");
      if (result.error) throw result.error;
      if (!result.data?.length) throw Error("纪念日已删除或没有修改权限");
      if (epoch !== store.cloudEpoch) return;
      await app.actions.loadTogether();
      if (epoch !== store.cloudEpoch) return;
      resetMilestoneForm();
      renderMilestoneList();
      $("#milestoneMessage").textContent = "已保存纪念日";
    } catch (error) {
      if (epoch === store.cloudEpoch)
        $("#milestoneMessage").textContent =
          error.code === "23505"
            ? "已设置在一起的日子，请编辑原来的记录。"
            : app.actions.socialError(error);
    } finally {
      if (epoch === store.cloudEpoch) {
        store.together.busy = false;
        $("#milestoneSave").disabled = false;
      }
    }
  }
  async function deleteMilestone(id) {
    if (
      !app.actions.memberFeature() ||
      store.together.busy ||
      !confirm("删除这条纪念日及其全部纪念记录？照片原文件不会随之删除。")
    )
      return;
    const epoch = store.cloudEpoch;
    store.together.busy = true;
    try {
      const { data, error } = await store.cloud
        .from("milestones")
        .delete()
        .eq("id", id)
        .eq("shared_id", app.config.SHARED_ID)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw Error("纪念日已删除或没有权限");
      if (epoch !== store.cloudEpoch) return;
      await app.actions.loadTogether();
      if (epoch === store.cloudEpoch) {
        resetMilestoneForm();
        renderMilestoneList();
      }
    } catch (error) {
      if (epoch === store.cloudEpoch)
        $("#milestoneMessage").textContent = app.actions.socialError(error);
    } finally {
      if (epoch === store.cloudEpoch) store.together.busy = false;
    }
  }
  return {
    allMilestones,
    milestoneHome,
    refreshMilestoneHome,
    openMilestones,
    resetMilestoneForm,
    renderMilestoneList,
    saveMilestone,
    deleteMilestone,
  };
}
