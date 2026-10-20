// 真实应用模块 + 独立 DOM；测试不读取真实配置，不连接 Supabase/R2。
import { readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createApplication } from '../../src/app.js';
import * as model from '../../src/collections/model.js';
import * as numbers from '../../src/core/numbers.js';
import * as dates from '../../src/core/dates.js';
import * as errors from '../../src/core/errors.js';
import * as profile from '../../src/profiles/model.js';
import * as musicLink from '../../src/collections/music-link.js';
export const core = {...model,...numbers,...dates,...errors,...profile,...musicLink};
export async function createTestApp(options = {}) {
 const errors = [], virtualConsole = new VirtualConsole();
 virtualConsole.on('jsdomError', error => errors.push(error.message));
 const html = await readFile(new URL('../../shared.html', import.meta.url), 'utf8');
 const dom = new JSDOM(html, { url: 'https://example.test/shared.html', pretendToBeVisual: true, virtualConsole });
 const w = dom.window;
 w.HTMLCanvasElement.prototype.getContext = () => null; // DOM 测试使用无 Canvas 的星星回退，物理与浏览器另测。
 for (const name of ['window','document','history','Image','FormData','Event','KeyboardEvent','FocusEvent']) globalThis[name] = name === 'window' ? w : w[name];
 w.confirm = globalThis.confirm = () => true;
 globalThis.prompt = () => null;
 for (const dialog of w.document.querySelectorAll('dialog')) { dialog.showModal ||= function(){ this.open = true; }; dialog.close ||= function(){this.open = false;}; }
 const app = createApplication({config:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'test-public',SHARED_ID:'our-shared-space',ACCESS_MODE:'members'},...options});
 // 模板在创建应用时挂载；jsdom 没有原生 dialog 实现。
 for (const dialog of w.document.querySelectorAll('dialog')) { dialog.showModal ||= function(){ this.open = true; }; dialog.close ||= function(){this.open = false;}; }
 return {app,dom,w,errors,$:selector=>w.document.querySelector(selector),core,cleanup(){app.dispose();dom.window.close();}};
}
