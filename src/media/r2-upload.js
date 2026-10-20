// 封面和旅行照片共用上传链路。超时覆盖响应体读取；只对临时网络故障有限重试。
import { COVER_UPLOAD_WORKER_URL, R2_PUBLIC_BASE_URL } from "../core/config.js";
export function createR2Upload(app) {
  const active = new Set();
  function cancelImageUploads() {
    for (const controller of active) controller.abort();
    active.clear();
  }
  app.onDispose(cancelImageUploads);
  function sessionGuard(epoch) {
    if (epoch !== app.state.cloudEpoch || !app.state.cloudUser)
      throw Error("登录状态已变化，请重新打开记录后上传。");
  }
  async function deadline(work, milliseconds) {
    const controller = new AbortController();
    active.add(controller);
    let timer,
      timedOut = false;
    const interrupted = new Promise((_, reject) => {
      controller.signal.addEventListener(
        "abort",
        () => {
          const e = Error(timedOut ? "请求超时" : "上传已取消");
          e.name = timedOut ? "TimeoutError" : "AbortError";
          reject(e);
        },
        { once: true },
      );
      timer = app.timers.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, milliseconds);
    });
    try {
      return await Promise.race([
        Promise.resolve().then(() => work(controller.signal)),
        interrupted,
      ]);
    } finally {
      app.timers.clearTimeout(timer);
      active.delete(controller);
    }
  }
  async function requestStage(stage, address, options, epoch, onStatus, json) {
    for (let attempt = 0; attempt < 2; attempt++) {
      sessionGuard(epoch);
      onStatus(`${stage}${attempt ? "（网络不稳定，正在重试 1 / 1）" : "…"}`);
      try {
        const result = await deadline(
          async (signal) => {
            const response = await app.services.fetch(address, {
              ...options,
              signal,
            });
            let body;
            if (json) {
              try {
                body = await response.json();
              } catch (error) {
                if (signal.aborted) throw error;
                const invalid = Error(
                  `上传服务返回无效 JSON（HTTP ${response.status}）。`,
                );
                invalid.retryable =
                  [408, 429].includes(response.status) ||
                  response.status >= 500;
                throw invalid;
              }
            } else {
              // 等待 PUT 响应完整结束，连接卡住也由本次计时器中止。
              await response.text();
            }
            if (!response.ok) {
              const error = Error(
                json
                  ? body?.error ||
                      `上传服务请求失败（HTTP ${response.status}）。`
                  : `R2 上传失败（HTTP ${response.status}），请检查桶 CORS、签名和 Content-Type。`,
              );
              error.retryable =
                [408, 429].includes(response.status) || response.status >= 500;
              throw error;
            }
            return body;
          },
          json ? 60000 : 180000,
        );
        sessionGuard(epoch);
        return result;
      } catch (error) {
        sessionGuard(epoch);
        const retryable =
          error.name === "TimeoutError" ||
          error instanceof TypeError ||
          error.retryable;
        if (retryable && attempt === 0) {
          await deadline(
            () =>
              new Promise((resolve) => app.timers.setTimeout(resolve, 1000)),
            5000,
          );
          continue;
        }
        const detail =
          error.name === "TimeoutError"
            ? "请求超时，已自动重试一次。请检查当前网络后重试；原照片未被替换。"
            : error instanceof TypeError
              ? "网络连接失败。请检查网络，以及 Worker / R2 的跨域配置。"
              : error.message;
        throw Error(`${stage}失败：${detail}`);
      }
    }
  }
  async function uploadR2Photo(blob, name, onStatus = () => {}) {
    app.actions.requireCloudUser();
    const epoch = app.state.cloudEpoch;
    onStatus("正在确认登录状态…");
    let session;
    try {
      session = await deadline(() => app.state.cloud.auth.getSession(), 15000);
    } catch (error) {
      sessionGuard(epoch);
      throw Error(
        error.name === "TimeoutError"
          ? "读取登录状态超时，请重新登录后上传。"
          : error.message,
      );
    }
    sessionGuard(epoch);
    if (session.error) throw session.error;
    if (!session.data.session?.access_token)
      throw Error("登录已失效，请重新登录后上传。");
    const result = await requestStage(
      "获取图片上传地址",
      COVER_UPLOAD_WORKER_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.data.session.access_token,
        },
        body: JSON.stringify({
          filename:
            (String(name || "photo")
              .replace(/\.[^.]+$/, "")
              .slice(0, 140) || "photo") + ".jpg",
          contentType: "image/jpeg",
        }),
      },
      epoch,
      onStatus,
      true,
    );
    let upload, publicAddress;
    try {
      upload = new URL(result.uploadUrl);
      publicAddress = new URL(result.publicUrl);
    } catch {
      throw Error("上传服务未返回有效的 uploadUrl 和 publicUrl。");
    }
    if (
      upload.protocol !== "https:" ||
      upload.username ||
      upload.password ||
      !upload.hostname.endsWith(".r2.cloudflarestorage.com") ||
      !upload.pathname.startsWith("/covers/covers/") ||
      publicAddress.origin !== new URL(R2_PUBLIC_BASE_URL).origin ||
      publicAddress.username ||
      publicAddress.password ||
      !publicAddress.pathname.startsWith("/covers/")
    )
      throw Error("上传地址或公开域名不符合配置。");
    // 重试 PUT 使用同一预签名地址，不会重复生成图片。绝不向 R2 发送 Supabase token。
    await requestStage(
      "上传图片到 R2",
      upload.href,
      { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob },
      epoch,
      onStatus,
      false,
    );
    return publicAddress.href;
  }
  return { uploadR2Photo, cancelImageUploads };
}
