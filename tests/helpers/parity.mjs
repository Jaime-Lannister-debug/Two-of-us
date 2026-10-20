// 固定数据契约：重构前记录的 DOM 摘要，用于发现无意的视觉/交互结构变化。
import {createHash} from 'node:crypto';
export const demoRecords=[
 {id:'game',cat:'game',sub:'Switch 1 & 2',title:'王国之泪',state:'doing',score:9,playHours:150,desc:'一起探索',note:'最好的队友',date:'2026-10-20',image:'https://example.test/game.jpg',genres:['开放世界']},
 {id:'tv',cat:'film',sub:'电视剧',title:'我们的电视剧',state:'doing',score:8,totalEpisodes:24,watchedEpisodes:6,currentEpisode:7,date:'2026-10-20',desc:'本周一起看',note:'第七集',image:'https://example.test/tv.jpg',genres:['喜剧片']},
 {id:'film',cat:'film',sub:'电影',title:'周末电影',state:'wish',score:0,date:'2026-10-21',desc:'收藏一部电影',note:'',genres:[]},
 {id:'music',cat:'music',sub:'单曲',title:'晴天',state:'done',score:9,date:'2026-10-20',desc:'周杰伦',musicUrl:'https://y.qq.com/n/ryqq/songDetail/0039MnYb0qxYhV',note:'一起听',image:'https://example.test/music.jpg',genres:['流行']},
 {id:'trip',cat:'travel',sub:'国内',title:'旅行',state:'done',score:9,date:'2026-10-01',endDate:'2026-10-05',place:'杭州',desc:'城市漫游',note:'一起走过',image:'https://example.test/trip.jpg',photos:['https://example.test/trip2.jpg'],hotels:[{name:'酒店一',checkIn:'2026-10-01',checkOut:'2026-10-03',note:'湖边'},{name:'酒店二',checkIn:'2026-10-03',checkOut:'2026-10-05',note:''}],genres:['城市漫游']},
 {id:'intimacy',cat:'intimacy',sub:'亲密记录',title:'温柔的夜晚',state:'done',score:8,date:'2026-10-20',place:'家',brand:'示例',desc:'',note:'只属于我们',image:'https://example.test/night.jpg',genres:['温柔']}
];
export const cases=[
 ...['home','film','game','music','travel','intimacy'].map(page=>({name:'list-'+page,type:'list',page})),
 ...['game','tv','music','trip','intimacy'].map(id=>({name:'details-'+id,type:'details',id})),
 ...demoRecords.map(r=>({name:'editor-'+r.id,type:'editor',id:r.id})),
 {name:'bottle-happy',type:'mood',kind:'happy'},{name:'messages',type:'messages'},
 {name:'milestone-manager',type:'milestones'}
];
export function normalizeNode(node){
 if(node.nodeType===3){const value=node.textContent.replace(/\s+/g,' ').trim();return value?value:null}
 if(node.nodeType!==1)return null;
 return {tag:node.tagName,attrs:[...node.attributes].map(a=>[a.name,a.value.replace(/\s+/g,' ').trim()]).sort((a,b)=>a[0].localeCompare(b[0])),children:[...node.childNodes].map(normalizeNode).filter(x=>x!==null)};
}
export const digest=node=>createHash('sha256').update(JSON.stringify(normalizeNode(node))).digest('hex');
export function seed(app,core){const store=app.state;store.cloudUser={id:'a'};store.records=demoRecords.map(r=>core.normalizeItem(structuredClone(r)));for(const item of store.records)store.rawRows.set(item.id,{content:JSON.stringify(item)});store.month=new Date(2026,9,1);store.sharedPeople=[{user_id:'a',nickname:'小甲'},{user_id:'b',nickname:'小乙'}];Object.assign(store.together,{member:true,ready:true,milestones:[{id:'m',title:'在一起',date:'2024-02-14',repeat_yearly:true,is_relationship:true}],moods:[{id:'mood',kind:'happy',content:'今天很开心',created_by:'b',created_at:'2026-10-20T04:00:00Z'}],reads:new Set(),notifications:[{id:'n',actor_name:'小乙',action:'UPDATE',item_id:'game',item_title:'王国之泪',item_cat:'game',created_at:'2026-10-20T04:00:00Z',read_at:null}]});}
export function capture(app,document,entry){const {actions:a,state:s}=app;history.replaceState(null,'','/shared.html');s.map=null;s.page=entry.page||'home';s.query='';s.filter='全部';s.genreFilter='';s.stateFilter='';s.selectedDate='';s.editing=null;
 if(entry.type==='list'){a.render();return digest(document.querySelector('#content'))}
 if(entry.type==='details'){a.renderDetail(entry.id);return digest(document.querySelector('#content'))}
 if(entry.type==='editor'){a.openForm(entry.id);return digest(document.querySelector('#fields'))}
 if(entry.type==='mood'){s.together.kind=entry.kind;a.renderBottleContents();return digest(document.querySelector('#moodDialog'))}
 if(entry.type==='messages'){a.renderMessages();return digest(document.querySelector('#notificationList'))}
 a.renderMilestoneList();return digest(document.querySelector('#milestoneList'));
}
export async function cssDigest(){
 const {readFile}=await import('node:fs/promises'),{JSDOM}=await import('jsdom');
 const entry=await readFile(new URL('../../styles/app.css',import.meta.url),'utf8');
 const chunks=await Promise.all([...entry.matchAll(/url\(['"](.+?)['"]\)/g)].map(match=>readFile(new URL('../../styles/'+match[1],import.meta.url),'utf8')));
 const dom=new JSDOM('<style>'+chunks.join('\n')+'</style>');
 try{const rules=[...dom.window.document.styleSheets[0].cssRules].map(rule=>rule.cssText.replace(/\s+/g,'').replace(/"/g,"'").replace(/(?<![\d])0?\.\d+/g,n=>String(Number(n))).replace(/\[([a-z-]+)=['"]?([\w-]+)['"]?\]/g,'[$1=$2]'));return createHash('sha256').update(rules.join('\n')).digest('hex');}finally{dom.window.close()}
}
