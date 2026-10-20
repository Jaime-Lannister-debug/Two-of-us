// 条目详情页及图片大图操作。
import { $, esc } from '../core/dom.js';
import { travelPhotos, cats, status, travelDates } from './model.js';
export function createCollectionsDetails(app) {
  const store = app.state;
  function bindDetailImages() {
    $('#content')
      .querySelectorAll('img')
      .forEach((image) =>
        app.events.listen(
          image,
          'error',
          () => {
            image.hidden = true;
          },
          {
            once: true,
          },
        ),
      );
    $('#content')
      .querySelectorAll('[data-photo]')
      .forEach(
        (button) =>
          (button.onclick = () => {
            const dialog = $('#photoLightbox');
            $('#largePhoto').src = button.dataset.photo;
            dialog.showModal();
          }),
      );
  }
  function renderDetail(id) {
    const item = store.records.find((r) => r.id === id),
      host = $('#content');
    host.setAttribute('aria-busy', String(store.listLoading));
    if (!item) {
      host.innerHTML = `<button class="btn secondary" id="backDetail">← 返回列表</button><p class="empty">${store.listLoading ? '正在加载这份回忆…' : '记录已删除或你没有访问权限。'}</p>`;
      $('#backDetail').onclick = app.actions.leaveDetails;
      return;
    }
    const pics = travelPhotos(item),
      cover = item.image || item.coverImage;
    const visual =
      item.cat === 'travel'
        ? `<div class="orbit-gallery">${pics.length ? pics.map((url, i) => `<button type="button" class="orbit-photo ${i === 0 ? 'orbit-cover' : ''}" data-photo="${esc(url)}" aria-label="查看${i === 0 ? '封面' : '旅行照片 ' + i}"><img src="${esc(url)}" alt="${esc(item.title)}${i === 0 ? '封面' : '旅行照片 ' + i}"></button>`).join('') : '<div class="orbit-empty">上传照片，收藏这次旅程</div>'}</div>`
        : `<div class="detail-cover">${cover ? `<button type="button" data-photo="${esc(cover)}" aria-label="查看封面"><img src="${esc(cover)}" alt="${esc(item.title)}封面"></button>` : '<span>暂无封面</span>'}</div>`;
    host.innerHTML = `<div class="detail-toolbar"><button class="btn secondary" id="backDetail">← 返回列表</button><button class="btn" id="editDetail">编辑这份回忆</button></div><section class="detail-page ${item.cat === 'travel' ? 'travel-detail' : ''}">${visual}<div class="detail-copy"><p class="eyebrow">${esc(cats[item.cat][1])} · ${esc(item.sub)}</p><h1>${esc(item.title)}</h1><p class="subtitle">${esc(status[item.state])} · ★ ${item.score ? Number(item.score).toFixed(1) : '待评分'}</p>${app.actions.genreBadges(item)}<p>${esc(item.desc)}</p>${app.actions.progressCard(item)}<dl><dt>${item.cat === 'travel' ? '旅行日期' : '日期'}</dt><dd>${esc(item.cat === 'travel' ? travelDates(item) : item.date || '尚未填写')}</dd>${item.place ? `<dt>地点</dt><dd>${esc(item.place)}</dd>` : ''}${item.brand ? `<dt>品牌</dt><dd>${esc(item.brand)}</dd>` : ''}</dl>${item.musicUrl ? `<a class="btn secondary" target="_blank" rel="noopener noreferrer" href="${esc(item.musicUrl)}">在 QQ 音乐打开 ↗</a>` : ''}<h3>我们的感想</h3><p class="detail-note">${esc(item.note || '还没有写下感想。')}</p></div></section>${item.cat === 'travel' ? `<section class="detail-panel"><h2>旅途相册</h2><p class="subtitle">${pics.length} / 10 张（含封面）。第一张居中，其余环绕。照片存于公开 R2，持链接可访问。</p><button class="btn secondary travel-upload-button" id="travelUploadButton" type="button" ${store.galleryBusy ? 'disabled' : ''}>＋ 上传旅行照片</button><input id="travelPhotoUpload" type="file" accept="image/jpeg,image/png,image/webp" aria-label="选择旅行照片" multiple hidden ${store.galleryBusy ? 'disabled' : ''}><p id="galleryMessage" role="status">${store.galleryBusy ? '正在上传照片，请稍候…' : ''}</p><div class="photo-manage">${pics.map((url, i) => `<div><img src="${esc(url)}" alt="照片 ${i + 1}"><button type="button" class="btn secondary" data-remove-photo="${i}" ${store.galleryBusy ? 'disabled' : ''}>移除${i === 0 ? '封面' : '照片'}</button></div>`).join('')}</div><h2>入住记录</h2><div class="hotels-detail">${(item.hotels || []).map((h) => `<article><h3>${esc(h.name)}</h3><p>${esc(h.checkIn || '未填入住日期')} — ${esc(h.checkOut || '未填退房日期')}</p><p>${esc(h.note)}</p></article>`).join('') || '<p class="subtitle">编辑这份回忆，可添加多家酒店。</p>'}</div></section>` : ''}`;
    $('#backDetail').onclick = app.actions.leaveDetails;
    $('#editDetail').onclick = () => app.actions.openForm(id);
    bindDetailImages();
    if (item.cat === 'travel') {
      $('#travelUploadButton').onclick = () => $('#travelPhotoUpload').click();
      $('#travelPhotoUpload').onchange = (e) =>
        void app.actions.uploadTravelPhotos(id, [...e.target.files]);
      host
        .querySelectorAll('[data-remove-photo]')
        .forEach(
          (b) =>
            (b.onclick = () =>
              void app.actions.removeTravelPhoto(
                id,
                Number(b.dataset.removePhoto),
              )),
        );
    }
  }
  return {
    bindDetailImages,
    renderDetail,
  };
}
