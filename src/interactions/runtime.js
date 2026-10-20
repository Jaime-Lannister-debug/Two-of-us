// 互动功能的成员门禁、数据读取、生命周期与实时协调。
import { $, toast } from '../core/dom.js';
import { friendlyError } from '../core/errors.js';
export function createInteractionsRuntime(app) {
  const store = app.state;
  function resetTogether() {
    store.together.version++;
    if (store.together.channel && store.cloud) {
      void store.cloud.removeChannel(store.together.channel);
      store.together.channel = null;
    }
    app.timers.clearTimeout(store.together.timer);
    Object.assign(store.together, {
      member: false,
      ready: false,
      error: '',
      milestones: [],
      moods: [],
      reads: new Set(),
      notifications: [],
      busy: false,
    });
    for (const id of ['milestoneDialog', 'moodDialog', 'messageDialog']) {
      const dialog = $('#' + id);
      if (dialog?.open) dialog.close();
    }
    updateTogetherBadges();
  }
  function socialError(error) {
    return /PGRST202|PGRST205|schema cache|does not exist/.test(
      String(error?.code || '') + ' ' + String(error?.message || error),
    )
      ? '新功能尚未启用，请在 Supabase SQL Editor 执行 05-together-features.sql，然后刷新。'
      : friendlyError(error);
  }
  function updateTogetherBadges() {
    const visible = !!store.cloudUser && store.together.member;
    for (const id of ['togetherNav', 'messageButton']) {
      const node = $('#' + id);
      if (node) node.hidden = !visible;
    }
    for (const kind of ['happy', 'sad']) {
      const badge = $('#' + kind + 'Unread'),
        count = app.actions.moodUnread(kind).length;
      if (badge) {
        badge.textContent = count;
        badge.hidden = !count;
      }
    }
    const count = store.together.notifications.filter((n) => !n.read_at).length,
      badge = $('#messageUnread');
    if (badge) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.hidden = !count;
    }
    const hint = $('#togetherHint');
    if (hint) hint.textContent = store.together.error;
    for (const id of ['happyBottle', 'sadBottle', 'messageButton']) {
      const button = $('#' + id);
      if (button) button.disabled = !store.together.ready;
    }
    // 更新红点时不重绘整页，避免地图、上传和用户正在输入的内容丢失。
    if (typeof document.querySelectorAll === 'function')
      document.querySelectorAll('#content [data-id]').forEach((card) => {
        const old = card.querySelector('.item-unread');
        if (old) old.remove();
        if (app.actions.unreadItem(card.dataset.id))
          card.insertAdjacentHTML(
            'afterbegin',
            app.actions.itemUnreadBadge(card.dataset.id),
          );
      });
  }
  async function loadTogether(
    options = {
      milestones: true,
    },
  ) {
    if (!store.cloudUser || !store.cloud) return;
    const epoch = store.cloudEpoch,
      version = ++store.together.version,
      uid = store.cloudUser.id;
    try {
      const membership = await store.cloud
        .from('shared_members')
        .select('user_id')
        .eq('shared_id', app.config.SHARED_ID)
        .eq('user_id', uid);
      if (membership.error) throw membership.error;
      if (epoch !== store.cloudEpoch || version !== store.together.version)
        return;
      if (!membership.data?.length) {
        resetTogether();
        return;
      }
      store.together.member = true;
      updateTogetherBadges();
      const [moods, notifications, milestones] = await Promise.all([
        store.cloud
          .from('mood_entries')
          .select('id,kind,content,created_by,created_at')
          .eq('shared_id', app.config.SHARED_ID)
          .order('created_at', {
            ascending: false,
          })
          .order('id', {
            ascending: false,
          })
          .limit(200),
        app.actions.allNotifications(),
        options.milestones
          ? store.cloud
              .from('milestones')
              .select('id,title,date,repeat_yearly,is_relationship')
              .eq('shared_id', app.config.SHARED_ID)
              .order('date', {
                ascending: true,
              })
              .order('id', {
                ascending: true,
              })
          : Promise.resolve(null),
      ]);
      if (moods.error) throw moods.error;
      if (milestones?.error) throw milestones.error;
      const ids = (moods.data || []).map((m) => m.id);
      const reads = ids.length
        ? await store.cloud
            .from('mood_reads')
            .select('mood_id')
            .eq('user_id', uid)
            .in('mood_id', ids)
        : {
            data: [],
            error: null,
          };
      if (reads.error) throw reads.error;
      if (epoch !== store.cloudEpoch || version !== store.together.version)
        return;
      store.together.moods = moods.data || [];
      store.together.notifications = notifications;
      store.together.reads = new Set((reads.data || []).map((r) => r.mood_id));
      if (milestones) store.together.milestones = milestones.data || [];
      store.together.ready = true;
      store.together.error = '';
      updateTogetherBadges();
      app.actions.refreshMilestoneHome();
      if ($('#moodDialog')?.open) app.actions.renderBottleContents();
      if ($('#messageDialog')?.open) app.actions.renderMessages();
      if (!store.together.channel) {
        const reload = () => {
          if (epoch !== store.cloudEpoch) return;
          app.timers.clearTimeout(store.together.timer);
          store.together.timer = app.timers.setTimeout(
            () =>
              void loadTogether({
                milestones: false,
              }),
            120,
          );
        };
        store.together.channel = store.cloud
          .channel('together-' + uid)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'mood_entries',
              filter: `shared_id=eq.${app.config.SHARED_ID}`,
            },
            reload,
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'mood_reads',
              filter: `user_id=eq.${uid}`,
            },
            reload,
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'item_notifications',
              filter: `recipient_id=eq.${uid}`,
            },
            reload,
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'item_notifications',
              filter: `recipient_id=eq.${uid}`,
            },
            reload,
          )
          .subscribe((status) => {
            if (epoch !== store.cloudEpoch) return;
            if (status === 'SUBSCRIBED') reload();
            if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) {
              $('#togetherHint').textContent =
                '心情与消息连接暂时中断，重连或回到页面时会重新读取。';
            }
          });
      }
    } catch (error) {
      if (epoch === store.cloudEpoch && version === store.together.version) {
        store.together.ready = false;
        store.together.error = socialError(error);
        store.together.moods = [];
        store.together.notifications = [];
        updateTogetherBadges();
        app.actions.refreshMilestoneHome();
      }
    }
  }
  function memberFeature() {
    if (!store.cloudUser || !store.together.member || !store.together.ready) {
      toast(store.together.error || '请先登录并加入共享空间');
      return false;
    }
    return true;
  }
  function initTogetherUI() {
    $('#happyBottle').onclick = () => app.actions.openBottle('happy');
    $('#sadBottle').onclick = () => app.actions.openBottle('sad');
    $('#messageButton').onclick = app.actions.openMessages;
    $('#milestoneForm').onsubmit = app.actions.saveMilestone;
    $('#newMilestone').onclick = app.actions.resetMilestoneForm;
    $('#milestoneRelationship').onchange = () => {
      if ($('#milestoneRelationship').checked)
        $('#milestoneRepeat').checked = true;
    };
    $('#moodForm').onsubmit = app.actions.addMood;
    $('#moodRead').onclick = () =>
      void app.actions.readBottle(store.together.kind);
    $('#readAllNotifications').onclick = () =>
      void app.actions.readNotifications(
        store.together.notifications.map((n) => n.id),
      );
    for (const id of ['milestoneDialog', 'moodDialog', 'messageDialog']) {
      const dialog = $('#' + id);
      dialog.querySelector('[data-social-close]').onclick = () => {
        if (!store.together.busy) dialog.close();
      };
      app.events.listen(dialog, 'cancel', (event) => {
        if (store.together.busy) event.preventDefault();
      });
      app.events.listen(dialog, 'click', (event) => {
        if (event.target === dialog && !store.together.busy) dialog.close();
      });
    }
    // 跨天、重回页面与恢复网络时重新读取；纪念日不建立 Realtime 订阅。
    app.events.listen(window, 'online', () => {
      if (store.cloudUser) void loadTogether();
    });
    app.events.listen(document, 'visibilitychange', () => {
      if (!document.hidden && store.cloudUser) void loadTogether();
    });
    app.timers.setInterval(() => {
      if (!document.hidden && store.cloudUser)
        app.actions.refreshMilestoneHome();
    }, 60000);
  }
  return {
    resetTogether,
    socialError,
    updateTogetherBadges,
    loadTogether,
    memberFeature,
    initTogetherUI,
  };
}
