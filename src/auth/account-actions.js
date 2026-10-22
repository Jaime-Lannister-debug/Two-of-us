// JSON 导出、邀请生成与加入、退出操作。
import { $, toast, cloudMessage } from "../core/dom.js";
import { friendlyError } from "../core/errors.js";
export function createAuthAccountActions(app) {
  const store = app.state;
  function initAccountActions() {
    $("#exportBackup").onclick = () => {
      if (!store.cloudUser) return;
      const blob = new Blob(
        [
          JSON.stringify(
            {
              version: 1,
              shared_id: app.config.SHARED_ID,
              exported_at: new Date().toISOString(),
              items: store.records,
            },
            null,
            2,
          ),
        ],
        {
          type: "application/json",
        },
      );
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download =
        "two-of-us-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      app.timers.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("已导出当前已加载记录，备份可能包含私密内容");
    };
    $("#inviteSpace").hidden = app.config.ACCESS_MODE !== "members";
    $("#joinSpace").hidden = app.config.ACCESS_MODE !== "members";
    $("#inviteSpace").onclick = async () => {
      try {
        app.actions.requireCloudUser();
        const { data, error } = await store.cloud.rpc("create_shared_invite", {
          p_shared_id: app.config.SHARED_ID,
        });
        if (error) throw error;
        prompt("一次性邀请码，有效期 24 小时。仅发送给对方：", data);
      } catch (error) {
        cloudMessage(friendlyError(error));
      }
    };
    $("#joinSpace").onclick = async () => {
      const token = prompt("粘贴对方发送的一次性邀请码");
      if (!token) return;
      try {
        app.actions.requireCloudUser();
        const { data, error } = await store.cloud.rpc("join_shared_space", {
          p_token: token.trim(),
        });
        if (error) throw error;
        if (data !== app.config.SHARED_ID) {
          cloudMessage(
            "已加入空间 " +
              data +
              "；请将配置 SHARED_ID 改为该值后重新打开网页。",
          );
          return;
        }
        await app.actions.loadSharedItems();
        await app.actions.loadPeople();
        await app.actions.loadTogether();
        await app.actions.activateLedger();
        cloudMessage("已加入共享空间");
      } catch (error) {
        cloudMessage(friendlyError(error));
      }
    };
    $("#logout").onclick = async () => {
      if (
        store.writeBusy ||
        store.coverBusy ||
        store.galleryBusy ||
        store.together.busy ||
        store.avatarBusy ||
        store.profileSaving
      ) {
        toast("正在保存，请稍后退出");
        return;
      }
      const { error } = await store.cloud.auth.signOut({
        scope: "local",
      });
      if (error) {
        cloudMessage(friendlyError(error));
        return;
      }
      await app.actions.activateSession(null);
      cloudMessage("已退出登录");
    };
  }
  return {
    initAccountActions,
  };
}
