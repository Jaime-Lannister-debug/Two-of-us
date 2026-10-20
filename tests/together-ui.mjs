// 完整 DOM 交互测试使用隔离假数据，不向 Supabase 发送请求。
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from 'jsdom';
const source=await readFile(new URL('../shared.html',import.meta.url),'utf8');
const errors=[],virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',error=>errors.push(error.message));
const html=source.replace(/<script src="[^"]+"><\/script>/g,'').replace('void initSharedCloud();','');
const dom=new JSDOM(html,{url:'https://example.test/shared.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole,beforeParse(window){window.TWO_US_CONFIG={SHARED_ID:'test-space'};window.confirm=()=>true;}}),w=dom.window;
const $=s=>w.document.querySelector(s),tick=()=>new Promise(r=>setTimeout(r,0));
for(const dialog of w.document.querySelectorAll('dialog')){dialog.showModal=function(){this.open=true};dialog.close=function(){this.open=false};}
const A='a',B='b',C='c';let uid=A;
const tables={shared_members:[{user_id:A,shared_id:'test-space'},{user_id:B,shared_id:'test-space'}],mood_entries:[],mood_reads:[],item_notifications:[],milestones:[]};
const subscriptions=[],rpcCalls=[];
const db={from(table){const filters=[];let limit=Infinity,start=0,end=Infinity,operation=null,payload;return {
 select(){return this},eq(key,value){filters.push(row=>row[key]===value);return this},in(key,values){filters.push(row=>values.includes(row[key]));return this},order(){return this},limit(value){limit=value;return this},range(a,b){start=a;end=b;return this},insert(value){operation='insert';payload=value;return this},update(value){operation='update';payload=value;return this},delete(){operation='delete';return this},
 then(resolve,reject){try{let rows=tables[table].filter(row=>filters.every(test=>test(row)));if(table==='item_notifications')rows=rows.filter(r=>r.recipient_id===uid);if(operation==='insert'){const row={...payload,id:'new-milestone'};tables[table].push(row);rows=[row]}if(operation==='update')rows.forEach(row=>Object.assign(row,payload));if(operation==='delete')tables[table]=tables[table].filter(row=>!rows.includes(row));return Promise.resolve({data:structuredClone(rows.slice(start,Math.min(end+1,start+limit))),error:null}).then(resolve,reject)}catch(error){return Promise.reject(error).then(resolve,reject)}}};},
 async rpc(name,args){rpcCalls.push({name,args:structuredClone(args)});if(name==='read_moods')for(const id of args.p_ids){if(!tables.mood_reads.some(r=>r.user_id===uid&&r.mood_id===id))tables.mood_reads.push({user_id:uid,mood_id:id})}if(name==='read_item_notifications')tables.item_notifications.filter(n=>args.p_ids.includes(n.id)&&n.recipient_id===uid).forEach(n=>n.read_at='2026-10-20T00:00:00Z');if(name==='add_mood')tables.mood_entries.unshift({id:'new-mood',shared_id:args.p_shared_id,kind:args.p_kind,content:args.p_content,created_by:uid,created_at:'2026-10-20T00:00:00Z'});return {data:null,error:null};},
 channel(){return {on(type,filter){subscriptions.push(filter);return this},subscribe(){return this}}},async removeChannel(){}};
w.mockCloud=db;
try{
 w.eval(`cloud=window.mockCloud;cloudUser={id:'a'};initTogetherUI();sharedPeople=[{user_id:'a',nickname:'小甲'},{user_id:'b',nickname:'小乙'}];`);
 const login=async id=>{uid=id;w.eval(`resetTogether();cloudUser={id:${JSON.stringify(id)}};`);await w.eval('loadTogether()')};
 assert.equal(w.eval("milestoneCaption({date:'2026-10-20',repeat_yearly:true,is_relationship:true},'2026-10-20')"),'在一起第 1 天 · 今天就是纪念日');
 assert.match(w.eval("milestoneCaption({date:'2026-10-19',repeat_yearly:true,is_relationship:true},'2026-10-20')"),/第 2 天/);
 assert.match(w.eval("milestoneCaption({date:'2000-02-29',repeat_yearly:true},'2027-02-27')"),/还有 1 天/);
 assert.match(w.eval("milestoneCaption({date:'2000-02-29',repeat_yearly:true},'2028-02-28')"),/还有 1 天/);
 assert.match(w.eval("milestoneCaption({date:'2026-12-31',repeat_yearly:true},'2026-12-31')"),/今天/);
 assert.match(w.eval("milestoneCaption({date:'2026-01-01',repeat_yearly:false},'2026-01-03')"),/过去 2 天/);
 assert(w.eval("Number.isNaN(dayIndex('2026-02-29'))"));
 tables.mood_entries.push({id:'a-mood',shared_id:'test-space',kind:'happy',content:'今天有好事',created_by:A,created_at:'2026-10-20T00:00:00Z'});
 await login(A);assert($('#happyUnread').hidden,'自己心情不计未读');
 await login(B);assert.equal($('#happyUnread').textContent,'1');assert(!$('#happyUnread').hidden);$('#happyBottle').click();await tick();assert($('#moodDialog').open);assert($('#happyUnread').hidden);assert.match($('#moodList').textContent,/今天有好事/);assert(rpcCalls.some(c=>c.name==='read_moods'&&c.args.p_ids.includes('a-mood')));
 $('#moodText').value='我的回应也是一份心情';$('#moodForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();await tick();assert.equal($('#moodText').value,'');assert($('#happyUnread').hidden,'B 自己添加不增自己的未读');
 await login(A);assert.equal($('#happyUnread').textContent,'1');tables.mood_entries.unshift({id:'a-second',shared_id:'test-space',kind:'happy',content:'自己的第二份心情',created_by:A,created_at:'2026-10-20T00:01:00Z'});await w.eval('loadTogether({milestones:false})');assert.equal($('#happyUnread').textContent,'1');
 // 消息与条目红点；当前账号不会查询到自己的操作通知。
 tables.item_notifications.push({id:'n1',shared_id:'test-space',recipient_id:A,actor_name:'小乙',action:'UPDATE',item_id:'game',item_title:'王国之泪',item_cat:'game',created_at:'2026-10-20T00:00:00Z',read_at:null});
 await w.eval('loadTogether({milestones:false})');assert(!$('#messageUnread').hidden);assert(w.eval("unreadItem('game')"));$('#messageButton').click();await tick();assert.match($('#notificationList').textContent,/小乙修改了「王国之泪」/);assert($('#messageUnread').hidden);assert(!w.eval("unreadItem('game')"));
 tables.item_notifications.push({id:'n2',shared_id:'test-space',recipient_id:A,actor_name:'小乙',action:'INSERT',item_id:'another',item_title:'新收藏',item_cat:'game',created_at:'2026-10-20T00:02:00Z',read_at:null});await w.eval('loadTogether({milestones:false})');assert.equal($('#messageUnread').textContent,'1','新到消息不会因先前打开消息中心而误标已读');await w.eval("markItemRead('another')");assert($('#messageUnread').hidden);
 assert(!subscriptions.some(s=>s.table==='milestones'),'纪念日无 Realtime');assert(subscriptions.some(s=>s.table==='item_notifications'&&s.filter==='recipient_id=eq.a'));
 // 纪念日管理、日期与特殊开始日。
 $('#messageDialog').close();w.eval('openMilestones()');$('#milestoneTitle').value='在一起';$('#milestoneDate').value='2020-02-29';$('#milestoneRelationship').checked=true;$('#milestoneForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();await tick();assert.equal(tables.milestones.length,1);assert.equal(tables.milestones[0].is_relationship,true);
 // 满瓶高度和禁用按钮。
 tables.mood_entries=Array.from({length:100},(_,i)=>({id:'full-'+i,shared_id:'test-space',kind:'sad',content:'心情',created_by:A,created_at:'2026-10-20T00:00:00Z'}));await w.eval('loadTogether({milestones:false})');$('#milestoneDialog').close();$('#sadBottle').click();await tick();assert.equal($('#moodJar').style.getPropertyValue('--fill'),'100%');assert($('#moodSubmit').disabled);
 await login(C);assert($('#togetherNav').hidden);assert($('#messageButton').hidden);assert(!$('#moodDialog').open);
 // 未执行迁移时给出清楚提示，不影响旧数据层；退出后的响应不得恢复入口。
 uid=A;w.eval("cloudUser={id:'a'}");const original=db.from;let release;db.from=table=>table==='shared_members'?{select(){return this},eq(){return this},then(resolve,reject){return new Promise(r=>release=r).then(resolve,reject)}}:original(table);
 const pending=w.eval('loadTogether()');await tick();w.eval("cloudUser=null;cloudEpoch++;resetTogether()");release({data:[{user_id:A}],error:null});await pending;assert($('#togetherNav').hidden);db.from=original;
 assert.deepEqual(errors,[]);console.log('PASS: DOM date/leap-year calculations, A/B mood unread badges, own-send exclusion, read receipts, notification text/dots, milestone form, full bottle, nonmember visibility and logout race');
}finally{dom.window.close();}
