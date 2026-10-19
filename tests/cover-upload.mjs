// 从真实页面提取上传函数，在隔离模块内模拟浏览器和网络，绝不上传真实图片。
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const html = await readFile(new URL('../shared.html', import.meta.url), 'utf8');
const start = html.indexOf('// 仅这两个 R2 相关地址');
const end = html.indexOf('function closeModal()', start);
if (start < 0 || end < 0) throw new Error('找不到真实封面上传函数');
const source = html.slice(start, end);
const stubs = `
import assert from 'node:assert/strict';
import { Blob } from 'node:buffer';
let coverBusy=false,cloudEpoch=1,mode='success',calls=[],canvas;
const input={files:[{name:'测试封面.png',type:'image/png',size:1024}]};
const url={value:'https://old.example/cover.jpg',isConnected:true,addEventListener(type,fn){this[type]=fn}};
const preview={},message={},save={disabled:false};
const $=selector=>({'#coverUpload':input,'[name=image]':url,'#coverPreview':preview,'#coverMessage':message,'#form button[type=submit]':save})[selector];
const cloud={auth:{getSession:async()=>({data:{session:{access_token:'fake-session-token'}},error:null})}};
const requireCloudUser=()=>{},friendlyError=error=>error.message;
class Image{naturalWidth=1200;naturalHeight=600;set src(value){queueMicrotask(()=>this.onload())}}
const URL=class extends globalThis.URL{static createObjectURL(){return 'blob:test'}static revokeObjectURL(){}};
const document={createElement(){canvas={width:0,height:0,getContext(){return {fillRect(){},drawImage(){}}},toBlob(cb,type,quality){this.type=type;this.quality=quality;cb(new Blob(['jpeg'],{type}))}};return canvas}};
const fetch=async(address,options)=>{
 calls.push({address,options});
 if(mode==='network')throw new TypeError('Failed to fetch');
 if(options.method==='POST'){
  const body=JSON.parse(options.body);assert.equal(body.contentType,'image/jpeg');assert.ok(body.filename.endsWith('.jpg'));assert.equal(options.headers.Authorization,'Bearer fake-session-token');
  return new Response(JSON.stringify({uploadUrl:'https://test.r2.cloudflarestorage.com/covers/covers/test.jpg?signature=test',publicUrl:'https://pub-e97c7ebcf6e7475d85a27152bc869d5f.r2.dev/covers/test.jpg'}),{status:200});
 }
 assert.equal(options.headers['Content-Type'],'image/jpeg');assert.equal(options.headers.Authorization,undefined);assert.ok(options.body instanceof Blob);
 if(mode==='session-change')cloudEpoch++;
 return new Response(null,{status:mode==='put-failure'?403:200});
};
`;
const assertions = `
setupCoverUpload();await input.onchange();
assert.equal(canvas.width,400);assert.equal(canvas.height,200);assert.equal(canvas.quality,.6);assert.equal(canvas.type,'image/jpeg');
assert.equal(calls.length,2,message.textContent);assert.equal(url.value,'https://pub-e97c7ebcf6e7475d85a27152bc869d5f.r2.dev/covers/test.jpg');assert.equal(coverBusy,false);assert.equal(save.disabled,false);
for(const failure of ['put-failure','network','session-change']){
 mode=failure;url.value='https://old.example/cover.jpg';calls=[];setupCoverUpload();await input.onchange();assert.equal(url.value,'https://old.example/cover.jpg');assert.ok(message.textContent.includes('失败'));assert.equal(save.disabled,false);assert.equal(coverBusy,false);
}
url.value='https://manual.example/cover.jpg';url.input();assert.equal(preview.src,url.value);
console.log('PASS: R2 cover compression, POST/PUT payload, URL-only success, failure rollback, session race and manual URL');
`;
const folder = await mkdtemp(join(tmpdir(), 'two-us-cover-'));
try {
  const file = join(folder, 'cover-fixture.mjs');
  await writeFile(file, stubs + source + assertions);
  await import(pathToFileURL(file).href);
} finally {
  await rm(folder, { recursive: true, force: true });
}
