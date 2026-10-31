// 隔离 PostgreSQL 验收：仅使用测试 UUID，不连接用户的 Supabase。
// 运行：PGLITE_MODULE=/path/to/pglite/dist/index.js node tests/together-db.mjs
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE?pathToFileURL(process.env.PGLITE_MODULE).href:'@electric-sql/pglite');
const db=new PGlite();await db.waitReady;
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',C='00000000-0000-4000-8000-000000000003';
const space='test-space';
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;
 create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,private to authenticated;
 create table public.shared_items(id uuid primary key default gen_random_uuid(),content text not null,shared_id text not null,created_by uuid default auth.uid(),created_at timestamptz default now());
 create publication supabase_realtime;
 insert into auth.users values('${A}'),('${B}'),('${C}');`);
 await db.exec(await readFile(new URL('../supabase/02-option-b-members.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/04-shared-profiles.sql',import.meta.url),'utf8'));
 await db.exec(`insert into public.shared_members values('${space}','${A}'),('${space}','${B}');
 insert into public.shared_profiles(shared_id,user_id,nickname) values('${space}','${A}','小甲'),('${space}','${B}','小乙');
 alter table public.shared_items enable row level security;grant select,insert,delete,update on public.shared_items to authenticated;
 create policy items on public.shared_items to authenticated using(private.can_access_space(shared_id)) with check(private.can_access_space(shared_id));`);
 const migration=await readFile(new URL('../supabase/05-together-features.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);
 const login=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')};
 const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];

 const migration09=await readFile(new URL('../supabase/09-milestone-memories.sql',import.meta.url),'utf8');await db.exec(migration09);await db.exec(migration09);
 await login(A);const parent=await scalar("insert into public.milestones(shared_id,title,date) values($1,'生日','2000-01-01') returning id",[space]);
 const id=crypto.randomUUID();const photos=Array.from({length:5},(_,i)=>'https://images.example.test/'+i+'.jpg');
 const save=(version=0,images=photos,extra={})=>scalar('select public.save_milestone_memory($1,$2,$3,$4,$5,$6,$7,$8)',[space,extra.parent||parent,extra.id||id,version,'2026-01-01',extra.activity||'一起吃生日蛋糕',extra.reflection||'温暖的一天',JSON.stringify(images)]);
 const first=await save();assert.equal(first.version,1);assert.deepEqual(await save(),first,'重试不重复插入');assert.equal(await scalar('select count(*)::int from public.milestone_memories'),1);
 await assert.rejects(save(1,[...photos,'https://images.example.test/6.jpg']),/最多上传 5/);
 await assert.rejects(save(1,['javascript:alert(1)']),/HTTPS/);await assert.rejects(save(1,[12]),/HTTPS/);await assert.rejects(save(1,[photos[0],photos[0]]),/重复/);
 await save(1,[]);await assert.rejects(save(1,photos),/已被修改/);
 await login(B);assert.equal(await scalar('select count(*)::int from public.milestone_memories'),1);await assert.rejects(save(2),/只能修改/);await assert.rejects(db.query('select public.delete_milestone_memory($1,$2,2)',[space,id]),/只能删除/);
 await assert.rejects(db.query("update public.milestone_memories set activity='绕过RPC' where id=$1",[id]),/permission denied/);
 await save(0,[],{id:crypto.randomUUID(),activity:'B的活动'});
 await login(C);assert.equal(await scalar('select count(*)::int from public.milestone_memories'),0);await assert.rejects(save(),/共享空间/);
 await login(A);await db.exec('reset role');const foreign=await scalar("insert into public.milestones(shared_id,title,date) values('other-space','其他空间','2000-01-01') returning id");await login(A);await assert.rejects(save(0,[],{parent:foreign,id:crypto.randomUUID()}),/访问权限/);
 await db.query('select public.delete_milestone_memory($1,$2,2)',[space,id]);assert.equal(await scalar('select count(*)::int from public.milestone_memories where deleted_at is null'),1);
 await assert.rejects(save(2),/已被修改/);await db.query('delete from public.milestones where id=$1',[parent]);assert.equal(await scalar('select count(*)::int from public.milestone_memories'),0,'删除父纪念日级联清理');
 await db.exec('reset role');await db.exec('set role anon');await assert.rejects(db.query('select * from public.milestone_memories'),/permission denied/);
 console.log('PASS: milestone memories migration twice, 0–5 photo validation, idempotence/version conflict, member/creator RLS, cross-space rejection and parent cascade');
} catch(e){console.error('Memory SQL test failed:',e.message);process.exitCode=1;} finally{await db.close()}
