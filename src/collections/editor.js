// 原有收藏编辑弹窗、保存、删除与键盘焦点管理。
import { toast, $, field, select, esc } from '../core/dom.js';
import {
  cats,
  subs,
  parseGenres,
  stateLabels,
  genreSuggestions,
  hasProgress,
  progressValue,
  normalizeItem,
  img,
} from './model.js';
import { friendlyError } from '../core/errors.js';
export function createCollectionsEditor(app) {
  const store = app.state;
  function openForm(id) {
    if (store.writeBusy || store.coverBusy || store.galleryBusy) return;
    store.modalTrigger = document.activeElement;
    if (!store.cloudUser) {
      toast('请先登录');
      return;
    }
    if (id && !store.rawRows.has(id)) {
      toast('记录已删除，请重新选择');
      return;
    }
    store.editingExpectedContent = id ? store.rawRows.get(id).content : null;
    store.editing = id || null;
    const r = store.records.find((x) => x.id === id) || {
      cat: store.page === 'home' ? 'film' : store.page,
      state: 'wish',
      score: 0,
      date: new Date().toLocaleDateString('en-CA'),
      sub: '',
    };
    $('#fields').innerHTML = '';
    $('#dialogTitle').textContent = id ? '编辑这份回忆' : '新增一份美好';
    $('#delete').hidden = !id;
    $('#fields').innerHTML =
      field('title', '名字', 'text', r.title || '', true) +
      select(
        'cat',
        '板块',
        Object.fromEntries(
          Object.entries(cats)
            .filter(([k]) => k !== 'home')
            .map(([k, v]) => [k, v[1]]),
        ),
        r.cat,
      ) +
      select(
        'sub',
        '分类',
        Object.fromEntries(subs[r.cat].map((s) => [s, s])),
        r.sub,
      ) +
      field(
        'genres',
        '类型标签（多个用逗号分隔，可自定义）',
        'text',
        parseGenres(r.genres).join('，'),
        true,
      ) +
      `<div class="field full" id="genreSuggestions"></div>` +
      select('state', '清单状态', stateLabels(r.cat, r.sub), r.state) +
      field('score', '我们的评分（0–10，0 表示未评分）', 'number', r.score) +
      field('date', '日期 / 旅行开始日期', 'date', r.date) +
      field('image', '海报图片链接（也可直接上传）', 'text', r.image || '') +
      `<label class="field full">上传本地封面<input id="coverUpload" type="file" accept="image/jpeg,image/png,image/webp"><small id="coverMessage">支持 JPG、PNG、WebP；最长边 400px，压缩后上传 R2，保存记录后同步。</small><img id="coverPreview" alt="封面预览" style="max-width:140px;max-height:180px;object-fit:contain;border-radius:8px" hidden></label>` +
      field('desc', '简介 / 游玩项目', 'text', r.desc || '', true) +
      `<div class="field full" id="progressEditor"></div><div class="field full" id="extra"></div>` +
      field(
        'note',
        r.cat === 'intimacy' ? '感受' : '我们的感想',
        'textarea',
        r.note || '',
        true,
      );
    const cat = $('[name=cat]');
    function extras() {
      const c = cat.value;
      $('#genreSuggestions').innerHTML =
        '<div class="genre-options">' +
        genreSuggestions[c]
          .map(
            (t) =>
              `<button type="button" class="chip" data-genre-add="${esc(t)}">＋ ${esc(t)}</button>`,
          )
          .join('') +
        '</div>';
      $('#genreSuggestions')
        .querySelectorAll('[data-genre-add]')
        .forEach(
          (b) =>
            (b.onclick = () => {
              const input = $('[name=genres]');
              input.value = parseGenres([
                ...parseGenres(input.value),
                b.dataset.genreAdd,
              ]).join('，');
            }),
        );
      $('#extra').innerHTML =
        c === 'travel'
          ? `<div class="formgrid">${field('place', '目的地', 'text', r.place || '')}${field('endDate', '旅行结束日期', 'date', r.endDate || r.date || '')}${field('lat', '纬度', 'number', r.lat ?? (id ? '' : (store.selectedTripPoint?.lat ?? '')))}${field('lng', '经度', 'number', r.lng ?? (id ? '' : (store.selectedTripPoint?.lng ?? '')))}<div class="field full" id="hotelEditor"></div><p class="subtitle">保存后进入详情页，最多可添加十张旅行照片（含封面）。</p></div>`
          : c === 'music'
            ? `${field('musicUrl', 'QQ 音乐链接（可选）', 'url', r.musicUrl || '', true)}<label class="field full">粘贴 QQ 音乐分享文字或链接<textarea id="qqShareInput" placeholder="支持歌曲、专辑详情链接或完整分享文字"></textarea></label><button type="button" class="btn secondary" id="readQQMusic">读取音乐信息</button><p id="qqMessage" role="status"></p>`
            : c === 'intimacy'
              ? `<div class="formgrid">${field('place', '地点', 'text', r.place || '')}${field('brand', '套套品牌', 'text', r.brand || '')}</div>`
              : '';
      if (c === 'travel') app.actions.setupTravelEditor(r);
      if (c === 'music') app.actions.setupMusicImport();
    }
    cat.onchange = () => {
      $('[name=sub]').innerHTML = subs[cat.value]
        .map((s) => `<option>${s}</option>`)
        .join('');
      extras();
    };
    app.actions.setupProgressEditor(r);
    app.actions.setupCoverUpload();
    extras();
    if (r.coverSource) {
      const note = document.createElement('p');
      note.className = 'cover-credit';
      const a = document.createElement('a');
      a.href = r.coverSource;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = '封面来源：The Cover Project ↗';
      note.appendChild(a);
      $('#fields').appendChild(note);
    }
    $('#modal').hidden = false;
    $('[name=title]').focus();
  }
  function closeModal() {
    if (store.writeBusy || store.coverBusy) return;
    const wasOpen = !$('#modal').hidden;
    $('#modal').hidden = true;
    if (wasOpen) {
      const replacement = store.modalTrigger?.dataset?.id
        ? document.querySelector(
            '[data-id="' + store.modalTrigger.dataset.id + '"]',
          )
        : null;
      (store.modalTrigger?.isConnected
        ? store.modalTrigger
        : replacement || $('#add')
      ).focus();
    }
  }
  function initEditor() {
    $('#cancel').onclick = closeModal;
    $('#modal').onclick = (e) => {
      if (e.target === $('#modal')) closeModal();
    };
    app.events.listen(document, 'keydown', (e) => {
      if ($('#modal').hidden) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key === 'Tab') {
        const nodes = [
          ...$('#form').querySelectorAll(
            'button,input,select,textarea,a[href]',
          ),
        ].filter((n) => !n.disabled && !n.hidden && n.getClientRects().length);
        const first = nodes[0],
          last = nodes.at(-1);
        if (!first) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            !$('#form').contains(document.activeElement))
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !$('#form').contains(document.activeElement))
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    });
    $('#delete').onclick = async () => {
      if (store.writeBusy || !store.cloudUser || !store.editing) return;
      if (!confirm('确定删除这条共享记录？对方也会同步删除。')) return;
      const epoch = store.cloudEpoch,
        id = store.editing;
      store.writeBusy = true;
      $('#delete').disabled = true;
      try {
        await app.actions.deleteSharedItem(id);
        if (epoch !== store.cloudEpoch) return;
        store.writeBusy = false;
        closeModal();
        await app.actions.loadSharedItems();
        toast('记录已删除');
      } catch (error) {
        if (epoch === store.cloudEpoch) toast(friendlyError(error));
      } finally {
        store.writeBusy = false;
        $('#delete').disabled = false;
      }
    };
    $('#form').onsubmit = async (e) => {
      e.preventDefault();
      if (store.writeBusy || store.coverBusy || !store.cloudUser) return;
      const data = {
        ...(store.records.find((r) => r.id === store.editing) || {}),
        ...Object.fromEntries(new FormData(e.target)),
      };
      data.genres = parseGenres(data.genres);
      if (data.cat === 'travel') {
        try {
          data.hotels = JSON.parse(data.hotelsJSON || '[]');
        } catch {
          toast('酒店信息无效，请重新填写');
          return;
        }
        if (data.endDate && data.date && data.endDate < data.date) {
          toast('旅行结束日期不能早于开始日期');
          return;
        }
        if (
          data.hotels.some(
            (h) => h.checkIn && h.checkOut && h.checkOut < h.checkIn,
          )
        ) {
          toast('酒店退房日期不能早于入住日期');
          return;
        }
      }
      delete data.hotelsJSON;
      delete data.playHoursSlider;
      if (hasProgress(data)) {
        data.playHours = Math.max(0, Number(data.playHours) || 0);
        data.currentEpisode = Math.max(0, Number(data.currentEpisode) || 0);
        data.progress = Number(data.progress) || 0;
        data.watchedEpisodes = Number(data.watchedEpisodes) || 0;
        data.totalEpisodes = Number(data.totalEpisodes) || 0;
        if (data.state === 'wish') {
          data.progress = 0;
          data.watchedEpisodes = 0;
          data.currentEpisode = 0;
        }
        if (data.state === 'done') {
          data.progress = 100;
          if (data.totalEpisodes > 0) data.watchedEpisodes = data.totalEpisodes;
        }
        data.progress = progressValue(data);
      }
      data.score = Number(data.score);
      normalizeItem(data);
      data.image =
        data.image ||
        (['game', 'travel'].includes(data.cat)
          ? ''
          : img(data.cat === 'intimacy' ? 'night' : 'lake'));
      const epoch = store.cloudEpoch,
        id = store.editing,
        expected = store.editingExpectedContent;
      delete data.id;
      store.writeBusy = true;
      const save = $('#form button[type=submit]');
      save.disabled = true;
      try {
        await app.actions.saveSharedItem(data, id, expected);
        if (epoch !== store.cloudEpoch) return;
        if (data.cat === 'travel') store.selectedTripPoint = null;
        store.writeBusy = false;
        closeModal();
        await app.actions.loadSharedItems();
        toast('已保存到共享空间');
      } catch (error) {
        if (epoch === store.cloudEpoch) toast(friendlyError(error));
      } finally {
        store.writeBusy = false;
        save.disabled = false;
      }
    };

    // 事件委托同时覆盖筛选器、表单和日历动态创建的按钮。
  }
  return {
    openForm,
    closeModal,
    initEditor,
  };
}
