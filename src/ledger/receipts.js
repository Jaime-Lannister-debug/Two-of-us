// 私有 R2 凭证只经鉴权 Worker 读取为本地 Blob URL，不保存公开链接或会话。
export function ledgerReceipts(app) {
  const requests = new Set(),
    urls = new Set();
  function dispose() {
    for (const c of requests) c.abort();
    requests.clear();
    for (const url of urls) URL.revokeObjectURL(url);
    urls.clear();
  }
  app.onDispose(dispose);
  async function request(entryId, blob) {
    const configured = app.config.LEDGER_RECEIPTS_WORKER_URL;
    if (!configured)
      throw Error(
        "尚未配置私有凭证服务，请先设置 LEDGER_RECEIPTS_WORKER_URL。账目可先不附凭证保存。",
      );
    const base = new URL(configured);
    if (base.protocol !== "https:" || base.username || base.password)
      throw Error("凭证 Worker 地址须为 HTTPS。");
    const epoch = app.state.cloudEpoch,
      c = new AbortController();
    requests.add(c);
    const timer = app.timers.setTimeout(() => c.abort(), 60000);
    const interrupted = new Promise((_, reject) =>
      c.signal.addEventListener(
        "abort",
        () =>
          reject(
            Object.assign(Error("凭证请求已取消"), { name: "AbortError" }),
          ),
        { once: true },
      ),
    );
    const bounded = (promise) => Promise.race([promise, interrupted]);
    try {
      const { data, error } = await bounded(app.state.cloud.auth.getSession());
      if (error) throw error;
      if (epoch !== app.state.cloudEpoch || !data.session?.access_token)
        throw Error("请重新登录后操作凭证。");
      const url = new URL(
        blob ? "upload" : "receipt",
        base.href.endsWith("/") ? base.href : base.href + "/",
      );
      if (!blob) {
        url.searchParams.set("sharedId", app.config.SHARED_ID);
        url.searchParams.set("entryId", entryId);
      }
      const headers = { Authorization: "Bearer " + data.session.access_token };
      if (blob)
        Object.assign(headers, {
          "Content-Type": "image/jpeg",
          "X-Shared-Id": app.config.SHARED_ID,
          "X-Entry-Id": entryId,
        });
      const response = await bounded(
        app.services.fetch(url.href, {
          method: blob ? "POST" : "GET",
          headers,
          body: blob || undefined,
          signal: c.signal,
          cache: "no-store",
        }),
      );
      if (!response.ok) {
        const error = await bounded(response.json()).catch(() => ({
          error: "凭证服务返回 HTTP " + response.status,
        }));
        throw Error(error.error);
      }
      if (
        !blob &&
        !response.headers.get("Content-Type")?.startsWith("image/jpeg")
      )
        throw Error("凭证服务没有返回 JPEG 图片。");
      const result = await bounded(blob ? response.json() : response.blob());
      if (epoch !== app.state.cloudEpoch) throw Error("登录状态已变化。");
      if (blob) {
        const prefix = `ledger/${app.config.SHARED_ID}/${app.state.cloudUser.id}/${entryId}/`;
        if (
          typeof result.objectKey !== "string" ||
          !result.objectKey.startsWith(prefix) ||
          !/^[-a-f0-9]{36}\.jpg$/.test(result.objectKey.slice(prefix.length))
        )
          throw Error("凭证服务返回的对象标识无效。");
        return result.objectKey;
      }
      const address = URL.createObjectURL(result);
      urls.add(address);
      return address;
    } catch (error) {
      if (error.name === "AbortError")
        throw Error("凭证请求已取消或超时，请重试。");
      throw error;
    } finally {
      requests.delete(c);
      app.timers.clearTimeout(timer);
    }
  }
  async function upload(entryId, file) {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 20 * 1024 * 1024
    )
      throw Error("请选择 20 MB 以内的 JPG、PNG 或 WebP 凭证。");
    const epoch = app.state.cloudEpoch,
      object = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(Error("无法读取凭证图片。"));
        img.src = object;
      });
      const scale = Math.min(
          1,
          1400 / Math.max(img.naturalWidth, img.naturalHeight),
        ),
        canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error("浏览器无法压缩凭证。");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(Error("凭证压缩失败。"))),
          "image/jpeg",
          0.85,
        ),
      );
      if (epoch !== app.state.cloudEpoch) throw Error("登录状态已变化。");
      if (blob.size > 5 * 1024 * 1024)
        throw Error("压缩后凭证仍超过 5 MB，请裁剪后上传。");
      return await request(entryId, blob);
    } finally {
      URL.revokeObjectURL(object);
    }
  }
  return { upload, read: (id) => request(id), dispose };
}
