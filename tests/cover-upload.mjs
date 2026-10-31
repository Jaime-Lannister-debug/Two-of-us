import assert from 'node:assert/strict';
import {createTestApp} from './helpers/app.mjs';
const env=await createTestApp(),{app,$,w}=env;let mode='success',calls=[],currentFile;
const nativeURL=globalThis.URL,nativeImage=globalThis.Image;
try{
 app.actions.openForm(); // 未登录时不打开，随后使用真实编辑模板。
 app.state.cloudUser={id:'test'};app.actions.openForm();
 const input=$('#coverUpload'),url=$('[name=image]'),message=$('#coverMessage'),save=$('#form button[type=submit]');
 currentFile=new w.File(['原始 PNG 内容'],'测试封面.png',{type:'image/png'});
 Object.defineProperty(input,'files',{configurable:true,get:()=>[currentFile]});
 url.value='https://old.example/cover.jpg';
 app.state.cloud={auth:{getSession:async()=>({data:{session:{access_token:'fake-session-token'}},error:null})}};
 app.services.fetch=async(address,options)=>{
  calls.push({address,options});if(mode==='network')throw new TypeError('Failed to fetch');
  if(options.method==='POST'){const body=JSON.parse(options.body);assert.equal(body.contentType,currentFile.type);assert.ok(body.filename.endsWith(({ 'image/png':'.png','image/webp':'.webp','image/jpeg':'.jpg' })[currentFile.type]));assert.equal(options.headers.Authorization,'Bearer fake-session-token');return new Response(JSON.stringify({uploadUrl:'https://test.r2.cloudflarestorage.com/covers/covers/test.jpg?signature=test',publicUrl:'https://pub-e97c7ebcf6e7475d85a27152bc869d5f.r2.dev/covers/test.jpg'}),{status:200})}
  assert.equal(options.headers['Content-Type'],currentFile.type);assert.equal(options.headers.Authorization,undefined);assert.equal(options.body,currentFile,'PUT 必须直接发送用户选择的原始文件');if(mode==='session-change')app.state.cloudEpoch++;return new Response(null,{status:mode==='put-failure'?403:200});
 };
 app.actions.setupCoverUpload();
 for(const [name,type] of [['测试封面.png','image/png'],['测试.webp','image/webp'],['测试.jpg','image/jpeg']]){currentFile=new w.File(['原始照片内容'],name,{type});mode='success';calls=[];await input.onchange();assert.equal(calls.length,2,message.textContent);assert.match(url.value,/r2.dev/);assert.equal(app.state.coverBusy,false);assert.equal(save.disabled,false);}
 for(const failure of ['put-failure','network','session-change']){mode=failure;url.value='https://old.example/cover.jpg';calls=[];await input.onchange();assert.equal(url.value,'https://old.example/cover.jpg');assert.match(message.textContent,/失败/);assert.equal(save.disabled,false);assert.equal(app.state.coverBusy,false);}
 currentFile=new w.File(['x'],'too-big.png',{type:'image/png'});Object.defineProperty(currentFile,'size',{value:21*1024*1024});calls=[];await input.onchange();assert.match(message.textContent,/20 MB/);assert.equal(calls.length,0);
 url.value='https://manual.example/cover.jpg';url.dispatchEvent(new w.Event('input'));assert.equal($('#coverPreview').src,url.value);
 console.log('PASS: original cover bytes and MIME, POST/PUT, URL-only save, failure rollback, session race and manual link');
}finally{globalThis.URL=nativeURL;globalThis.Image=nativeImage;env.cleanup()}
