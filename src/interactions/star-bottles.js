// Canvas 只在摇动时逐帧工作；离页、退出和销毁时停止，避免后台耗电。
import {
  makeStars,
  shakeStars,
  stepStars,
  WIDTH,
  HEIGHT,
  RADIUS,
} from "./bottle-physics.js";
export function createStarBottles(app) {
  const bottles = new Map();
  const reduced = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  function paint(b) {
    const ctx = b.ctx;
    if (!ctx) {
      b.canvas.parentElement.querySelector(".star-fallback").textContent =
        "★".repeat(b.stars.length);
      return;
    }
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    for (const p of b.stars) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2,
          r = i % 2 ? RADIUS * 0.47 : RADIUS;
        ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = b.kind === "happy" ? "#f29ab9" : "#88b8ef";
      ctx.fill();
      ctx.strokeStyle = b.kind === "happy" ? "#ffe2ed" : "#d4e9ff";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }
  }
  function mountStarBottles() {
    for (const kind of ["happy", "sad"]) {
      const canvas = document.querySelector(`[data-stars="${kind}"]`);
      if (!canvas) continue;
      let b = bottles.get(kind);
      if (!b || b.canvas !== canvas) {
        if (b?.frame) window.cancelAnimationFrame(b.frame);
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = WIDTH * ratio;
        canvas.height = HEIGHT * ratio;
        const ctx = canvas.getContext("2d");
        ctx?.scale(ratio, ratio);
        b = { canvas, ctx, kind, stars: [], frame: null };
        bottles.set(kind, b);
      }
      const ids = app.state.together.moods
        .filter((m) => m.kind === kind)
        .map((m) => m.id);
      // 新心情加入时重新排层，避免新星与原来的底部星星重叠。
      const same =
        ids.length === b.stars.length &&
        ids.every((id, i) => b.stars[i]?.id === id);
      b.stars = makeStars(ids, same ? b.stars : []);
      paint(b);
    }
  }
  function shakeBottle(kind) {
    const b = bottles.get(kind);
    if (!b || !b.stars.length) return;
    shakeStars(b.stars);
    if (reduced() || !b.ctx) {
      stepStars(b.stars, 0.03);
      paint(b);
      return;
    }
    b.until = performance.now() + 5500;
    if (b.frame) return;
    let previous = performance.now();
    const animate = (now) => {
      b.frame = null;
      if (!b.canvas.isConnected || document.hidden) return;
      stepStars(b.stars, (now - previous) / 1000);
      previous = now;
      paint(b);
      if (now < b.until) b.frame = window.requestAnimationFrame(animate);
    };
    b.frame = window.requestAnimationFrame(animate);
  }
  function disposeStarBottles() {
    for (const b of bottles.values())
      if (b.frame) window.cancelAnimationFrame(b.frame);
    bottles.clear();
  }
  app.onDispose(disposeStarBottles);
  return { mountStarBottles, shakeBottle, disposeStarBottles };
}
