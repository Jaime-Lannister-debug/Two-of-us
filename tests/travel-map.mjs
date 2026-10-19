// 地图回归：无需网络或真实行程数据，直接测试页面中的 initMap。
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const html=await readFile(new URL('../shared.html',import.meta.url),'utf8');
const start=html.indexOf('function initMap('),end=html.indexOf('function field(',start);
if(start<0||end<0)throw new Error('找不到地图函数');
if(!html.includes('.map{position:relative;z-index:0;isolation:isolate}'))throw new Error('地图缺少独立层叠上下文');
if(!html.includes("if(data.cat==='travel')selectedTripPoint=null"))throw new Error('保存后未清除待保存标点');
const fixture=`
import assert from 'node:assert/strict';
let map=null,selectedTripPoint=null,markers=[],tileHandlers={},events={},views=[],lastToast='',status;
const coordinate=(value,limit)=>value===null||value===undefined||String(value).trim()===''?undefined:Number.isFinite(Number(value))&&Math.abs(Number(value))<=limit?Number(value):undefined;
const esc=value=>String(value??''),toast=value=>lastToast=value;
const container={append(node){status=node},innerHTML:''};const $=()=>container;
const document={createElement(){return {setAttribute(){}}}};
const fakeMap={setView(point,zoom){views.push({point,zoom});return this},fitBounds(points,options){this.bounds=points;return this},on(type,fn){events[type]=fn;return this},removeLayer(){}};
let tileURL='',tileOptions;
const L={map:()=>fakeMap,tileLayer(url,options){tileURL=url;tileOptions=options;return {on(type,fn){tileHandlers[type]=fn;return this},addTo(){return this}}},circleMarker(point,options){const marker={point,options,addTo(){return this},bindPopup(){return this}};markers.push(marker);return marker}};
const window={L};
`+html.slice(start,end)+`
initMap([{lat:'',lng:''},{lat:null,lng:null},{lat:'0',lng:'0',title:'零坐标'},{lat:999,lng:12}]);
assert.equal(tileURL,'https://tile.openstreetmap.org/{z}/{x}/{y}.png');assert.ok(tileOptions.attribution.includes('OpenStreetMap'));assert.equal(markers.length,1);assert.deepEqual(views.at(-1),{point:[0,0],zoom:9});assert.equal(markers[0].options.bubblingMouseEvents,false);
tileHandlers.tileerror();assert.ok(status.textContent.includes('加载失败'));tileHandlers.tileload();assert.equal(status.hidden,true);
events.click({latlng:{lat:31.23456789,lng:121.12345678}});assert.deepEqual(selectedTripPoint,{lat:31.234568,lng:121.123457});assert.ok(lastToast.includes('新增回忆'));
window.L=null;initMap([]);assert.ok(container.innerHTML.includes('地图组件未加载'));
console.log('PASS: map source/attribution, overlay isolation, valid zero, single-point centering, tile errors and click-to-select');
`;
const folder=await mkdtemp(join(tmpdir(),'two-us-map-'));
try{const file=join(folder,'map-fixture.mjs');await writeFile(file,fixture);await import(pathToFileURL(file).href)}finally{await rm(folder,{recursive:true,force:true})}
