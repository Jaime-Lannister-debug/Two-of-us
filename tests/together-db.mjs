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
 await login(A);
 await db.query("insert into public.milestones(shared_id,title,date,repeat_yearly,is_relationship) values($1,'在一起','2020-02-29',true,true)",[space]);
 await db.query("select public.add_mood($1,'happy','A 的好心情')",[space]);
 const unread=()=>scalar("select count(*)::int from public.mood_entries e where shared_id=$1 and kind='happy' and created_by<>auth.uid() and not exists(select 1 from public.mood_reads r where r.mood_id=e.id and r.user_id=auth.uid())",[space]);
 assert.equal(await unread(),0,'A 自己发送不增加自己的未读');
 await login(B);assert.equal(await unread(),1,'B 登录看到 A 的未读 +1');
 const aMood=await scalar('select id from public.mood_entries where shared_id=$1',[space]);
 await db.query('select public.read_moods($1,$2::uuid[])',[space,[aMood]]);assert.equal(await unread(),0,'B 打开瓶子后未读归零');
 assert.equal(await scalar('select content from public.mood_entries where id=$1',[aMood]),'A 的好心情');
 await db.query("select public.add_mood($1,'happy','B 的好心情')",[space]);await login(A);assert.equal(await unread(),1,'B 放入后 A 出现未读');
 await db.query("select public.add_mood($1,'happy','A 再放一条')",[space]);assert.equal(await unread(),1,'A 再放自己的心情不会增加未读');
 // 只标记打开时看到的条目，B 后续新条目保留未读。
 const visible=(await db.query('select id from public.mood_entries where created_by=$1',[B])).rows.map(r=>r.id);
 await login(B);await db.query("select public.add_mood($1,'happy','稍后到达的新心情')",[space]);await login(A);await db.query('select public.read_moods($1,$2::uuid[])',[space,visible]);assert.equal(await unread(),1);
 const item=await scalar('insert into public.shared_items(shared_id,content) values($1,$2) returning id',[space,JSON.stringify({title:'王国之泪',cat:'game'})]);
 assert.equal(await scalar('select count(*)::int from public.item_notifications'),0,'自己不会收到自己的条目消息');
 await login(B);const added=(await db.query('select * from public.item_notifications')).rows[0];assert.equal(added.actor_name,'小甲');assert.equal(added.action,'INSERT');assert.equal(added.item_title,'王国之泪');
 await login(A);await db.query('update public.shared_items set content=$1 where id=$2',[JSON.stringify({title:'王国之泪',cat:'game',score:9}),item]);
 await login(B);assert.equal(await scalar("select count(*)::int from public.item_notifications where action='UPDATE'"),1);
 const messages=(await db.query('select id from public.item_notifications')).rows.map(r=>r.id);await db.query('select public.read_item_notifications($1,$2::uuid[])',[space,messages]);assert.equal(await scalar('select count(*)::int from public.item_notifications where read_at is null'),0);
 // 不能改写消息、伪造动作或给对方写回执。
 await assert.rejects(db.query("insert into public.item_notifications(shared_id) values($1)",[space]),/permission denied/);
 await assert.rejects(db.query('insert into public.mood_reads(mood_id,user_id) values($1,$2)',[aMood,A]),/permission denied/);
 await login(A);await db.query('delete from public.shared_items where id=$1',[item]);await login(B);assert.equal(await scalar("select item_title from public.item_notifications where action='DELETE'"),'王国之泪');
 await login(C);for(const table of ['milestones','mood_entries','mood_reads','item_notifications'])assert.equal(await scalar('select count(*)::int from public.'+table),0,'非成员不能读取 '+table);
 await assert.rejects(db.query("select public.add_mood($1,'happy','越权')",[space]),/共享空间/);
 await assert.rejects(db.query('select public.read_moods($1,$2::uuid[])',[space,[aMood]]),/共享空间/);
 await assert.rejects(db.query("insert into public.milestones(shared_id,title,date) values($1,'越权','2026-01-01')",[space]),/row-level security/);
 await login(A);await assert.rejects(db.query("select public.add_mood($1,'sad','越权空间')",['other-space']),/共享空间/);
 await db.exec(`do $$begin while (select count(*) from public.mood_entries where shared_id='${space}' and kind='happy')<99 loop perform public.add_mood('${space}','happy','容量验收');end loop;end$$;`);
 const concurrent=await Promise.allSettled([db.query("select public.add_mood($1,'happy','最后一条')",[space]),db.query("select public.add_mood($1,'happy','不能超限')",[space])]);assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);assert.equal(await scalar("select count(*)::int from public.mood_entries where kind='happy'"),100);
 await assert.rejects(db.query("insert into public.mood_entries(shared_id,kind,content,created_by) values($1,'happy','绕过限制',$2)",[space,A]),/permission denied/);
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");await db.exec('set role anon');await assert.rejects(db.query('select * from public.mood_entries'),/permission denied/);await assert.rejects(db.query("select public.add_mood($1,'happy','匿名')",[space]),/permission denied/);
 console.log('PASS: PostgreSQL migration idempotence, A/B unread acceptance, own-send exclusion, snapshot receipts, member/anon RLS, 100 cap and automatic INSERT/UPDATE/DELETE messages');
}finally{await db.close();}
