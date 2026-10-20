// 将定时器与原生监听器归属于应用实例；销毁后旧回调不会继续运行。
export function createResources() {
  const timeouts = new Set(),
    intervals = new Set(),
    cleanups = [];
  let disposed = false;
  const timers = {
    setTimeout(fn, delay, ...args) {
      if (disposed) return null;
      const id = setTimeout(() => {
        timeouts.delete(id);
        if (!disposed) fn(...args);
      }, delay);
      timeouts.add(id);
      return id;
    },
    clearTimeout(id) {
      clearTimeout(id);
      timeouts.delete(id);
    },
    setInterval(fn, delay, ...args) {
      if (disposed) return null;
      const id = setInterval(() => {
        if (!disposed) fn(...args);
      }, delay);
      intervals.add(id);
      return id;
    },
    clearInterval(id) {
      clearInterval(id);
      intervals.delete(id);
    },
  };
  const events = {
    listen(target, type, fn, options) {
      if (disposed) return;
      target.addEventListener(type, fn, options);
      // 列表重绘后不强持有旧 DOM 与闭包，避免长期使用积累已移除的卡片。
      const targetRef = new WeakRef(target),
        listenerRef = new WeakRef(fn);
      cleanups.push(() => {
        const currentTarget = targetRef.deref(),
          currentListener = listenerRef.deref();
        if (currentTarget && currentListener)
          currentTarget.removeEventListener(type, currentListener, options);
      });
    },
  };
  return {
    timers,
    events,
    onDispose(cleanup) {
      if (disposed) cleanup();
      else cleanups.push(cleanup);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const id of timeouts) clearTimeout(id);
      for (const id of intervals) clearInterval(id);
      for (const cleanup of cleanups) cleanup();
      timeouts.clear();
      intervals.clear();
      cleanups.length = 0;
    },
  };
}
