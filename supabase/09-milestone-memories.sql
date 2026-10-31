-- Supabase SQL Editor 完整执行；依赖成员方案 B、04 和 05。可重复执行，不重跑旧迁移。
begin;
create table if not exists public.milestone_memories (
 id uuid primary key default gen_random_uuid(),
 shared_id text not null,
 milestone_id uuid not null references public.milestones(id) on delete cascade,
 occurred_on date not null check(occurred_on between '1900-01-01' and '2200-12-31'),
 activity text not null check(char_length(btrim(activity)) between 1 and 2000),
 reflection text not null default '' check(char_length(reflection)<=5000),
 photos jsonb not null default '[]' check(jsonb_typeof(photos)='array' and jsonb_array_length(photos)<=5),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version integer not null default 1,
 deleted_at timestamptz
);
create index if not exists milestone_memories_parent on public.milestone_memories(shared_id,milestone_id,occurred_on desc,id);
alter table public.milestone_memories enable row level security;
revoke all on public.milestone_memories from public,anon,authenticated;
grant select on public.milestone_memories to authenticated;
drop policy if exists milestone_memories_read on public.milestone_memories;
-- 软删除行仍可授权 UPDATE 事件；正常查询排除 deleted_at。
create policy milestone_memories_read on public.milestone_memories for select to authenticated using (
 private.can_access_space(shared_id) and exists(select 1 from public.milestones m where m.id=milestone_id and m.shared_id=milestone_memories.shared_id)
);
create or replace function public.save_milestone_memory(p_space text,p_milestone uuid,p_id uuid,p_version integer,p_day date,p_activity text,p_reflection text,p_photos jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare oldrow public.milestone_memories%rowtype; result jsonb;
begin
 if auth.uid() is null or not private.can_access_space(p_space) then raise exception '请先登录并加入共享空间' using errcode='42501';end if;
 -- 锁父记录，避免保存和删除纪念日交错；不允许跨空间关联。
 perform 1 from public.milestones where id=p_milestone and shared_id=p_space for update;
 if not found then raise exception '纪念日已删除或没有访问权限';end if;
 if p_id is null or p_version is null or p_version<0 or p_day is null or p_day<'1900-01-01' or p_day>(now() at time zone 'Asia/Shanghai')::date then raise exception '请填写今天或过去的有效日期';end if;
 if char_length(btrim(coalesce(p_activity,''))) not between 1 and 2000 or char_length(coalesce(p_reflection,''))>5000 then raise exception '活动须填写 1–2000 字，感想最多 5000 字';end if;
 if jsonb_typeof(p_photos) is distinct from 'array' then raise exception '照片格式无效';end if;
 if jsonb_array_length(p_photos)>5 then raise exception '每条纪念记录最多上传 5 张照片';end if;
 if exists(select 1 from jsonb_array_elements(p_photos) x where jsonb_typeof(x)<>'string' or char_length(x#>>'{}')>2048 or (x#>>'{}') !~ '^https://[^[:space:]<>"\\]+$') then raise exception '照片必须为有效的 HTTPS 图片地址';end if;
 if (select count(distinct x) from jsonb_array_elements(p_photos) x)<>jsonb_array_length(p_photos) then raise exception '请移除重复照片';end if;
 select * into oldrow from public.milestone_memories where id=p_id for update;
 if found then
  if oldrow.created_by<>auth.uid() or oldrow.shared_id<>p_space or oldrow.milestone_id<>p_milestone then raise exception '只能修改自己创建的纪念记录' using errcode='42501';end if;
  -- 同一新记录请求重试不会重复插入，内容不同则拒绝旧版本覆盖。
  if p_version=0 and oldrow.deleted_at is null and oldrow.occurred_on=p_day and oldrow.activity=btrim(p_activity) and oldrow.reflection=coalesce(p_reflection,'') and oldrow.photos=p_photos then return jsonb_build_object('id',oldrow.id,'version',oldrow.version);end if;
  if oldrow.deleted_at is not null or oldrow.version<>p_version then raise exception '纪念记录已被修改或删除，请刷新后重新编辑';end if;
  update public.milestone_memories set occurred_on=p_day,activity=btrim(p_activity),reflection=coalesce(p_reflection,''),photos=p_photos,updated_at=now(),version=version+1 where id=p_id;
 else
  if p_version<>0 then raise exception '纪念记录已不存在，请刷新';end if;
  insert into public.milestone_memories(id,shared_id,milestone_id,occurred_on,activity,reflection,photos) values(p_id,p_space,p_milestone,p_day,btrim(p_activity),coalesce(p_reflection,''),p_photos);
 end if;
 select jsonb_build_object('id',id,'version',version) into result from public.milestone_memories where id=p_id;
 return result;
end$$;
create or replace function public.delete_milestone_memory(p_space text,p_id uuid,p_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare e public.milestone_memories%rowtype;
begin
 if auth.uid() is null or not private.can_access_space(p_space) then raise exception '请先登录并加入共享空间' using errcode='42501';end if;
 select * into e from public.milestone_memories where id=p_id for update;
 if not found or e.shared_id<>p_space or e.created_by<>auth.uid() then raise exception '只能删除自己创建的纪念记录' using errcode='42501';end if;
 if e.deleted_at is not null then return;end if;
 if p_version is null or e.version<>p_version then raise exception '纪念记录已被修改，请刷新后重试';end if;
 update public.milestone_memories set deleted_at=now(),updated_at=now(),version=version+1 where id=p_id;
end$$;
revoke all on function public.save_milestone_memory(text,uuid,uuid,integer,date,text,text,jsonb),public.delete_milestone_memory(text,uuid,integer) from public,anon;
grant execute on function public.save_milestone_memory(text,uuid,uuid,integer,date,text,text,jsonb),public.delete_milestone_memory(text,uuid,integer) to authenticated;
do $$begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='milestone_memories') then alter publication supabase_realtime add table public.milestone_memories;end if;
end$$;
notify pgrst,'reload schema';
commit;
