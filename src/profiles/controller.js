// 双人资料、个人资料弹窗与左上角菜单。
import { profileName, profileAvatar } from './model.js';
import { $, toast } from '../core/dom.js';
import { friendlyError } from '../core/errors.js';
export function createProfilesController(app) {
  const store = app.state;
  function renderPeople() {
    for (let index = 0; index < 2; index++) {
      const person = store.sharedPeople[index],
        name = profileName(person, index),
        box = $('#person' + index);
      box.replaceChildren();
      const circle = document.createElement('span');
      circle.className = 'person-photo';
      const picture = profileAvatar(person?.avatar);
      circle.textContent = Array.from(name)[0] || '我';
      if (picture) {
        const image = document.createElement('img');
        image.src = picture;
        image.alt = '';
        app.events.listen(image, 'error', () => image.remove(), {
          once: true,
        });
        circle.append(image);
      }
      const label = document.createElement('span');
      label.className = 'person-name';
      label.textContent = name;
      box.append(circle, label);
    }
    $('#peopleToggle').setAttribute(
      'aria-label',
      store.sharedPeople.map(profileName).join('和') + '，打开个人菜单',
    );
  }
  function profilesError(error) {
    const text = String(error?.message || error || '');
    return /PGRST202|PGRST205|schema cache|get_shared_people|does not exist/.test(
      text,
    )
      ? '个人资料同步尚未启用，请执行 04-shared-profiles.sql。'
      : friendlyError(error);
  }
  async function loadPeople() {
    if (!store.cloudUser) return;
    const epoch = store.cloudEpoch,
      version = ++store.peopleVersion;
    try {
      const { data, error } = await store.cloud.rpc('get_shared_people', {
        p_shared_id: app.config.SHARED_ID,
      });
      if (error) throw error;
      if (epoch !== store.cloudEpoch || version !== store.peopleVersion) return;
      store.sharedPeople = (data || []).map((p) => ({
        user_id: p.user_id,
        nickname: String(p.nickname || '').slice(0, 24),
        avatar: profileAvatar(p.avatar),
      }));
      renderPeople();
      $('#profileHint').textContent = '';
      if (!store.profilesChannel) {
        const reload = () => {
          if (epoch === store.cloudEpoch) void loadPeople();
        };
        store.profilesChannel = store.cloud
          .channel('shared-profiles-' + store.cloudUser.id)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'shared_profiles',
              filter: `shared_id=eq.${app.config.SHARED_ID}`,
            },
            reload,
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'shared_profiles',
              filter: `shared_id=eq.${app.config.SHARED_ID}`,
            },
            reload,
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'shared_profiles',
            },
            reload,
          )
          .subscribe((status) => {
            if (epoch !== store.cloudEpoch) return;
            if (status === 'SUBSCRIBED') reload();
            if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status))
              $('#profileHint').textContent =
                '个人资料实时连接暂时中断，重连后会重新加载。';
          });
      }
    } catch (error) {
      if (epoch === store.cloudEpoch && version === store.peopleVersion)
        $('#profileHint').textContent = profilesError(error);
    }
  }
  function closePeopleMenu(restore = true) {
    const wasOpen = !$('#peopleMenu').hidden;
    $('#peopleMenu').hidden = true;
    $('#peopleToggle').setAttribute('aria-expanded', 'false');
    if (wasOpen && restore) $('#peopleToggle').focus();
  }
  function closeProfile() {
    if (store.avatarBusy || store.profileSaving) return;
    $('#profileModal').hidden = true;
    (store.profileReturnFocus?.isConnected
      ? store.profileReturnFocus
      : $('#peopleToggle')
    ).focus();
  }
  function refreshAvatarPreview() {
    const preview = $('#myAvatarPreview');
    preview.replaceChildren();
    if (profileAvatar(store.profileAvatarDraft)) {
      const image = document.createElement('img');
      image.src = store.profileAvatarDraft;
      image.alt = '我的头像预览';
      preview.append(image);
    } else
      preview.textContent = ($('#myNickname').value.trim() || '我').slice(0, 1);
  }
  function initPeopleUI() {
    renderPeople();
    $('#peopleToggle').onclick = () => {
      const open = $('#peopleMenu').hidden;
      $('#peopleMenu').hidden = !open;
      $('#peopleToggle').setAttribute('aria-expanded', String(open));
      if (open) $('#peopleMenu button:not([hidden])').focus();
    };
    app.events.listen(document, 'click', (event) => {
      if (!$('#peopleArea').contains(event.target)) closePeopleMenu(false);
    });
    app.events.listen($('#peopleArea'), 'keydown', (event) => {
      if ($('#peopleMenu').hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closePeopleMenu();
        return;
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const buttons = [...$('#peopleMenu').querySelectorAll('button')].filter(
            (b) => !b.hidden && !b.disabled,
          ),
          i = buttons.indexOf(document.activeElement);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? buttons.length - 1
              : (i + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) %
                buttons.length;
        buttons[next]?.focus();
      }
    });
    // Safari 点击按钮时可能先产生 relatedTarget=null 的 focusout，不能在此时隐藏菜单。
    // 改为焦点真正进入外部元素时关闭，避免按钮在 click 派发前消失。
    app.events.listen(document, 'focusin', (event) => {
      if (!$('#peopleArea').contains(event.target)) closePeopleMenu(false);
    });
    for (const id of ['exportBackup', 'inviteSpace', 'joinSpace', 'logout'])
      app.events.listen($('#' + id), 'click', () => closePeopleMenu(false));
    $('#editProfile').onclick = () => {
      store.profileReturnFocus = $('#peopleToggle');
      closePeopleMenu(false);
      const me = store.sharedPeople.find(
        (p) => p.user_id === store.cloudUser?.id,
      );
      $('#myNickname').value = me?.nickname || '';
      store.profileAvatarDraft = profileAvatar(me?.avatar);
      $('#myAvatarFile').value = '';
      $('#profileFormMessage').textContent =
        '头像和昵称仅可修改自己的，对方会同步看到。';
      refreshAvatarPreview();
      $('#profileModal').hidden = false;
      $('#myNickname').focus();
    };
    $('#myNickname').oninput = refreshAvatarPreview;
    $('#profileCancel').onclick = closeProfile;
    $('#profileModal').onclick = (e) => {
      if (e.target === $('#profileModal')) closeProfile();
    };
    $('#removeMyAvatar').onclick = () => {
      if (store.avatarBusy || store.profileSaving) return;
      store.profileAvatarDraft = '';
      refreshAvatarPreview();
    };
    $('#myAvatarFile').onchange = async () => {
      const file = $('#myAvatarFile').files[0];
      if (!file) return;
      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size > 20 * 1024 * 1024
      ) {
        $('#profileFormMessage').textContent =
          '请选择 20 MB 以内的 JPG、PNG 或 WebP 图片。';
        return;
      }
      store.avatarBusy = true;
      $('#profileSave').disabled = true;
      let objectURL;
      try {
        objectURL = URL.createObjectURL(file);
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          image.src = objectURL;
        });
        const canvas = document.createElement('canvas');
        canvas.width = 192;
        canvas.height = 192;
        const context = canvas.getContext('2d'),
          side = Math.min(image.width, image.height);
        context.fillStyle = '#34302e';
        context.fillRect(0, 0, 192, 192);
        context.drawImage(
          image,
          (image.width - side) / 2,
          (image.height - side) / 2,
          side,
          side,
          0,
          0,
          192,
          192,
        );
        const avatar = canvas.toDataURL('image/jpeg', 0.78);
        if (avatar.length > 60000)
          throw new Error('头像过大，请换一张简单的图片。');
        store.profileAvatarDraft = avatar;
        refreshAvatarPreview();
        $('#profileFormMessage').textContent = '头像已准备，点击保存后同步。';
      } catch (error) {
        $('#profileFormMessage').textContent =
          error.message || '头像读取失败，请重新选择。';
      } finally {
        if (objectURL) URL.revokeObjectURL(objectURL);
        store.avatarBusy = false;
        $('#profileSave').disabled = false;
      }
    };
    $('#profileForm').onsubmit = async (event) => {
      event.preventDefault();
      if (store.avatarBusy || store.profileSaving) return;
      const epoch = store.cloudEpoch;
      store.profileSaving = true;
      $('#profileSave').disabled = true;
      try {
        app.actions.requireCloudUser();
        const nickname = $('#myNickname').value.trim();
        if (nickname.length > 24) throw new Error('昵称最多 24 个字符。');
        const { error } = await store.cloud.from('shared_profiles').upsert(
          {
            shared_id: app.config.SHARED_ID,
            user_id: store.cloudUser.id,
            nickname,
            avatar: store.profileAvatarDraft,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'shared_id,user_id',
          },
        );
        if (error) throw error;
        if (epoch !== store.cloudEpoch) return;
        await loadPeople();
        store.profileSaving = false;
        closeProfile();
        toast('头像和昵称已保存');
      } catch (error) {
        if (epoch === store.cloudEpoch)
          $('#profileFormMessage').textContent = profilesError(error);
      } finally {
        store.profileSaving = false;
        $('#profileSave').disabled = false;
      }
    };
    app.events.listen(document, 'keydown', (event) => {
      if ($('#profileModal').hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeProfile();
        return;
      }
      if (event.key === 'Tab') {
        const nodes = [
            ...$('#profileForm').querySelectorAll('button,input'),
          ].filter((n) => !n.disabled && n.getClientRects().length),
          first = nodes[0],
          last = nodes.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !$('#profileForm').contains(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !$('#profileForm').contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }

  // 详情页沿用单文件，以 hash 保存当前条目，刷新后仍可打开；数据权限继续由 RLS 控制。
  return {
    renderPeople,
    profilesError,
    loadPeople,
    closePeopleMenu,
    closeProfile,
    refreshAvatarPreview,
    initPeopleUI,
  };
}
