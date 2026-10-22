// Cloudflare Worker，R2 binding: LEDGER_RECEIPTS（现有私有桶）。无依赖、无公开图片 URL。
// 每次读/写均用用户 JWT 调用 Supabase RPC 鉴权；只使用 public/publishable key。
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin"),
      allowed = env.ALLOWED_ORIGIN || "https://jaime-lannister-debug.github.io";
    const cors = {
      Vary: "Origin",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, X-Shared-Id, X-Entry-Id",
      "Access-Control-Max-Age": "3600",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (origin === allowed) cors["Access-Control-Allow-Origin"] = origin;
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
      });
    if (origin && origin !== allowed)
      return json({ error: "来源地址不允许" }, 403);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });
    let authTimer;
    try {
      if (!env.LEDGER_RECEIPTS || !env.SUPABASE_URL || !env.SUPABASE_PUBLIC_KEY)
        return json(
          { error: "私有凭证服务尚未配置 R2 binding 或 Supabase 公共配置" },
          503,
        );
      const url = new URL(request.url),
        upload = url.pathname === "/upload" && request.method === "POST",
        read = url.pathname === "/receipt" && request.method === "GET";
      if (!upload && !read) return json({ error: "接口不存在" }, 404);
      const token = request.headers.get("Authorization") || "";
      if (!/^Bearer \S+$/.test(token)) return json({ error: "请先登录" }, 401);
      const space = upload
          ? request.headers.get("X-Shared-Id")
          : url.searchParams.get("sharedId"),
        id = upload
          ? request.headers.get("X-Entry-Id")
          : url.searchParams.get("entryId");
      if (!space || !/^[\w-]{1,100}$/.test(space) || !UUID.test(id || ""))
        return json({ error: "空间或账目标识无效" }, 400);
      if (
        upload &&
        request.headers.get("Content-Type")?.split(";")[0] !== "image/jpeg"
      )
        return json({ error: "仅支持压缩后的 JPEG 凭证" }, 415);
      const project = new URL(env.SUPABASE_URL);
      if (
        project.protocol !== "https:" ||
        project.username ||
        project.password ||
        project.pathname !== "/" ||
        project.search ||
        project.hash
      )
        throw Error("Supabase URL 配置错误");
      const key = env.SUPABASE_PUBLIC_KEY;
      if (!key.startsWith("sb_publishable_") && !key.startsWith("eyJ"))
        throw Error("必须配置浏览器 public/publishable key");
      // 旧 JWT anon key 额外检查 role，禁止误填 service_role。
      if (key.startsWith("eyJ")) {
        let payload;
        try {
          payload = JSON.parse(
            atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
          );
        } catch {
          throw Error("公共 key 格式错误");
        }
        if (payload.role !== "anon") throw Error("禁止使用服务端特权 key");
      }
      const controller = new AbortController();
      authTimer = setTimeout(() => controller.abort(), 15000);
      const permission = await fetch(
        new URL("/rest/v1/rpc/ledger_receipt_access", project),
        {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            p_space: space,
            p_id: id,
            p_mode: upload ? "upload" : "read",
          }),
          signal: controller.signal,
        },
      );
      const access = await permission.json();
      clearTimeout(authTimer);
      if (!permission.ok)
        return json(
          {
            error:
              permission.status === 401
                ? "登录已失效，请重新登录"
                : access.message || "没有凭证访问权限",
          },
          permission.status === 401 ? 401 : 403,
        );
      if (read) {
        const prefix = "ledger/" + space + "/";
        if (
          typeof access.objectKey !== "string" ||
          !access.objectKey.startsWith(prefix)
        )
          throw Error("凭证对象标识无效");
        const object = await env.LEDGER_RECEIPTS.get(access.objectKey);
        if (!object) return json({ error: "凭证图片不存在" }, 404);
        return new Response(object.body, {
          headers: {
            ...cors,
            "Content-Type": "image/jpeg",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Content-Disposition": 'inline; filename="receipt.jpg"',
          },
        });
      }
      const prefix = "ledger/" + space + "/";
      if (
        typeof access.prefix !== "string" ||
        !access.prefix.startsWith(prefix)
      )
        throw Error("上传命名空间无效");
      const max = 5 * 1024 * 1024;
      if (Number(request.headers.get("Content-Length")) > max)
        return json({ error: "凭证超过 5 MB" }, 413);
      const reader = request.body?.getReader();
      if (!reader) return json({ error: "图片为空" }, 400);
      const chunks = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > max) {
          await reader.cancel();
          return json({ error: "凭证超过 5 MB" }, 413);
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      if (size < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255)
        return json({ error: "不是有效 JPEG 图片" }, 415);
      const objectKey = access.prefix + crypto.randomUUID() + ".jpg";
      await env.LEDGER_RECEIPTS.put(objectKey, bytes, {
        httpMetadata: {
          contentType: "image/jpeg",
          cacheControl: "private, no-store",
        },
      });
      return json({ objectKey });
    } catch (error) {
      return json(
        {
          error:
            error.name === "AbortError"
              ? "凭证鉴权超时，请重试"
              : "凭证服务失败：" + error.message,
        },
        502,
      );
    } finally {
      clearTimeout(authTimer);
    }
  },
};
