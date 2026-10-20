// 旅行相册、十张上限与图片引用保存。
import { travelPhotos } from '../model.js';
import { $, toast } from '../../core/dom.js';
import { friendlyError } from '../../core/errors.js';
export function createCollectionsTravelGallery(app) {
  const store = app.state;
  async function uploadTravelPhotos(id, files) {
    if (store.galleryBusy || store.writeBusy || store.coverBusy) return;
    const item = store.records.find((r) => r.id === id),
      row = store.rawRows.get(id);
    if (!item || !row) return;
    const existing = travelPhotos(item),
      remaining = 10 - existing.length,
      message = $('#galleryMessage');
    if (!files.length) return;
    if (files.length > remaining) {
      message.textContent = `最多十张（含封面），还可上传 ${remaining} 张。`;
      return;
    }
    if (
      files.some(
        (f) =>
          !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) ||
          f.size > 20 * 1024 * 1024,
      )
    ) {
      message.textContent = '请选择每张小于 20 MB 的 JPG、PNG 或 WebP 图片。';
      return;
    }
    const epoch = store.cloudEpoch;
    store.galleryBusy = true;
    app.actions.render();
    try {
      app.actions.requireCloudUser();
      const uploaded = [];
      for (const [i, file] of files.entries()) {
        if (epoch !== store.cloudEpoch)
          throw Error('登录状态已变化，请重新打开记录');
        const status = $('#galleryMessage');
        if (status)
          status.textContent = `正在上传 ${i + 1} / ${files.length} 张…`;
        uploaded.push(
          await app.actions.uploadR2Photo(
            await app.actions.compressTravelImage(file),
            file.name,
          ),
        );
      }
      if (epoch !== store.cloudEpoch)
        throw Error('登录状态已变化，请重新打开记录');
      const all = [...existing, ...uploaded],
        data = {
          ...item,
          image: all[0],
          photos: all.slice(1),
        };
      delete data.id;
      await app.actions.saveSharedItem(data, id, row.content);
      if (epoch !== store.cloudEpoch) return;
      await app.actions.loadSharedItems();
      toast('旅行照片已保存并同步');
    } catch (error) {
      if (epoch === store.cloudEpoch) {
        const status = $('#galleryMessage');
        if (status) status.textContent = '上传失败：' + friendlyError(error);
        toast('上传失败：' + friendlyError(error));
      }
    } finally {
      store.galleryBusy = false;
      if (epoch === store.cloudEpoch && app.actions.detailId() === id) {
        const status = $('#galleryMessage')?.textContent || '';
        app.actions.render();
        if (status.startsWith('上传失败'))
          $('#galleryMessage').textContent = status;
      }
    }
  }
  async function removeTravelPhoto(id, index) {
    if (
      store.galleryBusy ||
      store.writeBusy ||
      store.coverBusy ||
      !confirm('从这份回忆中移除照片？R2 原文件不会被删除。')
    )
      return;
    const item = store.records.find((r) => r.id === id),
      row = store.rawRows.get(id);
    if (!item || !row) return;
    const epoch = store.cloudEpoch;
    store.galleryBusy = true;
    try {
      const pics = travelPhotos(item);
      pics.splice(index, 1);
      const data = {
        ...item,
        image: pics[0] || '',
        photos: pics.slice(1),
      };
      delete data.id;
      await app.actions.saveSharedItem(data, id, row.content);
      if (epoch === store.cloudEpoch) await app.actions.loadSharedItems();
    } catch (error) {
      if (epoch === store.cloudEpoch) toast(friendlyError(error));
    } finally {
      store.galleryBusy = false;
      if (epoch === store.cloudEpoch) app.actions.render();
    }
  }
  // 仅向 QQ 官方固定 API 发起 JSONP；分享地址需严格校验，不能作为脚本地址使用。
  return {
    uploadTravelPhotos,
    removeTravelPhoto,
  };
}
