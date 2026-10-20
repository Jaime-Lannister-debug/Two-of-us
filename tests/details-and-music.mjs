import assert from 'node:assert/strict';
import {createTestApp} from './helpers/app.mjs';
const env=await createTestApp(),{app,core,$,w}=env,api=app.actions,store=app.state;
try{
 assert.throws(()=>core.qqShareInfo('https://evil.example/songDetail/abc'));
 assert.equal(core.qqShareInfo('https://y.qq.com/n/ryqq/songDetail/0039MnYb0qxYhV').mid,'0039MnYb0qxYhV');assert.equal(core.qqShareInfo('https://y.qq.com/n/ryqq/albumDetail/000MkMni19ClKG').album,'000MkMni19ClKG');
 const shared=core.qqShareInfo('分享周杰伦的单曲《晴天》 https://c6.y.qq.com/base/fcgi-bin/u?__=xyz');assert.equal(shared.artist,'周杰伦');assert.equal(shared.title,'晴天');
 const trip=core.normalizeItem({cat:'travel',sub:'国内',id:'trip',title:'旅行',state:'doing',date:'2026-10-20',endDate:'2026-10-24',image:'https://img.example/cover.jpg',photos:Array.from({length:15},(_,i)=>'https://img.example/'+i+'.jpg'),hotel:'旧酒店',genres:[]});assert.equal(core.travelPhotos(trip).length,10);assert.equal(trip.hotels[0].name,'旧酒店');assert.equal(trip.endDate,'2026-10-24');
 const game=core.normalizeItem({cat:'game',playHours:150,progress:90,totalEpisodes:4});assert(!('progress' in game));assert(!('totalEpisodes' in game));assert.match(api.gameTimeCard(game),/150 小时/);assert.match(api.gameTimeCard(game),/role="meter"/);
 const row={content:'expected'};trip.photos=trip.photos.slice(0,8);trip.hotels=[{name:'酒店一'},{name:'酒店二'}];store.records=[trip];store.rawRows.set('trip',row);store.cloudUser={id:'me'};store.cloud={};w.location.hash='item=trip';api.renderDetail('trip');assert.match($('#content').innerHTML,/orbit-cover/);assert.match($('#content').textContent,/酒店二/);assert.match($('#content').textContent,/2026-10-24/);
 // 上传按钮与隐藏 file input 分离；保持键盘可操作和多选。
 assert.equal($('#travelUploadButton').tagName,'BUTTON');assert($('#travelPhotoUpload').hidden);assert($('#travelPhotoUpload').multiple);
 await api.uploadTravelPhotos('trip',[{},{}]);assert.match($('#galleryMessage').textContent,/还可上传 1 张/);
 api.compressTravelImage=async()=>({});api.uploadR2Photo=async()=> 'https://img.example/new.jpg';let saved;api.saveSharedItem=async(data,id,expected)=>{saved={data,id,expected}};api.loadSharedItems=async()=>{};
 await api.uploadTravelPhotos('trip',[{type:'image/jpeg',size:10,name:'new.jpg'}]);assert.equal(saved.expected,'expected');assert.equal(core.travelPhotos(saved.data).length,10);assert.equal(saved.data.image,trip.image);
 // 官方脚本以可控 DOM 载入替身返回 JSONP，直接执行真实音乐模块。
 const append=w.document.head.append.bind(w.document.head);w.document.head.append=script=>{const url=new URL(script.src),cb=url.searchParams.get('callback')||url.searchParams.get('jsonpCallback');if(!cb)return append(script);queueMicrotask(()=>w[cb](url.pathname.includes('search')?{data:{song:{list:[{songname:'晴天',songmid:'mid',singer:[{name:'周杰伦'}]}]}}}:{code:0,data:[{name:'晴天',singer:[{name:'周杰伦'}],album:{mid:'album',name:'叶惠美'}}]}));};
 const music=await api.readQQMusic('分享周杰伦的单曲《晴天》 https://c6.y.qq.com/base/fcgi-bin/u?__=xyz');assert.equal(music.title,'晴天');assert.match(music.image,/album.jpg/);assert.match(music.desc,/周杰伦/);await assert.rejects(()=>api.readQQMusic('https://c6.y.qq.com/base/fcgi-bin/u?__=xyz'),/完整分享文字/);
 console.log('PASS: native modules detail/range/hotels, ten-photo cap, optimistic gallery, hour meter and QQ JSONP metadata');
}finally{env.cleanup()}
