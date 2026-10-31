// 本地图片压缩、R2 预签名上传；头像仍由个人资料模块处理。
import { $ } from "../core/dom.js";
import { friendlyError } from "../core/errors.js";
export function createMediaCovers(app) {
  const store = app.state;
  function setupCoverUpload() {
    const input = $("#coverUpload");
    const url = $("[name=image]");
    const preview = $("#coverPreview");
    const message = $("#coverMessage");
    const save = $("#form button[type=submit]");
    function show() {
      preview.hidden = !url.value;
      preview.src = url.value;
    }
    show();
    app.events.listen(url, "input", show);
    input.onchange = async () => {
      const file = input.files[0];
      if (!file || store.coverBusy) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        message.textContent = "请选择 JPG、PNG 或 WebP 图片。";
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        message.textContent = "请选择小于 20 MB 的图片。";
        return;
      }
      const epoch = store.cloudEpoch;
      let objectUrl,
        phase = "压缩图片";
      store.coverBusy = true;
      input.disabled = true;
      url.disabled = true;
      save.disabled = true;
      message.textContent = "正在压缩封面…";
      try {
        app.actions.requireCloudUser();
        objectUrl = URL.createObjectURL(file);
        const picture = new Image();
        await new Promise((resolve, reject) => {
          picture.onload = resolve;
          picture.onerror = () =>
            reject(new Error("无法读取图片，请更换文件。"));
          picture.src = objectUrl;
        });
        const scale = Math.min(
          1,
          1200 / Math.max(picture.naturalWidth, picture.naturalHeight),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("浏览器无法创建图片压缩画布。");
        context.fillStyle = "#1b1c22";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(picture, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (value) =>
              value ? resolve(value) : reject(new Error("JPEG 压缩失败。")),
            "image/jpeg",
            0.85,
          );
        });
        if (epoch !== store.cloudEpoch || !url.isConnected)
          throw new Error('登录状态或编辑窗口已变化，请重新打开记录。');
        const publicUrl = await app.actions.uploadR2Photo(
          blob,
          file.name,
          (status) => {
            phase = status;
            if (epoch === store.cloudEpoch && message.isConnected)
              message.textContent = status;
          },
        );
        if (epoch !== store.cloudEpoch || !url.isConnected)
          throw new Error("登录状态或编辑窗口已变化，请重新打开记录。");
        // 原表单保存逻辑会将这个输入框的值写入 data.image。
        // 只有上传成功后才替换，因此失败时保留原封面链接。
        url.value = publicUrl;
        show();
        message.textContent =
          "封面已上传。点击「保存记录」后，两个人都能看到。";
      } catch (error) {
        const detail =
          error.name === "AbortError"
            ? "请求超时，请稍后重试。"
            : error instanceof TypeError
              ? "网络请求失败，请检查 Worker 与 R2 的 CORS、网址及网络。"
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
        picture.onerror = () => reject(new Error("无法读取图片，请更换文件"));
        picture.src = address;
      });
      const scale = Math.min(
          1,
          1000 / Math.max(picture.naturalWidth, picture.naturalHeight),
        ),
        canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw Error("浏览器无法压缩图片");
      context.fillStyle = "#1b1c22";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(picture, 0, 0, canvas.width, canvas.height);
      return await new Promise((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(Error("图片压缩失败"))),
          "image/jpeg",
          0.75,
        ),
      );
    } finally {
      URL.revokeObjectURL(address);
    }
  }
  return {
    setupCoverUpload,
    compressTravelImage,
  };
}
