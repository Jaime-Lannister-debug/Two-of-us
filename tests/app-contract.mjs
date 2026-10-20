import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createTestApp} from './helpers/app.mjs';
import {createState} from '../src/core/state.js';
const env=await createTestApp(),{app,w,$}=env;
try{
 const first=createState(),second=createState();first.records.push({id:'one'});first.together.reads.add('one');assert.equal(second.records.length,0);assert.equal(second.together.reads.size,0,'状态不能在两个应用实例间共享');
 const paths=[];async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const next=new URL(item.name+(item.isDirectory()?'/':''),dir);if(item.isDirectory())await walk(next);else if(item.name.endsWith('.js'))paths.push(next)}}await walk(new URL('../src/',import.meta.url));
 for(const file of paths){const source=await readFile(file,'utf8');for(const [,name]of source.matchAll(/app\.actions\.([A-Za-z_$][\w$]*)/g))assert.equal(typeof app.actions[name],'function',`${file.pathname} 依赖不存在的接口 ${name}`);}
 const ids=[...w.document.querySelectorAll('[id]')].map(el=>el.id);assert.equal(ids.length,new Set(ids).size,'模板不能重复挂载 DOM id');
 let authSubscriptions=0,authUnsubscribed=0;w.supabase={createClient(){return {auth:{onAuthStateChange(){authSubscriptions++;return {data:{subscription:{unsubscribe(){authUnsubscribed++}}}}}}}}};await app.start();await app.start();assert.equal(authSubscriptions,1,'重复启动不能重复绑定会话订阅');assert.equal($('#nav').querySelectorAll('[data-page]').length,6);assert.equal(typeof $('#form').onsubmit,'function');assert.equal(typeof $('#authForm').onsubmit,'function');assert($('#togetherNav').hidden,'匿名不显示互动入口');
 app.state.cloudUser={id:'me'};const item={id:'navigation-test',cat:'game',sub:'Steam',state:'doing',title:'详情跳转',date:'2026-10-20',genres:[],playHours:1};app.state.records=[item];app.state.rawRows.set(item.id,{content:JSON.stringify(item)});app.actions.render();$('#content [data-id]').click();await new Promise(r=>setTimeout(r,10));assert($('#editDetail'),'完整启动后 hashchange 必须打开详情');
 
 let fired=false;app.timers.setTimeout(()=>fired=true,20);let clicked=0;app.events.listen($('#add'),'test-cleanup',()=>clicked++);app.dispose();await new Promise(r=>setTimeout(r,30));$('#add').dispatchEvent(new w.Event('test-cleanup'));assert.equal(fired,false);assert.equal(authUnsubscribed,1);assert.equal(clicked,0,'销毁应用必须清除监听器');
 console.log('PASS: native module contracts, isolated state, unique templates, idempotent startup and lifecycle cleanup');
}finally{env.cleanup()}
