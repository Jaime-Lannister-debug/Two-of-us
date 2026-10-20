// 独立心情瓶、容量、只计算对方未读及阅读回执。
import { profileName } from '../profiles/model.js';
import { $, esc } from '../core/dom.js';
import { socialTime } from '../core/dates.js';
export function createInteractionsMoods(app) {
  const store = app.state;
  function moodUnread(kind) {
    return store.together.moods.filter(
      (m) =>
        m.kind === kind &&
        m.created_by !== store.cloudUser?.id &&
        !store.together.reads.has(m.id),
    );
  }
  function personLabel(id) {
    const person = store.sharedPeople.find((p) => p.user_id === id);
    return person
      ? profileName(person, store.sharedPeople.indexOf(person))
      : id === store.cloudUser?.id
        ? '我'
        : '对方';
  }
  function renderBottleContents() {
    const kind = store.together.kind,
      entries = store.together.moods.filter((m) => m.kind === kind),
      unread = moodUnread(kind).length;
    $('#moodTitle').textContent =
      kind === 'happy' ? '好心情瓶子' : '坏心情瓶子';
    $('#moodCount').textContent =
      `${entries.length} / 100 条 · ${unread} 条未读`;
    const jar = $('#moodJar');
    jar.className = 'mood-jar ' + kind;
    jar.style.setProperty('--fill', entries.length + '%');
    jar.setAttribute(
      'aria-label',
      `${kind === 'happy' ? '好' : '坏'}心情瓶，${entries.length} / 100 条`,
    );
    $('#moodList').innerHTML =
      entries
        .map(
          (m) =>
            `<article class="mood-entry"><div><b>${esc(personLabel(m.created_by))}</b>${m.created_by !== store.cloudUser?.id && !store.together.reads.has(m.id) ? '<span class="unread-pill">未读</span>' : ''}<time>${esc(socialTime(m.created_at))}</time></div><p>${esc(m.content)}</p></article>`,
        )
        .join('') || '<p class="empty">瓶子还是空的，放入第一份心情吧。</p>';
    $('#moodRead').hidden = !unread;
    $('#moodSubmit').disabled = store.together.busy || entries.length >= 100;
    $('#moodFull').textContent =
      entries.length >= 100
        ? '瓶子已满，原有心情会一直保留。'
        : '只分享心情，不设置回复或聊天功能。';
  }
  async function readBottle(kind) {
    const ids = moodUnread(kind).map((m) => m.id);
    if (!ids.length || !app.actions.memberFeature()) return;
    const epoch = store.cloudEpoch;
    try {
      const { error } = await store.cloud.rpc('read_moods', {
        p_shared_id: app.config.SHARED_ID,
        p_ids: ids,
      });
      if (error) throw error;
      if (epoch !== store.cloudEpoch) return;
      ids.forEach((id) => store.together.reads.add(id));
      app.actions.updateTogetherBadges();
      if ($('#moodDialog').open && store.together.kind === kind)
        renderBottleContents();
    } catch (error) {
      if (epoch === store.cloudEpoch)
        $('#moodMessage').textContent = app.actions.socialError(error);
    }
  }
  function openBottle(kind) {
    if (!app.actions.memberFeature()) return;
    store.together.kind = kind;
    $('#moodText').value = '';
    $('#moodMessage').textContent = '';
    renderBottleContents();
    $('#moodDialog').showModal();
    void readBottle(kind);
  }
  async function addMood(event) {
    event.preventDefault();
    if (!app.actions.memberFeature() || store.together.busy) return;
    const content = $('#moodText').value.trim();
    if (!content || content.length > 1000) {
      $('#moodMessage').textContent = '请填写 1–1000 字的心情。';
      return;
    }
    const epoch = store.cloudEpoch,
      kind = store.together.kind;
    store.together.busy = true;
    $('#moodSubmit').disabled = true;
    try {
      const { error } = await store.cloud.rpc('add_mood', {
        p_shared_id: app.config.SHARED_ID,
        p_kind: kind,
        p_content: content,
      });
      if (error) throw error;
      if (epoch !== store.cloudEpoch) return;
      $('#moodText').value = '';
      await app.actions.loadTogether({
        milestones: false,
      });
      if (epoch === store.cloudEpoch)
        $('#moodMessage').textContent = '心情已放进瓶子，对方打开后可以看到。';
    } catch (error) {
      if (epoch === store.cloudEpoch)
        $('#moodMessage').textContent = app.actions.socialError(error);
    } finally {
      if (epoch === store.cloudEpoch) {
        store.together.busy = false;
        renderBottleContents();
      }
    }
  }
  return {
    moodUnread,
    personLabel,
    renderBottleContents,
    readBottle,
    openBottle,
    addMood,
  };
}
