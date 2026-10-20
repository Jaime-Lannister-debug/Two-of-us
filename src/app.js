// 创建应用与装配功能；此处不放具体业务逻辑。
import { createResources } from './core/resources.js';
import { createState } from './core/state.js';
import { getRuntimeConfig } from './core/config.js';
import { featureModules, featureTemplates } from './registry.js';
export function createApplication(options = {}) {
  const resources = createResources();
  const app = {
    onDispose: resources.onDispose,
    timers: resources.timers,
    events: resources.events,
    state: createState(),
    config: options.config || getRuntimeConfig(),
    actions: Object.create(null),
    services: { fetch: (...args) => fetch(...args), ...options.services },
  };
  const host = document.querySelector('#featureDialogs');
  if (!host) throw new Error('页面缺少 featureDialogs 挂载位置');
  for (const entry of featureTemplates)
    if (!document.getElementById(entry.id))
      host.insertAdjacentHTML('beforeend', entry.html);
  for (const entry of featureModules) {
    const api = entry.create(app);
    for (const [name, fn] of Object.entries(api)) {
      if (app.actions[name]) throw new Error('重复的模块接口：' + name);
      app.actions[name] = fn;
    }
  }
  let started = false,
    disposed = false;
  app.start = () => {
    if (disposed) throw new Error('应用已销毁，不能重新启动');
    if (started) return;
    started = true;
    app.actions.initNavigation();
    app.actions.initEditor();
    app.actions.initEffects();
    return app.actions.initSharedCloud();
  };
  app.dispose = () => {
    if (disposed) return;
    disposed = true;
    resources.dispose();
    app.state.cloudEpoch++;
    const client = app.state.cloud;
    for (const channel of [
      app.state.cloudChannel,
      app.state.profilesChannel,
      app.state.together.channel,
    ])
      if (channel && client) void client.removeChannel?.(channel);
    if (app.state.map) app.state.map.remove();
  };
  return app;
}
