import assert from 'node:assert/strict';
import {createTestApp} from './helpers/app.mjs';
const env=await createTestApp(),{app,$,w}=env;
try{
 const container=w.document.createElement('div');container.id='map';$('#content').append(container);
 let markers=[],tileHandlers={},events={},views=[],tileURL='',tileOptions;
 const fakeMap={setView(point,zoom){views.push({point,zoom});return this},fitBounds(points){this.bounds=points;return this},on(type,fn){events[type]=fn;return this},removeLayer(){},remove(){}};
 w.L={map:()=>fakeMap,tileLayer(url,options){tileURL=url;tileOptions=options;return {on(type,fn){tileHandlers[type]=fn;return this},addTo(){return this}}},circleMarker(point,options){const marker={point,options,addTo(){return this},bindPopup(){return this}};markers.push(marker);return marker}};
 app.actions.initMap([{lat:'',lng:''},{lat:null,lng:null},{lat:'0',lng:'0',title:'零坐标'},{lat:999,lng:12}]);
 assert.equal(tileURL,'https://tile.openstreetmap.org/{z}/{x}/{y}.png');assert.match(tileOptions.attribution,/OpenStreetMap/);assert.equal(markers.length,1);assert.deepEqual(views.at(-1),{point:[0,0],zoom:9});assert.equal(markers[0].options.bubblingMouseEvents,false);
 const status=$('.map-load-status');tileHandlers.tileerror();assert.match(status.textContent,/加载失败/);tileHandlers.tileload();assert(status.hidden);
 events.click({latlng:{lat:31.23456789,lng:121.12345678}});assert.deepEqual(app.state.selectedTripPoint,{lat:31.234568,lng:121.123457});
 w.L=null;app.actions.initMap([]);assert.match(container.innerHTML,/地图组件未加载/);
 console.log('PASS: module map source/attribution, valid zero, centering, tile errors and click-to-select');
}finally{env.cleanup()}
