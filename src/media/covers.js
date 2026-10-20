// 本地图片压缩、R2 预签名上传；头像仍由个人资料模块处理。
import { $ } from '../core/dom.js';
import { COVER_UPLOAD_WORKER_URL, R2_PUBLIC_BASE_URL } from '../core/config.js';
import { friendlyError } from '../core/errors.js';
export function createMediaCovers(app) {
  const store = app.state;
  function setupCoverUpload() {
    const input = $('#coverUpload');
    const url = $('[name=image]');
    const preview = $('#coverPreview');
    const message = $('#coverMessage');
    const save = $('#form button[type=submit]');
    function show() {
      preview.hidden = !url.value;
      preview.src = url.value;
    }
    show();
    app.events.listen(url, 'input', show);
    async function timedFetch(address, options, milliseconds) {
      const controller = new AbortController();
      const timer = app.timers.setTimeout(
        () => controller.abort(),
        milliseconds,
      );
      try {
        return await app.services.fetch(address, {
          ...options,
          signal: controller.signal,
        });
      } finally {
        app.timers.clearTimeout(timer);
      }
    }
    input.onchange = async () => {
      const file = input.files[0];
      if (!file || store.coverBusy) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        message.textContent = '请选择 JPG、PNG 或 WebP 图片。';
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        message.textContent = '请选择小于 20 MB 的图片。';
        return;
      }
      const epoch = store.cloudEpoch;
      let objectUrl,
        phase = '压缩图片';
      store.coverBusy = true;
      input.disabled = true;
      url.disabled = true;
      save.disabled = true;
      message.textContent = '正在压缩封面…';
      try {
        app.actions.requireCloudUser();
        objectUrl = URL.createObjectURL(file);
        const picture = new Image();
        await new Promise((resolve, reject) => {
          picture.onload = resolve;
          picture.onerror = () =>
            reject(new Error('无法读取图片，请更换文件。'));
          picture.src = objectUrl;
        });
        const scale = Math.min(
          1,
          400 / Math.max(picture.naturalWidth, picture.naturalHeight),
        );
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('浏览器无法创建图片压缩画布。');
        context.fillStyle = '#1b1c22';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(picture, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (value) =>
              value ? resolve(value) : reject(new Error('JPEG 压缩失败。')),
            'image/jpeg',
            0.6,
          );
        });
        phase = '获取上传地址';
        message.textContent = '正在获取 R2 上传地址…';
        const { data, error } = await store.cloud.auth.getSession();
        if (error) throw error;
        if (!data.session?.access_token)
          throw new Error('登录已失效，请重新登录。');
        const filename =
          (file.name.replace(/\.[^.]+$/, '') || 'cover') + '.jpg';
        const response = await timedFetch(
          COVER_UPLOAD_WORKER_URL,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + data.session.access_token,
            },
            body: JSON.stringify({
              filename,
              contentType: 'image/jpeg',
            }),
          },
          20000,
        );
        let result;
        try {
          result = await response.json();
        } catch {
          throw new Error(
            `Worker 没有返回有效 JSON（HTTP ${response.status}）。`,
          );
        }
        if (!response.ok)
          throw new Error(
            result.error || `Worker 请求失败（HTTP ${response.status}）。`,
          );
        if (
          typeof result.uploadUrl !== 'string' ||
          typeof result.publicUrl !== 'string'
        )
          throw new Error('Worker 响应缺少 uploadUrl 或 publicUrl。');
        const upload = new URL(result.uploadUrl);
        const publicAddress = new URL(result.publicUrl);
        if (
          upload.protocol !== 'https:' ||
          upload.username ||
          upload.password ||
          !upload.hostname.endsWith('.r2.cloudflarestorage.com') ||
          !upload.pathname.startsWith('/covers/covers/') ||
          publicAddress.origin !== new URL(R2_PUBLIC_BASE_URL).origin ||
          !publicAddress.pathname.startsWith('/covers/')
        )
          throw new Error('Worker 返回的上传地址或公开域名不符合配置。');
        phase = 'PUT 上传图片';
        message.textContent = '正在上传封面到 R2…';
        const uploaded = await timedFetch(
          upload.href,
          {
            method: 'PUT',
            // 必须与签名时一致；不要附带 Supabase Authorization。
            headers: {
              'Content-Type': 'image/jpeg',
            },
            body: blob,
          },
          120000,
        );
        if (!uploaded.ok)
          throw new Error(
            `R2 上传失败（HTTP ${uploaded.status}），请检查签名、Content-Type 和桶权限。`,
          );
        if (epoch !== store.cloudEpoch || !url.isConnected)
          throw new Error('登录状态或编辑窗口已变化，请重新打开记录。');
        // 原表单保存逻辑会将这个输入框的值写入 data.image。
        // 只有上传成功后才替换，因此失败时保留原封面链接。
        url.value = publicAddress.href;
        show();
        message.textContent =
          '封面已上传。点击「保存记录」后，两个人都能看到。';
      } catch (error) {
        const detail =
          error.name === 'AbortError'
            ? '请求超时，请稍后重试。'
            : error instanceof TypeError
              ? '网络请求失败，请检查 Worker 与 R2 的 CORS、网址及网络。'
              : friendlyError(error);
        message.textContent = `封面上传失败（${phase}）：${detail} 可改用图片链接。`;
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        store.coverBusy = false;
        input.disabled = false;
        url.disabled = false;
        save.disabled = false;
      }
    };
  }
  async function compressTravelImage(file) {
    const address = URL.createObjectURL(file);
    try {
      const picture = new Image();
      await new Promise((resolve, reject) => {
        picture.onload = resolve;
        picture.onerror = () => reject(new Error('无法读取图片，请更换文件'));
        picture.src = address;
      });
      const scale = Math.min(
          1,
          1000 / Math.max(picture.naturalWidth, picture.naturalHeight),
        ),
        canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw Error('浏览器无法压缩图片');
      context.fillStyle = '#1b1c22';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(picture, 0, 0, canvas.width, canvas.height);
      return await new Promise((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(Error('图片压缩失败'))),
          'image/jpeg',
          0.75,
        ),
      );
    } finally {
      URL.revokeObjectURL(address);
    }
  }
  async function uploadR2Photo(blob, name) {
    const { data, error } = await store.cloud.auth.getSession();
    if (error) throw error;
    if (!data.session?.access_token) throw Error('登录已失效，请重新登录');
    async function request(url, options, timeout) {
      const controller = new AbortController(),
        timer = app.timers.setTimeout(() => controller.abort(), timeout);
      try {
        return await app.services.fetch(url, {
          ...options,
          signal: controller.signal,
        });
      } finally {
        app.timers.clearTimeout(timer);
      }
    }
    const response = await request(
      COVER_UPLOAD_WORKER_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + data.session.access_token,
        },
        body: JSON.stringify({
          filename:
            (name.replace(/\.[^.]+$/, '').slice(0, 140) || 'travel') + '.jpg',
          contentType: 'image/jpeg',
        }),
      },
      20000,
    );
    let result;
    try {
      result = await response.json();
    } catch {
      throw Error(`Worker 返回无效 JSON（HTTP ${response.status}）`);
    }
    if (!response.ok)
      throw Error(result.error || `Worker 请求失败（HTTP ${response.status}）`);
    const upload = new URL(result.uploadUrl),
      publicAddress = new URL(result.publicUrl);
    if (
      upload.protocol !== 'https:' ||
      upload.username ||
      upload.password ||
      !upload.hostname.endsWith('.r2.cloudflarestorage.com') ||
      !upload.pathname.startsWith('/covers/covers/') ||
      publicAddress.origin !== new URL(R2_PUBLIC_BASE_URL).origin ||
      !publicAddress.pathname.startsWith('/covers/')
    )
      throw Error('上传地址或公开域名不符合配置');
    const put = await request(
      upload.href,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/jpeg',
        },
        body: blob,
      },
      120000,
    );
    if (!put.ok)
      throw Error(`R2 上传失败（HTTP ${put.status}），请检查 CORS 和签名`);
    return publicAddress.href;
  }
  return {
    setupCoverUpload,
    compressTravelImage,
    uploadR2Photo,
  };
}
