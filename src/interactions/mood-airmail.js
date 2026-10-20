// 展开完成才确认这一条已读。提前关闭、退出或切换账号不会确认旧信件。
import { $ } from "../core/dom.js";
import { socialTime } from "../core/dates.js";
export function createMoodAirmail(app) {
  let timer,
    sequence = 0,
    trigger;
  function closeMoodLetter() {
    sequence++;
    app.timers.clearTimeout(timer);
    const dialog = $("#moodLetterDialog");
    if (dialog.open) dialog.close();
    dialog.classList.remove("flying");
    $("#moodLetter").hidden = true;
    if (trigger?.isConnected) trigger.focus();
  }
  function showMoodLetter(id) {
    if (!app.actions.memberFeature()) return;
    const mood = app.state.together.moods.find((m) => m.id === id);
    if (!mood) return;
    const origin = document.activeElement;
    closeMoodLetter();
    trigger = origin;
    const token = ++sequence,
      epoch = app.state.cloudEpoch,
      dialog = $("#moodLetterDialog");
    $("#moodLetterMeta").textContent =
      `${app.actions.personLabel(mood.created_by)} · ${socialTime(mood.created_at)} · ${mood.kind === "happy" ? "好心情" : "坏心情"}`;
    $("#moodLetterContent").textContent = mood.content;
    $("#moodLetterStatus").textContent = "";
    dialog.showModal();
    // 强制重启动效；内容在展开阶段出现，读回执等完整展开后才发送。
    void dialog.offsetWidth;
    dialog.classList.add("flying");
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    timer = app.timers.setTimeout(
      () => {
        if (
          token !== sequence ||
          epoch !== app.state.cloudEpoch ||
          !dialog.open
        )
          return;
        $("#moodLetter").hidden = false;
        timer = app.timers.setTimeout(
          async () => {
            if (
              token !== sequence ||
              epoch !== app.state.cloudEpoch ||
              !dialog.open
            )
              return;
            try {
              await app.actions.readMood(id);
            } catch (error) {
              if (token === sequence && epoch === app.state.cloudEpoch)
                $("#moodLetterStatus").textContent =
                  "已读状态保存失败：" +
                  app.actions.socialError(error) +
                  " 请稍后重新打开。";
            }
          },
          reduced ? 0 : 500,
        );
      },
      reduced ? 0 : 700,
    );
  }
  function initMoodAirmail() {
    $("#closeMoodLetter").onclick = closeMoodLetter;
    app.events.listen($("#moodLetterDialog"), "cancel", (event) => {
      event.preventDefault();
      closeMoodLetter();
    });
    app.events.listen($("#moodLetterDialog"), "click", (event) => {
      if (event.target === $("#moodLetterDialog")) closeMoodLetter();
    });
    app.events.listen(document, "visibilitychange", () => {
      if (document.hidden && $("#moodLetterDialog").open) closeMoodLetter();
    });
  }
  app.onDispose(closeMoodLetter);
  return { showMoodLetter, closeMoodLetter, initMoodAirmail };
}
