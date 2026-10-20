// 模拟 Safari 的鼠标点击：原按钮失焦，但新按钮不获得焦点。
const print=typeof console==='object'?console.log:globalThis.print;
const window={TWO_US_CONFIG:{SHARED_ID:'our-shared-space'}};
const document={activeElement:null,listeners:{},body:{classList:{toggle(){}}},addEventListener(type,fn){(this.listeners[type]||=[]).push(fn)},dispatch(type,event){for(const fn of this.listeners[type]||[])fn(event)},createElement(){return new Element('generated')}};
class Element{
 constructor(id){this.id=id;this.hidden=false;this.value='';this.listeners={};this.parent=null;this.disabled=false;this.isConnected=true;this.dataset={}}
 addEventListener(type,fn){(this.listeners[type]||=[]).push(fn)}
 dispatch(type,event={}){event.target||=this;for(const fn of this.listeners[type]||[])fn(event);this['on'+type]?.(event)}
 contains(node){while(node){if(node===this)return true;node=node.parent}return false}
 setAttribute(name,value){this[name]=value}
 replaceChildren(){}
 append(...nodes){for(const node of nodes)node.parent=this}
 focus(){document.activeElement=this;document.dispatch('focusin',{target:this})}
 querySelectorAll(){return menuButtons}
 getClientRects(){return [1]}
 remove(){}
}
const elements=new Map();
const $=selector=>{if(selector==='#peopleMenu button:not([hidden])')return $('#editProfile');if(!elements.has(selector))elements.set(selector,new Element(selector));return elements.get(selector)};
const menuButtons=['editProfile','exportBackup','inviteSpace','joinSpace','logout'].map(id=>$('#'+id));
$('#peopleMenu').parent=$('#peopleArea');$('#peopleToggle').parent=$('#peopleArea');menuButtons.forEach(node=>node.parent=$('#peopleMenu'));
let records=[],map=null;
const closeModal=()=>{},render=()=>{},toast=()=>{};
const subs={film:['电影']},parseGenres=()=>[];
function assert(value,message){if(!value)throw Error(message)}
