import assert from 'node:assert/strict';
import worker from '../workers/ledger-receipts.js';
import {ledgerReceipts} from '../src/ledger/receipts.js';
import {createTestApp} from './helpers/app.mjs';
const nativeFetch=globalThis.fetch,origin='https://jaime-lannister-debug.github.io',id='00000000-0000-4000-8000-000000000001',uid='00000000-0000-4000-8000-000000000002',space='our-shared-space';
const objects=new Map(),prefix=`ledger/${space}/${uid}/${id}/`;
const env={ALLOWED_ORIGIN:origin,SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLIC_KEY:'sb_publishable_test_only',LEDGER_RECEIPTS:{async put(key,bytes){objects.set(key,bytes)},async get(key){return objects.has(key)?{body:objects.get(key)}:null}}};
let key,denied=false,calls=0;
globalThis.fetch=async(url,options)=>{calls++;assert.equal(options.headers.Authorization,'Bearer test-jwt');assert(!String(url).includes('test-jwt'));assert.equal(options.headers.apikey,env.SUPABASE_PUBLIC_KEY);const body=JSON.parse(options.body);assert.equal(body.p_space,space);assert.equal(body.p_id,id);return new Response(JSON.stringify(denied?{message:'请先加入共享空间'}:body.p_mode==='upload'?{prefix}:{objectKey:key}),{status:denied?403:200})};
const request=(path,options={})=>new Request('https://private.example/'+path,{...options,headers:{Origin:origin,Authorization:'Bearer test-jwt',...options.headers}});
try{
 let r=await worker.fetch(request('upload',{method:'OPTIONS'}),env);assert.equal(r.status,204);assert(r.headers.get('Access-Control-Allow-Headers').includes('X-Entry-Id'));
 r=await worker.fetch(request('upload',{method:'POST',headers:{Authorization:''}}),env);assert.equal(r.status,401);assert.equal(calls,0);
 r=await worker.fetch(request('upload',{method:'POST',headers:{'X-Shared-Id':space,'X-Entry-Id':id,'Content-Type':'image/jpeg'},body:new Uint8Array([255,216,255,217])}),env);assert.equal(r.status,200,await r.clone().text());({objectKey:key}=await r.json());assert(key.startsWith(prefix));assert.equal(objects.size,1);
 r=await worker.fetch(request(`receipt?sharedId=${space}&entryId=${id}`),env);assert.equal(r.status,200);assert.equal(r.headers.get('Content-Type'),'image/jpeg');assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal((await r.arrayBuffer()).byteLength,4);
 denied=true;r=await worker.fetch(request(`receipt?sharedId=${space}&entryId=${id}`),env);assert.equal(r.status,403);denied=false;
 r=await worker.fetch(request('upload',{method:'POST',headers:{'X-Shared-Id':space,'X-Entry-Id':id,'Content-Type':'image/jpeg'},body:'not a jpeg'}),env);assert.equal(r.status,415);
 r=await worker.fetch(request('upload',{method:'POST',headers:{'X-Shared-Id':space,'X-Entry-Id':id,'Content-Type':'image/jpeg','Content-Length':String(6*1024*1024)},body:new Uint8Array([255,216,255,217])}),env);assert.equal(r.status,413);
 r=await worker.fetch(request('receipt',{headers:{Origin:'https://evil.example'}}),env);assert.equal(r.status,403);
 const ui=await createTestApp();try{ui.app.state.cloudUser={id:uid};const receipts=ledgerReceipts(ui.app);await assert.rejects(receipts.read(id),/尚未配置/);ui.app.config.LEDGER_RECEIPTS_WORKER_URL='https://private.example/';ui.app.state.cloud={auth:{getSession:()=>new Promise(()=>{})}};const pending=receipts.read(id);const rejected=assert.rejects(pending,/已取消或超时/);receipts.dispose();await rejected;}finally{ui.cleanup()}
 console.log('PASS: private Worker CORS, JWT forwarding, permission denial, JPEG/size validation, no-store streaming and client auth-wait cancellation');
}finally{globalThis.fetch=nativeFetch}
