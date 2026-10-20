// 条目查询与增删改；保留乐观并发 RPC 契约。
import {
  decodeRow,
  normalizeItem,
  validCoverSize,
} from '../collections/model.js';
import { cloudMessage } from '../core/dom.js';
import { friendlyError } from '../core/errors.js';
export function createDataItems(app) {
  const store = app.state;
  async function loadSharedItems() {
    if (!store.cloudUser) return;
    const epoch = store.cloudEpoch,
      version = ++store.loadVersion;
    store.listLoading = true;
    app.actions.render();
    try {
      // 分页读取，避免超过默认行数限制时悄悄丢掉较早的条目。
      const rows = [];
      for (let start = 0; ; start += 500) {
        const { data, error } = await store.cloud
          .from('shared_items')
          .select('id,content,shared_id,created_by,created_at')
          .eq('shared_id', app.config.SHARED_ID)
          .order('created_at', {
            ascending: true,
          })
          .order('id', {
            ascending: true,
          })
          .range(start, start + 499);
        if (error) throw error;
        if (epoch !== store.cloudEpoch || version !== store.loadVersion) return;
        rows.push(...data);
        if (data.length < 500) break;
      }
      if (
        epoch !== store.cloudEpoch ||
        version !== store.loadVersion ||
        !store.cloudUser
      )
        return;
      store.rawRows.clear();
      rows.forEach((row) => store.rawRows.set(row.id, row));
      store.records = rows.map(decodeRow);
      store.listLoading = false;
      app.actions.render();
      cloudMessage('共享列表已更新');
    } catch (error) {
      if (epoch === store.cloudEpoch && version === store.loadVersion) {
        store.listLoading = false;
        app.actions.render();
        cloudMessage('加载失败：' + friendlyError(error));
      }
    }
  }
  async function saveSharedItem(item, id, expectedContent) {
    app.actions.requireCloudUser();
    normalizeItem(item);
    validCoverSize(item);
    const content = JSON.stringify(item);
    if (id) {
      // 原子替换保留编辑体验，无需新增 UPDATE 策略；并发冲突由数据库检查。
      const { error } = await store.cloud.rpc('replace_shared_item', {
        p_id: id,
        p_content: content,
        p_expected_content: expectedContent,
      });
      if (error) throw error;
    } else {
      // 不传 created_by，由数据库 auth.uid() 自动填写；RLS 同时防止伪造。
      const { error } = await store.cloud.from('shared_items').insert({
        content,
        shared_id: app.config.SHARED_ID,
      });
      if (error) throw error;
    }
  }
  async function deleteSharedItem(id) {
    app.actions.requireCloudUser();
    const { data, error } = await store.cloud
      .from('shared_items')
      .delete()
      .eq('id', id)
      .eq('shared_id', app.config.SHARED_ID)
      .select('id');
    if (error) throw error;
    if (!data.length) throw new Error('这条记录已删除，或你没有删除权限。');
  }
  return {
    loadSharedItems,
    saveSharedItem,
    deleteSharedItem,
  };
}
