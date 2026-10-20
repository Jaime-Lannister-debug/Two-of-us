// 首页纪念日与纪念日管理，不建立 Realtime 订阅。
import {
  nextMilestoneDay,
  milestoneCaption,
  localDay,
  dayIndex,
} from '../core/dates.js';
import { esc, $ } from '../core/dom.js';
export function createInteractionsMilestones(app) {
  const store = app.state;
  function milestoneHome() {
    if (!store.together.member) return '';
    const sorted = [...store.together.milestones].sort(
      (a, b) =>
        Number(b.is_relationship) - Number(a.is_relationship) ||
        nextMilestoneDay(a) - nextMilestoneDay(b),
    );
    return `<section class="milestone-home"><div class="heading"><h2>♡ 我们的纪念日</h2><button id="manageMilestones" class="btn secondary" type="button" ${store.together.ready ? '' : 'disabled'}>管理纪念日</button></div>${
      store.together.ready
        ? `<div class="milestone-grid">${
            sorted
              .slice(0, 4)
              .map(
                (m) =>
                  `<article><h3>${esc(m.title)}</h3><strong>${esc(milestoneCaption(m))}</strong><small>${esc(m.date)}${m.repeat_yearly ? ' · 每年纪念' : ''}</small></article>`,
              )
              .join('') ||
            '<p class="subtitle">添加在一起的日子、第一次约会或生日，把值得期待的日子留在这里。</p>'
          }</div>`
        : `<p class="subtitle">${esc(store.together.error || '正在读取纪念日…')}</p>`
    }</section>`;
  }
  function refreshMilestoneHome() {
    const host = $('#milestoneHome');
    if (host) {
      host.innerHTML = milestoneHome();
      const button = $('#manageMilestones');
      if (button) button.onclick = openMilestones;
    }
  }
  function openMilestones() {
    if (!app.actions.memberFeature()) return;
    resetMilestoneForm();
    renderMilestoneList();
    $('#milestoneDialog').showModal();
  }
  function resetMilestoneForm() {
    const form = $('#milestoneForm');
    form.reset();
    form.dataset.id = '';
    $('#milestoneDate').value = localDay();
    $('#milestoneRepeat').checked = true;
    $('#milestoneMessage').textContent = '';
  }
  function renderMilestoneList() {
    $('#milestoneList').innerHTML =
      store.together.milestones
        .map(
          (m) =>
            `<article><div><b>${esc(m.title)}</b><p>${esc(m.date)} · ${esc(milestoneCaption(m))}</p></div><div class="social-actions"><button class="btn secondary" type="button" data-edit-milestone="${esc(m.id)}">编辑</button><button class="btn secondary" type="button" data-delete-milestone="${esc(m.id)}">删除</button></div></article>`,
        )
        .join('') || '<p class="subtitle">还没有纪念日，先添加一个吧。</p>';
    $('#milestoneList')
      .querySelectorAll('[data-edit-milestone]')
      .forEach(
        (button) =>
          (button.onclick = () => {
            const m = store.together.milestones.find(
              (m) => m.id === button.dataset.editMilestone,
            );
            if (!m) return;
            $('#milestoneForm').dataset.id = m.id;
            $('#milestoneTitle').value = m.title;
            $('#milestoneDate').value = m.date;
            $('#milestoneRepeat').checked = m.repeat_yearly;
            $('#milestoneRelationship').checked = m.is_relationship;
            $('#milestoneTitle').focus();
          }),
      );
    $('#milestoneList')
      .querySelectorAll('[data-delete-milestone]')
      .forEach(
        (button) =>
          (button.onclick = () =>
            void deleteMilestone(button.dataset.deleteMilestone)),
      );
  }
  async function saveMilestone(event) {
    event.preventDefault();
    if (!app.actions.memberFeature() || store.together.busy) return;
    const title = $('#milestoneTitle').value.trim(),
      date = $('#milestoneDate').value,
      relationship = $('#milestoneRelationship').checked,
      id = $('#milestoneForm').dataset.id;
    if (
      !title ||
      title.length > 80 ||
      !Number.isFinite(dayIndex(date)) ||
      date < '1900-01-01' ||
      date > '2200-12-31'
    ) {
      $('#milestoneMessage').textContent =
        '请填写名称和有效日期（1900–2200 年）。';
      return;
    }
    if (relationship && dayIndex(date) > dayIndex(localDay())) {
      $('#milestoneMessage').textContent = '在一起的开始日期不能晚于今天。';
      return;
    }
    const epoch = store.cloudEpoch;
    store.together.busy = true;
    $('#milestoneSave').disabled = true;
    try {
      const payload = {
        title,
        date,
        repeat_yearly: $('#milestoneRepeat').checked,
        is_relationship: relationship,
      };
      const result = id
        ? await store.cloud
            .from('milestones')
            .update(payload)
            .eq('id', id)
            .eq('shared_id', app.config.SHARED_ID)
            .select('id')
        : await store.cloud
            .from('milestones')
            .insert({
              ...payload,
              shared_id: app.config.SHARED_ID,
            })
            .select('id');
      if (result.error) throw result.error;
      if (!result.data?.length) throw Error('纪念日已删除或没有修改权限');
      if (epoch !== store.cloudEpoch) return;
      await app.actions.loadTogether();
      if (epoch !== store.cloudEpoch) return;
      resetMilestoneForm();
      renderMilestoneList();
      $('#milestoneMessage').textContent = '已保存纪念日';
    } catch (error) {
      if (epoch === store.cloudEpoch)
        $('#milestoneMessage').textContent =
          error.code === '23505'
            ? '已设置在一起的日子，请编辑原来的记录。'
            : app.actions.socialError(error);
    } finally {
      if (epoch === store.cloudEpoch) {
        store.together.busy = false;
        $('#milestoneSave').disabled = false;
      }
    }
  }
  async function deleteMilestone(id) {
    if (
      !app.actions.memberFeature() ||
      store.together.busy ||
      !confirm('删除这条纪念日？')
    )
      return;
    const epoch = store.cloudEpoch;
    store.together.busy = true;
    try {
      const { data, error } = await store.cloud
        .from('milestones')
        .delete()
        .eq('id', id)
        .eq('shared_id', app.config.SHARED_ID)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw Error('纪念日已删除或没有权限');
      if (epoch !== store.cloudEpoch) return;
      await app.actions.loadTogether();
      if (epoch === store.cloudEpoch) {
        resetMilestoneForm();
        renderMilestoneList();
      }
    } catch (error) {
      if (epoch === store.cloudEpoch)
        $('#milestoneMessage').textContent = app.actions.socialError(error);
    } finally {
      if (epoch === store.cloudEpoch) store.together.busy = false;
    }
  }
  return {
    milestoneHome,
    refreshMilestoneHome,
    openMilestones,
    resetMilestoneForm,
    renderMilestoneList,
    saveMilestone,
    deleteMilestone,
  };
}
