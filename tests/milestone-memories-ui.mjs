// 原生模块与替身网络；不上传真实照片、不访问正式数据库。
import assert from 'node:assert/strict';
import {createTestApp} from './helpers/app.mjs';
const env=await createTestApp(),{app,w,$,errors}=env,a=app.actions,s=app.state;
const callbacks=[];let rows=[],uploads=0,failAt=0,pending,release,saveCalls=0;
const tick=()=>new Promise(r=>setTimeout(r,5));async function until(f){for(let i=0;i<250;i++){if(f())return;await tick()}throw Error('纪念记录界面等待超时')}
const parent='parent';
s.cloud={from(){return {select(){return this},eq(){return this},is(){return this},order(){return this},range(){return this},then(resolve,reject){return (pending?new Promise(r=>release=r):Promise.resolve({data:rows,error:null})).then(resolve,reject)}}},channel(){return {on(_e,filter,fn){callbacks.push({filter,fn});return this},subscribe(){return this}}},removeChannel:async()=>{},async rpc(name,args){if(name==='save_milestone_memory'){saveCalls++;rows=[{id:args.p_id,occurred_on:args.p_day,activity:args.p_activity,reflection:args.p_reflection,photos:args.p_photos,created_by:s.cloudUser.id,created_at:'2026-01-01T00:00:00Z',version:1}];return {data:{id:args.p_id,version:1},error:null}}if(name==='delete_milestone_memory'){rows=rows.filter(r=>r.id!==args.p_id);return {error:null}}throw Error(name)}};
s.cloudUser={id:'a'};s.sharedPeople=[{user_id:'a',nickname:'小甲'},{user_id:'b',nickname:'小乙'}];Object.assign(s.together,{ready:true,member:true,milestones:[{id:parent,title:'生日',date:'2000-01-01'}]});
a.compressTravelImage=async()=>new Blob(['fake'],{type:'image/jpeg'});a.uploadR2Photo=async()=>{uploads++;if(uploads===failAt)throw Error('模拟超时');return 'https://images.example.test/'+uploads+'.jpg'};
function files(n){Object.defineProperty($('#memoryUpload'),'files',{configurable:true,value:Array.from({length:n},(_,i)=>new w.File(['fake'],'pic'+i+'.jpg',{type:'image/jpeg'}))});$('#memoryUpload').dispatchEvent(new w.Event('change'))}
try{
 a.initNavigation();a.openMilestonePage();assert($('[data-memory-milestone]'));$('[data-memory-milestone]').click();await until(()=>$('#memoryListStatus')?.textContent.includes('共 0'));
 assert.equal($('#memoryParentTitle').textContent,'生日');$('#memoryActivity').value='<script>不是HTML</script>';$('#memoryReflection').value='一起过生日';files(6);assert.match($('#memoryFormStatus').textContent,/最多上传 5/);assert.equal(uploads,0);
 failAt=2;files(3);await until(()=>!s.milestoneMemories.uploading);assert.equal(s.milestoneMemories.photos.length,1);assert.match($('#memoryFormStatus').textContent,/上传失败/);assert.equal($('#memoryActivity').value,'<script>不是HTML</script>');
 failAt=0;files(4);await until(()=>!s.milestoneMemories.uploading);assert.equal(s.milestoneMemories.photos.length,5);$('#memoryPhotos a').click();assert($('#photoLightbox').open,'上传预览可放大');assert.match($('#largePhoto').src,/images.example.test/);$('#photoLightbox').close();files(1);assert.match($('#memoryFormStatus').textContent,/最多上传 5/);assert.equal(s.milestoneMemories.photos.length,5);
 $('#memoryDate').value='2026-01-01';$('#memoryForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await until(()=>saveCalls===1&&!s.milestoneMemories.busy);assert.equal(rows[0].photos.length,5);$('#memoryList .memory-photos a').click();assert($('#photoLightbox').open,'已保存纪念照片可放大');$('#photoLightbox').close();assert(!$('#memoryList script'));assert.match($('#memoryList').textContent,/<script>不是HTML/);assert($('[data-memory-edit]'));
 $('[data-memory-edit]').click();$('#memoryActivity').value='没有提交的草稿';rows=[...rows,{...rows[0],id:'b-record',created_by:'b',activity:'对方活动'}];callbacks[0].fn();await tick();assert.equal($('#memoryActivity').value,'没有提交的草稿');assert.equal($('#memoryList').querySelectorAll('[data-memory-edit]').length,1);
 a.render();await tick();assert.equal($('#memoryActivity').value,'没有提交的草稿','父板块刷新不覆盖草稿');
 pending=true;$('#memoryRefresh').click();await until(()=>release);s.cloudEpoch++;a.resetTogether();release({data:rows,error:null});await tick();assert.equal(s.milestoneMemories.rows.length,0);assert(!$('#milestoneMemoryPage'),'退出后旧请求不恢复记录');
 assert(callbacks.every(c=>c.filter.filter==='milestone_id=eq.parent'&&c.filter.event!=='DELETE'));assert.deepEqual(errors,[]);
 console.log('PASS: anniversary detail routing, 5-photo limit, partial upload rollback, escaped activity, shared/creator controls, realtime draft preservation and logout race');
}finally{env.cleanup()}
