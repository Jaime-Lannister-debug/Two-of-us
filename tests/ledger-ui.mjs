// 真实原生账本模块，虚构云响应；数据库正确性另由 ledger-db 验证。
import assert from 'node:assert/strict';
import {createTestApp} from './helpers/app.mjs';
import {equalShares} from '../src/ledger/money.js';
const env=await createTestApp(),{app,w,$,errors}=env;const a=app.actions,s=app.state;
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',C='00000000-0000-4000-8000-000000000003';
w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
const categories=[{id:'expense',kind:'expense',name:'餐饮',parent_id:null},{id:'income',kind:'income',name:'工资',parent_id:null}],people=[{user_id:A,nickname:'小甲'},{user_id:B,nickname:'小乙'}];
let rows=[],saveCalls=0,callbacks=[],release,pendingList=false;
const summary=()=>{const income=rows.filter(e=>e.kind==='income').reduce((n,e)=>n+BigInt(e.amount_minor),0n),expense=rows.filter(e=>e.kind==='expense').reduce((n,e)=>n+BigInt(e.amount_minor),0n);return {income:String(income),expense:String(expense),net:String(income-expense),count:rows.length,scopes:Object.fromEntries(['shared','personal'].map(scope=>[scope,{income:'0',expense:'0',net:'0'}])),people:people.map(p=>({...p,income:'0',expense:'0',paid:'0',received:'0'})),categories:[],months:[]}};
const tick=()=>new Promise(r=>setTimeout(r,5));async function until(test){for(let i=0;i<200;i++){if(test())return;await tick()}throw Error('等待界面超时')}
const cloud={
 from(){return {select(){return this},eq(){return this},then(resolve,reject){return Promise.resolve({data:s.cloudUser?.id===C?[]:[{user_id:s.cloudUser?.id}],error:null}).then(resolve,reject)}}},
 auth:{getSession:async()=>({data:{session:{access_token:'test'}}})},
 channel(){return{on(_event,filter,fn){callbacks.push({filter,fn});return this},subscribe(){return this}}},removeChannel:async()=>{},
 async rpc(name,args){
  if(name==='ledger_bootstrap')return {data:{people,categories},error:null};
  if(name==='ledger_list'){if(pendingList)return new Promise(r=>release=r);const data={summary:summary(),entries:rows};return {data,error:null};}
  if(name==='ledger_report')return {data:{current:summary(),previous:args.p_month?summary():null},error:null};
  if(name==='ledger_save'){saveCalls++;const p=args.p_data,old=rows.find(e=>e.id===args.p_id);const entry={...p,id:args.p_id,version:(old?.version||0)+1,created_by:s.cloudUser.id,created_at:'2026-10-22T04:00:00Z',updated_at:'2026-10-22T04:00:00Z',category_name:categories.find(c=>c.id===p.category_id)?.name,allocations:p.scope==='personal'?[{user_id:p.owner_user_id,amount_minor:p.amount_minor}]:p.split_method==='custom'?p.allocations:equalShares(p.amount_minor,people)};rows=[entry,...rows.filter(e=>e.id!==entry.id)];return {data:{id:entry.id,version:entry.version},error:null};}
  if(name==='ledger_delete'){rows=rows.filter(e=>e.id!==args.p_id);return {error:null};}
  throw Error(name);
 }
};
try{
 s.cloud=cloud;s.cloudUser={id:A};a.initNavigation();a.initLedgerUI();await a.activateLedger();assert(!$('#ledgerNav').hidden);a.openLedger();await until(()=>$('#ledgerNew')&&s.ledger.ready&&!s.ledger.loading);
 $('#ledgerNew').click();assert($('#ledgerEditor').open);$('#ledgerAmount').value='120.00';$('#ledgerCategory').value='expense';$('#ledgerDescription').value='一起吃饭';$('#ledgerForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await until(()=>saveCalls===1&&!s.ledger.busy&&!s.ledger.loading);assert.equal(rows[0].amount_minor,'12000');assert.equal(rows[0].scope,'shared');assert.equal(rows[0].payer_user_id,A);assert.match($('#ledgerResults').textContent,/120.00/);
 $('#ledgerNew').click();$('#ledgerAmount').value='10.00';$('#ledgerCategory').value='expense';$('#ledgerDescription').value='自定义';$('#ledgerSplit').value='custom';$('#ledgerSplit').dispatchEvent(new w.Event('input'));const inputs=$('#ledgerCustom').querySelectorAll('input');inputs[0].value='1';inputs[1].value='2';$('#ledgerForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(saveCalls,1);assert.match($('#ledgerFormStatus').textContent,/合计必须等于/);
 $('#ledgerDescription').value='未提交草稿';callbacks[0].fn();await until(()=>!s.ledger.loading);await new Promise(r=>setTimeout(r,180));await until(()=>!s.ledger.loading);assert.equal($('#ledgerDescription').value,'未提交草稿','实时刷新保留草稿');assert($('#ledgerEditor').open);$('#ledgerEditorClose').click();
 $('[data-ledger-entry]').click();assert($('#ledgerEditEntry'));$('#ledgerDetailClose').click();
 rows.unshift({...rows[0],id:'other',created_by:B,description:'对方记录'});callbacks[1].fn();await new Promise(r=>setTimeout(r,180));await until(()=>!s.ledger.loading);$('[data-ledger-entry="other"]').click();assert(!$('#ledgerEditEntry'));assert.match($('#ledgerDetailContent').textContent,/仅可查看/);$('#ledgerDetailClose').click();
 a.openLedger('month');await until(()=>!s.ledger.loading&&$('#ledgerResults').textContent.includes('支出环比'));a.openLedger('year');await until(()=>!s.ledger.loading&&$('#ledgerResults svg'));assert.equal($('#ledgerResults svg').querySelectorAll('rect').length,24,'全年包含12个月的两组柱');
 a.go('home');assert.equal(s.ledger.active,false);assert.equal($('#add').textContent,'＋ 新增回忆');
 a.openLedger();await until(()=>$('#ledgerRefresh')&&!s.ledger.loading);pendingList=true;$('#ledgerRefresh').click();await until(()=>release);await a.activateSession(null);release({data:{entries:rows,summary:summary()},error:null});await tick();assert($('#ledgerNav').hidden);assert.equal(s.ledger.entries.length,0);assert(!$('#ledgerWorkspace'));
 s.cloudUser={id:C};await a.activateLedger();assert($('#ledgerNav').hidden);assert.equal(s.ledger.member,false);
 assert(callbacks.every(c=>c.filter.filter==='shared_id=eq.our-shared-space'&&c.filter.event!=='DELETE'));assert.deepEqual(errors,[]);
 console.log('PASS: lazy ledger route/member gating, full form payload, invalid split prevention, realtime draft preservation, creator-only controls, reports, leave cleanup and logout race');
}finally{env.cleanup()}
