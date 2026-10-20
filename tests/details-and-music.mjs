import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../shared.html',import.meta.url),'utf8');
const block=html.slice(html.indexOf('// 详情页沿用单文件'),html.indexOf('void initSharedCloud();'));
const numbers=html.slice(html.indexOf('const finiteNumber'),html.indexOf('function validCoverSize'));
const elements=new Map();
const el=key=>{if(!elements.has(key))elements.set(key,{textContent:'',innerHTML:'',setAttribute(){},querySelectorAll(){return []}});return elements.get(key)};
const context=vm.createContext({console,URL,URLSearchParams,assert,setTimeout,clearTimeout,crypto,confirm:()=>true,
 window:{location:{hash:'#item=trip'}},history:{},$ :el,esc:s=>String(s??''),
 MAX_COVER_DATA_LENGTH:300000,hasProgress:r=>r.cat==='film'&&r.sub==='电视剧',
 cats:{travel:['','旅行'],game:['','游戏']},status:{doing:'进行中'},genreBadges:()=>'',progressCard:()=>'',
 listLoading:false,render(){},toast(){},requireCloudUser(){},friendlyError:e=>e.message,writeBusy:false,coverBusy:false,
 records:[],rawRows:new Map(),cloudEpoch:1,loadSharedItems:async()=>{}});
vm.runInContext(numbers+'\n'+block,context);
await vm.runInContext(`(async()=>{
 assert.throws(()=>qqShareInfo('https://evil.example/songDetail/abc'));
 assert.equal(qqShareInfo('https://y.qq.com/n/ryqq/songDetail/0039MnYb0qxYhV').mid,'0039MnYb0qxYhV');
 assert.equal(qqShareInfo('https://y.qq.com/n/ryqq/albumDetail/000MkMni19ClKG').album,'000MkMni19ClKG');
 const shared=qqShareInfo('分享周杰伦的单曲《晴天》 https://c6.y.qq.com/base/fcgi-bin/u?__=xyz');assert.equal(shared.artist,'周杰伦');assert.equal(shared.title,'晴天');
 const trip=normalizeItem({cat:'travel',id:'trip',title:'旅行',state:'doing',date:'2026-10-20',endDate:'2026-10-24',image:'https://img.example/cover.jpg',photos:Array.from({length:15},(_,i)=>'https://img.example/'+i+'.jpg'),hotel:'旧酒店'});
 assert.equal(travelPhotos(trip).length,10);assert.equal(trip.hotels[0].name,'旧酒店');assert.equal(trip.endDate,'2026-10-24');
 const game=normalizeItem({cat:'game',playHours:150,progress:90,totalEpisodes:4});assert(!('progress' in game));assert(!('totalEpisodes' in game));assert.match(gameTimeCard(game),/150 小时/);assert.match(gameTimeCard(game),/role="meter"/);
 const row={content:'expected'};trip.photos=trip.photos.slice(0,8);trip.hotels=[{name:'酒店一'},{name:'酒店二'}];records=[trip];rawRows.set('trip',row);renderDetail('trip');assert.match($('#content').innerHTML,/orbit-cover/);assert.match($('#content').innerHTML,/酒店二/);assert.match($('#content').innerHTML,/2026-10-24/);
 await uploadTravelPhotos('trip',[{},{ }]);assert.match($('#galleryMessage').textContent,/还可上传 1 张/);
 compressTravelImage=async()=>({});uploadR2Photo=async()=> 'https://img.example/new.jpg';let saved;
 saveSharedItem=async(data,id,expected)=>{saved={data,id,expected}};
 await uploadTravelPhotos('trip',[{type:'image/jpeg',size:10,name:'new.jpg'}]);assert.equal(saved.expected,'expected');assert.equal(travelPhotos(saved.data).length,10);assert.equal(saved.data.image,trip.image);
 qqJSONP=async(path)=>path.includes('search')?{data:{song:{list:[{songname:'晴天',songmid:'mid',singer:[{name:'周杰伦'}]}]}}}:{code:0,data:[{name:'晴天',singer:[{name:'周杰伦'}],album:{mid:'album',name:'叶惠美'}}]};
 const music=await readQQMusic('分享周杰伦的单曲《晴天》 https://c6.y.qq.com/base/fcgi-bin/u?__=xyz');assert.equal(music.title,'晴天');assert.match(music.image,/album.jpg/);assert.match(music.desc,/周杰伦/);
 await assert.rejects(()=>readQQMusic('https://c6.y.qq.com/base/fcgi-bin/u?__=xyz'),/完整分享文字/);
})()`,context);
console.log('PASS: detail rendering, travel legacy/range/hotels, ten-photo limit, optimistic gallery save, hour meter and QQ link metadata');
