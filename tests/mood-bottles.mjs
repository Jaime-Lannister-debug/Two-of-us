// 星星容量、碰撞边界、单条展开回执、提前关闭和会话隔离。
import assert from 'node:assert/strict';
import { makeStars, shakeStars, stepStars, WIDTH, HEIGHT, RADIUS } from '../src/interactions/bottle-physics.js';
import { createTestApp } from './helpers/app.mjs';
for (const count of [0, 1, 35, 100, 110]) {
 const stars=makeStars(Array.from({length:count},(_,i)=>String(i)));
 assert.equal(stars.length,Math.min(count,100));
 shakeStars(stars);for(let i=0;i<240;i++)stepStars(stars,1/60);
 for(const p of stars) {assert(Number.isFinite(p.x+p.y+p.vx+p.vy));assert(p.x>=RADIUS&&p.x<=WIDTH-RADIUS);assert(p.y>=RADIUS&&p.y<=HEIGHT-RADIUS);}
}
const pair=makeStars(['a','b']);pair[0].x=100;pair[0].y=100;pair[1].x=115;pair[1].y=100;pair[0].vx=100;pair[1].vx=-100;
stepStars(pair,1/60);assert(pair[0].vx<100&&pair[1].vx>-100,'星星互相交换动量');
const env=await createTestApp();const {app,w,$,errors}=env;const calls=[];
w.HTMLCanvasElement.prototype.getContext=()=>null;
Object.assign(app.state,{cloudUser:{id:'a'},cloud:{rpc:async(name,args)=>{calls.push({name,args});return {error:null}}}});
Object.assign(app.state.together,{member:true,ready:true,moods:[{id:'one',kind:'happy',created_by:'b',content:'<script>安全文本</script>',created_at:'2026-10-20T04:00:00Z'},{id:'two',kind:'happy',created_by:'b',content:'第二封',created_at:'2026-10-20T03:00:00Z'},{id:'own',kind:'sad',created_by:'a',content:'自己',created_at:'2026-10-20T03:00:00Z'}]});
const timers=[];app.timers.setTimeout=(fn)=>{const t={fn,cancel:false};timers.push(t);return t};app.timers.clearTimeout=t=>{if(t)t.cancel=true};
const run=async()=>{const tasks=timers.splice(0);for(const t of tasks)if(!t.cancel)await t.fn()};
try {
 app.actions.initTogetherUI();app.actions.openMoodPage();
 assert.equal(w.location.hash,'#view=moods');assert.equal(w.document.querySelectorAll('.glass-bottle').length,2);
 assert.equal($('.star-fallback').textContent,'★★');assert.equal(app.actions.moodUnread('happy').length,2);
 $('[data-shake="happy"]').click();assert.equal(calls.length,0,'摇瓶不清未读');
 app.actions.showMoodLetter('one');assert($('#moodLetterDialog').open);assert($('#moodLetter').hidden);
 app.actions.closeMoodLetter();await run();await run();assert.equal(calls.length,0,'提前关闭不清未读');
 app.actions.showMoodLetter('one');await run();assert(!$('#moodLetter').hidden);assert.equal(calls.length,0,'未展开完不确认');await run();
 assert.equal(calls.length,1);assert.deepEqual(calls[0].args.p_ids,['one']);assert.equal(app.actions.moodUnread('happy').length,1);assert.equal($('#moodLetterContent').textContent,'<script>安全文本</script>');assert.equal($('#moodLetterContent').children.length,0);
 app.actions.closeMoodLetter();app.actions.showMoodLetter('own');await run();await run();assert.equal(calls.length,1,'自己的信不写已读');
 app.state.cloud.rpc=async()=>({error:{message:'网络暂时中断'}});
 app.actions.showMoodLetter('two');await run();await run();assert.match($('#moodLetterStatus').textContent,/已读状态保存失败/);assert(!app.state.together.reads.has('two'),'失败保留未读');
 app.actions.showMoodLetter('two');await run();app.state.cloudEpoch++;app.actions.resetTogether();await run();assert.equal(calls.length,1,'退出不确认旧信');assert(!$('#moodLetterDialog').open);assert(!$('.glass-bottle'));
 app.actions.go('home');assert.equal($('#add').textContent,'＋ 新增回忆');
 assert.deepEqual(errors,[]);console.log('PASS: 0–100 stars, pair collision/bounds, unified page, shake exclusion, delayed single receipt, early close, safe text, own-send and logout cancellation');
}finally{env.cleanup()}
