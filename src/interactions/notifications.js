// 条目红点、对方操作消息和自己的阅读状态。
import { $, toast, esc } from "../core/dom.js";
import { socialTime } from "../core/dates.js";
import { cats } from "../collections/model.js";
export function createInteractionsNotifications(app) {
  const store = app.state;
  function unreadItem(id) {
    return (
      store.together.ready &&
      store.together.notifications.some((n) => n.item_id === id && !n.read_at)
    );
  }
  function itemUnreadBadge(id) {
    return unreadItem(id)
      ? '<span class="item-unread" aria-label="对方更新了此条目，有未读消息"></span>'
      : "";
  }
  async function allNotifications() {
    const rows = [];
    for (let start = 0; ; start += 500) {
      const { data, error } = await store.cloud
        .from("item_notifications")
        .select(
          "id,actor_name,action,item_id,item_title,item_cat,created_at,read_at",
        )
        .eq("shared_id", app.config.SHARED_ID)
        .eq("recipient_id", store.cloudUser.id)
        .order("created_at", {
          ascending: false,
        })
        .order("id", {
          ascending: false,
        })
        .range(start, start + 499);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 500) return rows;
    }
  }
  async function readNotifications(ids) {
    const target = [...new Set(ids)].filter((id) =>
      store.together.notifications.some((n) => n.id === id && !n.read_at),
    );
    if (!target.length || !store.together.ready) return;
    const epoch = store.cloudEpoch;
    try {
      for (let i = 0; i < target.length; i += 500) {
        const { error } = await store.cloud.rpc("read_item_notifications", {
          p_shared_id: app.config.SHARED_ID,
          p_ids: target.slice(i, i + 500),
        });
        if (error) throw error;
        if (epoch !== store.cloudEpoch) return;
      }
      const now = new Date().toISOString();
      store.together.notifications.forEach((n) => {
        if (target.includes(n.id)) n.read_at = n.read_at || now;
      });
      app.actions.updateTogetherBadges();
      if ($("#messageDialog")?.open) renderMessages();
    } catch (error) {
      if (epoch === store.cloudEpoch) {
        toast(app.actions.socialError(error));
        if ($("#messageDialog")?.open)
          $("#notificationStatus").textContent = app.actions.socialError(error);
      }
    }
  }
  function markItemRead(id) {
    return readNotifications(
      store.together.notifications
        .filter((n) => n.item_id === id && !n.read_at)
        .map((n) => n.id),
    );
  }
  function renderMessages() {
    const unread = store.together.notifications.filter((n) => !n.read_at);
    const rows = unread.slice(0, 50);
    $("#notificationList").innerHTML =
      rows
        .map(
          (n) =>
            `<article class="notification-row is-unread"><button type="button" class="notification-open" data-notification="${esc(n.id)}"><span>${n.read_at ? "" : '<i class="item-unread" aria-label="未读"></i>'}${esc(n.actor_name)}${
              {
                INSERT: "添加了",
                UPDATE: "修改了",
                DELETE: "删除了",
              }[n.action] || "更新了"
            }${n.item_cat === "milestone" ? "纪念日" : ""}「${esc(n.item_title)}」</span><time>${esc(socialTime(n.created_at))}</time></button><button type="button" class="btn secondary" data-read-notification="${esc(n.id)}">看过这条</button></article>`,
        )
        .join("") || '<p class="empty">没有未读消息了。</p>';
    $("#notificationStatus").textContent =
      unread.length > 50
        ? "显示最近 50 条未读消息，确认一条后会显示下一条。"
        : "";
    $("#notificationList")
      .querySelectorAll("[data-read-notification]")
      .forEach((button) => {
        button.onclick = async () => {
          button.disabled = true;
          await readNotifications([button.dataset.readNotification]);
          if (button.isConnected) button.disabled = false;
        };
      });
    $("#notificationList")
      .querySelectorAll("[data-notification]")
      .forEach(
        (button) =>
          (button.onclick = () => {
            const n = store.together.notifications.find(
              (n) => n.id === button.dataset.notification,
            );
            if (!n) return;
            $("#messageDialog").close();
            if (n.item_cat === "milestone") {
              app.actions.openMilestonePage(n.item_id);
              if (!store.together.milestones.some((m) => m.id === n.item_id))
                toast("这条纪念日已删除，消息记录仍保留");
            } else if (store.records.some((r) => r.id === n.item_id))
              app.actions.openDetails(n.item_id);
            else {
              app.actions.go(
                Object.hasOwn(cats, n.item_cat) ? n.item_cat : "home",
              );
              toast("这条记录已删除，消息记录仍保留");
            }
          }),
      );
  }
  function openMessages() {
    if (!app.actions.memberFeature()) return;
    renderMessages();
    $("#messageDialog").showModal();
  }
  return {
    unreadItem,
    itemUnreadBadge,
    allNotifications,
    readNotifications,
    markItemRead,
    renderMessages,
    openMessages,
  };
}
