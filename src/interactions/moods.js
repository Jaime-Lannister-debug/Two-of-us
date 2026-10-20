// 独立心情瓶、容量、只计算对方未读及阅读回执。
import { profileName } from "../profiles/model.js";
import { $ } from "../core/dom.js";
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
        ? "我"
        : "对方";
  }
  function renderBottleContents() {
    const kind = store.together.kind,
      entries = store.together.moods.filter((m) => m.kind === kind),
      unread = moodUnread(kind).length;
    $("#moodTitle").textContent =
      kind === "happy" ? "放入好心情" : "放入坏心情";
    $("#moodCount").textContent =
      `${entries.length} / 100 颗星星 · ${unread} 条未读`;
    $("#moodSubmit").disabled = store.together.busy || entries.length >= 100;
    $("#moodFull").textContent =
      entries.length >= 100
        ? "瓶子已满，原有心情会一直保留。"
        : "一份心情，一颗星星。只分享，不设置聊天或回复。";
  }
  async function readMood(id) {
    const mood = store.together.moods.find((m) => m.id === id);
    if (
      !mood ||
      mood.created_by === store.cloudUser?.id ||
      store.together.reads.has(id) ||
      !app.actions.memberFeature()
    )
      return;
    const epoch = store.cloudEpoch;
    const { error } = await store.cloud.rpc("read_moods", {
      p_shared_id: app.config.SHARED_ID,
      p_ids: [id],
    });
    if (epoch !== store.cloudEpoch) return;
    if (error) throw error;
    store.together.reads.add(id);
    app.actions.updateTogetherBadges();
    app.actions.refreshMoodPage();
  }
  function openMoodComposer(kind) {
    if (!app.actions.memberFeature()) return;
    store.together.kind = kind === "sad" ? "sad" : "happy";
    $("#moodText").value = "";
    $("#moodMessage").textContent = "";
    renderBottleContents();
    $("#moodDialog").showModal();
  }
  async function addMood(event) {
    event.preventDefault();
    if (!app.actions.memberFeature() || store.together.busy) return;
    const content = $("#moodText").value.trim();
    if (!content || content.length > 1000) {
      $("#moodMessage").textContent = "请填写 1–1000 字的心情。";
      return;
    }
    const epoch = store.cloudEpoch,
      kind = store.together.kind;
    store.together.busy = true;
    $("#moodSubmit").disabled = true;
    try {
      const { error } = await store.cloud.rpc("add_mood", {
        p_shared_id: app.config.SHARED_ID,
        p_kind: kind,
        p_content: content,
      });
      if (error) throw error;
      if (epoch !== store.cloudEpoch) return;
      $("#moodText").value = "";
      await app.actions.loadTogether({
        milestones: false,
      });
      if (epoch === store.cloudEpoch)
        $("#moodMessage").textContent = "心情已放进瓶子，对方打开后可以看到。";
    } catch (error) {
      if (epoch === store.cloudEpoch)
        $("#moodMessage").textContent = app.actions.socialError(error);
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
    readMood,
    openMoodComposer,
    addMood,
  };
}
