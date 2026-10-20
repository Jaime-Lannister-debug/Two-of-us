import assert from 'node:assert/strict';
import {createTestApp} from './helpers/app.mjs';
const env=await createTestApp(),{app,$,w}=env;const s=app.state,a=app.actions;
const dates=Array.from({length:12},(_,i)=>({id:'date-'+i,title:'纪念日 '+i,date:'2026-10-20',repeat_yearly:true,is_relationship:i===0}));
try{
 s.cloudUser={id:'a'};s.cloud={rpc:async()=>({error:null})};Object.assign(s.together,{member:true,ready:true,milestones:dates,notifications:[{id:'notice',item_id:'date-7',item_title:'纪念日 7',item_cat:'milestone',actor_name:'小乙',action:'INSERT',created_at:'2026-10-20T00:00:00Z',read_at:null}]});
 a.initNavigation();a.initTogetherUI();a.updateTogetherBadges();assert.equal($('#milestonesUnread').textContent,'1');
 $('#milestonesNav').click();assert(a.isMilestonePage());assert.equal(w.document.querySelectorAll('.milestone-card').length,12,'完整显示超过4条的纪念日');assert.match($('#content').textContent,/纪念日 11/);assert.equal($('#add').textContent,'＋ 新增纪念日');
 const card=$('#milestone-card-date-7');assert(card.querySelector('.item-unread'));
 $('[data-view-milestone="date-7"]').click();await new Promise(r=>setTimeout(r,0));assert($('#milestoneDialog').open);assert.equal($('#milestoneTitle').value,'纪念日 7');assert($('#milestonesUnread').hidden);assert(!card.querySelector('.item-unread'));
 $('#milestoneDialog').close();s.together.notifications[0].read_at=null;a.renderMessages();assert.match($('#notificationList').textContent,/小乙添加了纪念日「纪念日 7」/);
 $('#notificationList button').click();assert(a.isMilestonePage());assert.match(w.location.hash,/milestone=date-7/);
 a.go('home');assert($('#manageMilestones'));$('#manageMilestones').click();assert(a.isMilestonePage());
 s.together.member=false;a.resetTogether();assert(!$('.milestone-card'),'撤销成员后清除页面');
 // 超过默认1000行也逐页加载，不截断。
 const many=Array.from({length:1005},(_,i)=>({id:String(i)}));let pages=0;s.cloud={from(){return{select(){return this},eq(){return this},order(){return this},range(start,end){pages++;return Promise.resolve({data:many.slice(start,end+1),error:null})}}}};
 const all=await a.allMilestones();assert.equal(all.data.length,1005);assert.equal(pages,3);
 console.log('PASS: independent milestone board, >4 and >1000 entries, nav/bell unread, edit/read dot removal, notification route and nonmember cleanup');
}finally{env.cleanup()}
