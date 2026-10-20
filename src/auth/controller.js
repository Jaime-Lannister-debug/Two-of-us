// 登录、会话切换和原有条目实时订阅。
import { $, cloudMessage } from '../core/dom.js';
import { friendlyError } from '../core/errors.js';
export function createAuthController(app) {
  const store = app.state;
  function setSignedIn(user) {
    document.body.classList.toggle('signed-in', Boolean(user));
    $('#accountEmail').textContent = user?.email || '';
    $('#authPanel').hidden = Boolean(user);
    (user ? $('#cloudStatusSlot') : $('#cloudNotice')).append(
      $('#cloudMessage'),
    );
    if (!user) {
      app.actions.resetTogether();
      ++store.peopleVersion;
      if (store.profilesChannel) {
        void store.cloud.removeChannel(store.profilesChannel);
        store.profilesChannel = null;
      }
      store.sharedPeople = [];
      app.actions.renderPeople();
      app.actions.closePeopleMenu(false);
      $('#profileModal').hidden = true;
    }
    if (!user) {
      if ($('#photoLightbox')?.open) $('#photoLightbox').close();
      store.records = [];
      store.selectedTripPoint = null;
      store.rawRows.clear();
      $('#modal').hidden = true;
      if (store.map) {
        store.map.remove();
        store.map = null;
      }
      $('#content').replaceChildren();
    }
  }
  function requireCloudUser() {
    if (!store.cloud || !store.cloudUser) throw new Error('请先登录后再操作。');
  }
  // content 保持 text 类型，使用 JSON 保存原网页的封面、类型、评分和进度等字段。
  async function activateSession(session) {
    const user = session?.user || null;
    if (user && store.cloudUser?.id === user.id) {
      await store.cloud.realtime.setAuth(session.access_token);
      return;
    }
    const epoch = ++store.cloudEpoch;
    ++store.loadVersion;
    const old = store.cloudChannel;
    store.cloudChannel = null;
    store.cloudUser = user;
    setSignedIn(null);
    if (old) await store.cloud.removeChannel(old);
    if (epoch !== store.cloudEpoch) return;
    setSignedIn(user);
    if (!user) {
      $('#syncState').textContent = '未登录';
      return;
    }
    cloudMessage('正在加载共享列表…');
    await store.cloud.realtime.setAuth(session.access_token);
    if (epoch !== store.cloudEpoch) return;
    const reload = () => {
      if (epoch === store.cloudEpoch) void app.actions.loadSharedItems();
    };
    const reloadPeople = () => {
      if (epoch === store.cloudEpoch) void app.actions.loadPeople();
    };
    store.cloudChannel = store.cloud
      .channel('shared-items-' + user.id)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shared_items',
          filter: `shared_id=eq.${app.config.SHARED_ID}`,
        },
        reload,
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shared_items',
          filter: `shared_id=eq.${app.config.SHARED_ID}`,
        },
        reload,
      )
      // DELETE 不支持列过滤；这里只将其作为重新查询信号，不展示事件数据。
      // 重新 SELECT 时仍按 shared_id 过滤，并由数据库 RLS 强制鉴权。
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'shared_items',
        },
        reload,
      )
      .subscribe((status) => {
        if (epoch !== store.cloudEpoch) return;
        $('#syncState').textContent =
          status === 'SUBSCRIBED' ? '实时同步已连接' : '实时连接：' + status;
        if (status === 'SUBSCRIBED') {
          reload();
          reloadPeople();
        }
        if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          cloudMessage(
            '实时连接暂时中断，重连后会重新加载。请检查网络和 Realtime 配置。',
          );
        }
      });
    // 建立订阅后再加载；订阅成功和重连成功也重新加载，以补齐连接期间的变动。
    void app.actions.loadSharedItems();
    void app.actions.loadPeople();
    void app.actions.loadTogether();
  }
  async function initSharedCloud() {
    app.actions.initPeopleUI();
    app.actions.initTogetherUI();
    app.actions.initAccountActions();
    app.events.listen(window, 'hashchange', () => {
      app.actions.render();
      window.scrollTo({
        top: 0,
      });
    });
    $('#closePhoto').onclick = () => $('#photoLightbox').close();
    $('#photoLightbox').onclick = (e) => {
      if (e.target === $('#photoLightbox')) $('#photoLightbox').close();
    };
    $('#authForm').onsubmit = async (event) => {
      event.preventDefault();
      if (!store.cloud) return;
      const buttons = $('#authForm').querySelectorAll('button');
      buttons.forEach((button) => (button.disabled = true));
      cloudMessage('正在处理…');
      try {
        const credentials = {
          email: $('#authEmail').value.trim(),
          password: $('#authPassword').value,
        };
        const signup = event.submitter?.value === 'signup';
        const { data, error } = signup
          ? await store.cloud.auth.signUp(credentials)
          : await store.cloud.auth.signInWithPassword(credentials);
        if (error) throw error;
        $('#authPassword').value = '';
        cloudMessage(
          signup && !data.session
            ? '注册请求已提交，请查看确认邮件；已注册用户请直接登录。'
            : '登录成功，正在加载…',
        );
        if (data.session) await activateSession(data.session);
      } catch (error) {
        cloudMessage(friendlyError(error));
      } finally {
        buttons.forEach((button) => (button.disabled = false));
      }
    };
    if (
      !/^https:\/\//.test(app.config.SUPABASE_URL || '') ||
      !app.config.SUPABASE_ANON_KEY ||
      !app.config.SHARED_ID
    ) {
      cloudMessage(
        '请在同目录 supabase-config.js 中配置 Project URL、publishable key 和 SHARED_ID。',
      );
      return;
    }
    if (!window.supabase?.createClient) {
      cloudMessage('Supabase SDK 加载失败，请检查网络或 CDN。');
      return;
    }
    try {
      store.cloud = window.supabase.createClient(
        app.config.SUPABASE_URL,
        app.config.SUPABASE_ANON_KEY,
      );
      // 回调中不等待其他 Auth API，避免会话锁死；INITIAL_SESSION 也走这里。
      const authListener = store.cloud.auth.onAuthStateChange(
        (_event, session) => {
          app.timers.setTimeout(() => {
            void activateSession(session).catch((error) =>
              cloudMessage(friendlyError(error)),
            );
          }, 0);
        },
      );
      app.onDispose(() => authListener?.data?.subscription?.unsubscribe());
    } catch (error) {
      cloudMessage(friendlyError(error));
    }
    app.events.listen(window, 'online', () => {
      if (store.cloudUser) {
        void app.actions.loadSharedItems();
        void app.actions.loadPeople();
      }
    });
    app.events.listen(document, 'visibilitychange', () => {
      if (!document.hidden && store.cloudUser) {
        void app.actions.loadSharedItems();
        void app.actions.loadPeople();
      }
    });
  }
  // 个人资料独立保存，只有本人可写；空间内的两位成员可读。
  return {
    setSignedIn,
    requireCloudUser,
    activateSession,
    initSharedCloud,
  };
}
