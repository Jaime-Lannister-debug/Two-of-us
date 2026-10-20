import assert from 'node:assert/strict';
import {createTestApp} from './helpers/app.mjs';
const env=await createTestApp(),{app,$,w}=env;let mode='success',calls=[],canvas;
const nativeURL=globalThis.URL,nativeImage=globalThis.Image;
try{
 app.actions.openForm(); // 未登录时不打开，随后使用真实编辑模板。
 app.state.cloudUser={id:'test'};app.actions.openForm();
 const input=$('#coverUpload'),url=$('[name=image]'),message=$('#coverMessage'),save=$('#form button[type=submit]');
 Object.defineProperty(input,'files',{configurable:true,value:[{name:'测试封面.png',type:'image/png',size:1024}]});
 url.value='https://old.example/cover.jpg';
 app.state.cloud={auth:{getSession:async()=>({data:{session:{access_token:'fake-session-token'}},error:null})}};
 globalThis.Image=class{naturalWidth=1200;naturalHeight=600;set src(value){queueMicrotask(()=>this.onload())}};
 globalThis.URL=class extends nativeURL{static createObjectURL(){return 'blob:test'}static revokeObjectURL(){}};
 const create=w.document.createElement.bind(w.document);w.document.createElement=name=>{if(name!=='canvas')return create(name);canvas={width:0,height:0,getContext(){return {fillRect(){},drawImage(){}}},toBlob(cb,type,quality){this.type=type;this.quality=quality;cb(new Blob(['jpeg'],{type}))}};return canvas};
 app.services.fetch=async(address,options)=>{
  calls.push({address,options});if(mode==='network')throw new TypeError('Failed to fetch');
  if(options.method==='POST'){const body=JSON.parse(options.body);assert.equal(body.contentType,'image/jpeg');assert.ok(body.filename.endsWith('.jpg'));assert.equal(options.headers.Authorization,'Bearer fake-session-token');return new Response(JSON.stringify({uploadUrl:'https://test.r2.cloudflarestorage.com/covers/covers/test.jpg?signature=test',publicUrl:'https://pub-e97c7ebcf6e7475d85a27152bc869d5f.r2.dev/covers/test.jpg'}),{status:200})}
  assert.equal(options.headers['Content-Type'],'image/jpeg');assert.equal(options.headers.Authorization,undefined);assert(options.body instanceof Blob);if(mode==='session-change')app.state.cloudEpoch++;return new Response(null,{status:mode==='put-failure'?403:200});
 };
 app.actions.setupCoverUpload();await input.onchange();assert.equal(canvas.width,400);assert.equal(canvas.height,200);assert.equal(canvas.quality,.6);assert.equal(canvas.type,'image/jpeg');assert.equal(calls.length,2,message.textContent);assert.match(url.value,/r2.dev/);assert.equal(app.state.coverBusy,false);assert.equal(save.disabled,false);
 for(const failure of ['put-failure','network','session-change']){mode=failure;url.value='https://old.example/cover.jpg';calls=[];await input.onchange();assert.equal(url.value,'https://old.example/cover.jpg');assert.match(message.textContent,/失败/);assert.equal(save.disabled,false);assert.equal(app.state.coverBusy,false)}
 url.value='https://manual.example/cover.jpg';url.dispatchEvent(new w.Event('input'));assert.equal($('#coverPreview').src,url.value);
 console.log('PASS: module R2 compression, POST/PUT, URL-only save, failure rollback, session race and manual link');
}finally{globalThis.URL=nativeURL;globalThis.Image=nativeImage;env.cleanup()}
