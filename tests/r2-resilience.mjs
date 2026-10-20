// 使用假时钟检验签名响应体超时、PUT 重试幂等及退出取消；不访问真实云服务。
import assert from 'node:assert/strict';
import {createTestApp} from './helpers/app.mjs';
const env=await createTestApp();const {app}=env;
const result={uploadUrl:'https://test.r2.cloudflarestorage.com/covers/covers/test.jpg?signature=test',publicUrl:'https://pub-e97c7ebcf6e7475d85a27152bc869d5f.r2.dev/covers/test.jpg'};
const reply=()=>new Response(JSON.stringify(result),{status:200});
const tick=()=>new Promise(r=>setTimeout(r,0));
const tasks=new Map();let counter=0;
app.timers.setTimeout=(fn,ms)=>{const id=++counter;tasks.set(id,{fn,ms});return id};app.timers.clearTimeout=id=>tasks.delete(id);
async function advance(ms){await tick();for(const [id,t]of [...tasks])if(t.ms===ms){tasks.delete(id);t.fn()}await tick()}
app.state.cloudUser={id:'a'};app.state.cloud={auth:{getSession:async()=>({data:{session:{access_token:'test-token'}},error:null})}};
try{
 let post=0,put=0;const addresses=[],statuses=[];
 app.services.fetch=async(url,options)=>{if(options.method==='POST'){post++;return post===1?{ok:true,status:200,json:()=>new Promise(()=>{})}:reply()}put++;addresses.push(url);assert(!options.headers.Authorization);return new Response(null,{status:200})};
 let pending=app.actions.uploadR2Photo(new Blob(['jpeg']),'a.png',s=>statuses.push(s));await advance(60000);await advance(1000);assert.equal(await pending,result.publicUrl);assert.equal(post,2);assert.equal(put,1);assert(statuses.some(s=>/重试/.test(s)),'响应体读取卡住也超时重试');
 post=put=0;addresses.length=0;
 app.services.fetch=async(url,options)=>{if(options.method==='POST'){post++;return reply()}put++;addresses.push(url);if(put===1)return new Promise(()=>{});return new Response(null,{status:200})};
 pending=app.actions.uploadR2Photo(new Blob(['jpeg']),'b.png');await advance(180000);await advance(1000);await pending;assert.equal(post,1);assert.equal(put,2);assert.equal(addresses[0],addresses[1],'重试 PUT 使用同一对象地址');
 let requests=0;
 app.services.fetch=async()=>{requests++;return new Response(JSON.stringify({error:'请先登录网页后上传'}),{status:401})};
 await assert.rejects(app.actions.uploadR2Photo(new Blob(['jpeg']),'c.png'),/登录/);assert.equal(requests,1,'401 不重试');
 post=0;app.services.fetch=async()=>{post++;return new Promise(()=>{})};
 pending=app.actions.uploadR2Photo(new Blob(['jpeg']),'d.png');await tick();const rejected=assert.rejects(pending,/登录状态已变化/);app.state.cloudEpoch++;app.actions.cancelImageUploads();await rejected;assert.equal(post,1,'退出后不再重试');
 assert.equal(tasks.size,0,'请求结束后清理所有时钟');
 console.log('PASS: presign body timeout/retry, idempotent PUT retry, no auth retry, logout cancellation and timer cleanup');
}finally{env.cleanup()}
