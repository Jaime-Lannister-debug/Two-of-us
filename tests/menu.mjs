import assert from 'node:assert/strict';
import {createTestApp} from './helpers/app.mjs';
const env=await createTestApp(),{app,$,w}=env;
try{
 app.actions.initPeopleUI();app.state.cloudUser={id:'me'};
 const open=()=>{$('#peopleMenu').hidden=true;$('#peopleToggle').click();assert(!$('#peopleMenu').hidden)};
 for(const id of ['exportBackup','inviteSpace','joinSpace','logout']){
  let calls=0;$('#'+id).onclick=()=>calls++;open();$('#peopleMenu').dispatchEvent(new w.FocusEvent('focusout',{relatedTarget:null}));assert(!$('#peopleMenu').hidden);$('#'+id).click();assert.equal(calls,1);assert($('#peopleMenu').hidden);
 }
 open();$('#editProfile').click();assert(!$('#profileModal').hidden);assert.equal(w.document.activeElement,$('#myNickname'));
 open();w.document.dispatchEvent(new w.FocusEvent('focusin',{bubbles:true}));assert($('#peopleMenu').hidden);
 open();$('#peopleArea').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert($('#peopleMenu').hidden);assert.equal(w.document.activeElement,$('#peopleToggle'));
 console.log('PASS: real DOM menu actions, Safari null-relatedTarget blur, profile dialog and keyboard focus');
}finally{env.cleanup()}
