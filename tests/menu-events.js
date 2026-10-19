initPeopleUI();cloudUser={id:'me'};
function openMenu(){ $('#peopleMenu').hidden=true;$('#peopleToggle').dispatch('click');assert(!$('#peopleMenu').hidden,'menu opens'); }
function safariClick(button){
 // 旧实现在这次 focusout 中提前隐藏菜单，导致稍后的 click 无法到达按钮。
 $('#peopleMenu').dispatch('focusout',{relatedTarget:null});document.activeElement=null;
 assert(!$('#peopleMenu').hidden,'blur must not dismiss before click');
 button.dispatch('click');document.dispatch('click',{target:button});
}
for(const id of ['exportBackup','inviteSpace','joinSpace','logout']){
 let calls=0;$('#'+id).onclick=()=>calls++;openMenu();safariClick($('#'+id));assert(calls===1,id+' executes once');assert($('#peopleMenu').hidden,id+' closes menu after activation');
}
openMenu();safariClick($('#editProfile'));assert(!$('#profileModal').hidden,'personal settings opens dialog');assert(document.activeElement===$('#myNickname'),'nickname field focused');
openMenu();document.dispatch('focusin',{target:new Element('outside')});assert($('#peopleMenu').hidden,'keyboard focus outside closes menu');
openMenu();$('#peopleArea').dispatch('keydown',{key:'Escape',preventDefault(){}});assert($('#peopleMenu').hidden&&document.activeElement===$('#peopleToggle'),'Escape restores toggle focus');
print('PASS: Safari blur/click routing for all five menu actions; settings dialog and keyboard dismissal');
