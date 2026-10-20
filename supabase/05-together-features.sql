-- 在 Supabase SQL Editor 执行；要求已有成员方案 B 与 04-shared-profiles.sql。
-- 可重复执行。不重跑 A/B，不修改现有条目或扩大授权。
begin;
do $$begin
 if to_regclass('public.shared_members') is null or to_regclass('public.shared_profiles') is null or to_regprocedure('private.can_access_space(text)') is null then
  raise exception '请先启用成员方案 B，并执行 04-shared-profiles.sql';
 end if;
end$$;

create table if not exists public.milestones (
 id uuid primary key default gen_random_uuid(),
 shared_id text not null,
 title text not null check(char_length(btrim(title)) between 1 and 80),
 date date not null check(date between '1900-01-01' and '2200-12-31'),
 repeat_yearly boolean not null default true,
 is_relationship boolean not null default false,
 created_by uuid default auth.uid() references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create unique index if not exists one_relationship_per_space on public.milestones(shared_id) where is_relationship;
alter table public.milestones enable row level security;
revoke all on public.milestones from public,anon,authenticated;
grant select,delete on public.milestones to authenticated;
grant insert(shared_id,title,date,repeat_yearly,is_relationship) on public.milestones to authenticated;
grant update(title,date,repeat_yearly,is_relationship) on public.milestones to authenticated;
drop policy if exists milestones_select on public.milestones;
drop policy if exists milestones_insert on public.milestones;
drop policy if exists milestones_update on public.milestones;
drop policy if exists milestones_delete on public.milestones;
create policy milestones_select on public.milestones for select to authenticated using(private.can_access_space(shared_id));
create policy milestones_insert on public.milestones for insert to authenticated with check(created_by=auth.uid() and private.can_access_space(shared_id));
create policy milestones_update on public.milestones for update to authenticated using(private.can_access_space(shared_id)) with check(private.can_access_space(shared_id));
create policy milestones_delete on public.milestones for delete to authenticated using(private.can_access_space(shared_id));
-- 纪念日不加入 Realtime publication，前端只读取并计算日期。

create table if not exists public.mood_entries (
 id uuid primary key default gen_random_uuid(),
 shared_id text not null,
 kind text not null check(kind in ('happy','sad')),
 content text not null check(char_length(btrim(content)) between 1 and 1000),
 created_by uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 foreign key(shared_id,created_by) references public.shared_members(shared_id,user_id) on delete cascade
);
create index if not exists mood_entries_space_kind on public.mood_entries(shared_id,kind,created_at desc,id);
create table if not exists public.mood_reads (
 mood_id uuid not null references public.mood_entries(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 read_at timestamptz not null default now(),
 primary key(mood_id,user_id)
);
alter table public.mood_entries enable row level security;
alter table public.mood_reads enable row level security;
revoke all on public.mood_entries,public.mood_reads from public,anon,authenticated;
grant select on public.mood_entries,public.mood_reads to authenticated;
drop policy if exists mood_entries_select on public.mood_entries;
drop policy if exists mood_reads_select on public.mood_reads;
create policy mood_entries_select on public.mood_entries for select to authenticated using(private.can_access_space(shared_id));
create policy mood_reads_select on public.mood_reads for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.mood_entries e where e.id=mood_id and private.can_access_space(e.shared_id)));

-- 仅通过 RPC 添加，数据库锁保证两个人同时添加也不会突破每瓶 100 条上限。
create or replace function public.add_mood(p_shared_id text,p_kind text,p_content text)
returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
 if auth.uid() is null or not private.can_access_space(p_shared_id) then raise exception '请先登录并加入共享空间' using errcode='42501'; end if;
 if p_kind is null or p_kind not in ('happy','sad') then raise exception '心情瓶子类型无效'; end if;
 if p_content is null or char_length(btrim(p_content)) not between 1 and 1000 then raise exception '请填写 1–1000 字的心情'; end if;
 perform pg_advisory_xact_lock(hashtextextended('mood:'||p_shared_id||':'||p_kind,0));
 if (select count(*) from public.mood_entries where shared_id=p_shared_id and kind=p_kind)>=100 then raise exception '这个心情瓶已满（100 条），原有心情会保留'; end if;
 insert into public.mood_entries(shared_id,kind,content,created_by) values(p_shared_id,p_kind,btrim(p_content),auth.uid()) returning id into new_id;
 return new_id;
end;$$;

-- 只标记实际展示的 UUID；打开瓶子期间到达的新心情不会被误标成已读。
create or replace function public.read_moods(p_shared_id text,p_ids uuid[])
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.can_access_space(p_shared_id) then raise exception '请先登录并加入共享空间' using errcode='42501'; end if;
 if coalesce(cardinality(p_ids),0)>100 then raise exception '一次最多标记 100 条心情'; end if;
 insert into public.mood_reads(mood_id,user_id)
 select id,auth.uid() from public.mood_entries where shared_id=p_shared_id and id=any(p_ids) and created_by<>auth.uid()
 on conflict do nothing;
end;$$;

create table if not exists public.item_notifications (
 id uuid primary key default gen_random_uuid(),
 shared_id text not null,
 recipient_id uuid not null,
 actor_id uuid references auth.users(id) on delete set null,
 actor_name text not null,
 action text not null check(action in ('INSERT','UPDATE','DELETE')),
 item_id uuid not null,
 item_title text not null,
 item_cat text not null,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 foreign key(shared_id,recipient_id) references public.shared_members(shared_id,user_id) on delete cascade
);
create index if not exists notifications_recipient on public.item_notifications(shared_id,recipient_id,created_at desc,id);
alter table public.item_notifications enable row level security;
revoke all on public.item_notifications from public,anon,authenticated;
grant select on public.item_notifications to authenticated;
drop policy if exists notifications_select on public.item_notifications;
create policy notifications_select on public.item_notifications for select to authenticated using(recipient_id=auth.uid() and private.can_access_space(shared_id));

-- 触发器与条目变更处于同一事务：前端无权伪造昵称、动作或接收人。
create or replace function private.notify_item_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare space text; item uuid; payload text; value jsonb; actor uuid:=auth.uid(); nick text; item_name text; category text;
begin
 if tg_op='DELETE' then space:=old.shared_id;item:=old.id;payload:=old.content;
 else space:=new.shared_id;item:=new.id;payload:=new.content; end if;
 if tg_op='UPDATE' and new.content is not distinct from old.content then return new; end if;
 -- 管理员维护（无 auth.uid）不冒充任何成员发送消息。
 if actor is null or not private.can_access_space(space) then
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 begin value:=payload::jsonb;exception when invalid_text_representation then value:='{}'::jsonb;end;
 item_name:=left(coalesce(nullif(btrim(value->>'title'),''),'未命名条目'),100);
 category:=coalesce(value->>'cat','film');if category not in ('film','music','game','travel','intimacy') then category:='film';end if;
 select coalesce(nullif(btrim(p.nickname),''),case when m.user_id=(select min(x.user_id::text)::uuid from public.shared_members x where x.shared_id=space) then 'A' else 'B' end)
 into nick from public.shared_members m left join public.shared_profiles p on p.shared_id=m.shared_id and p.user_id=m.user_id
 where m.shared_id=space and m.user_id=actor;
 insert into public.item_notifications(shared_id,recipient_id,actor_id,actor_name,action,item_id,item_title,item_cat)
 select space,m.user_id,actor,coalesce(nick,'对方'),tg_op,item,item_name,category from public.shared_members m where m.shared_id=space and m.user_id<>actor;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
revoke all on function private.notify_item_change() from public,anon,authenticated;
drop trigger if exists shared_item_notification on public.shared_items;
create trigger shared_item_notification after insert or update or delete on public.shared_items for each row execute function private.notify_item_change();

create or replace function public.read_item_notifications(p_shared_id text,p_ids uuid[])
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.can_access_space(p_shared_id) then raise exception '请先登录并加入共享空间' using errcode='42501'; end if;
 if coalesce(cardinality(p_ids),0)>500 then raise exception '一次最多标记 500 条消息'; end if;
 update public.item_notifications set read_at=now() where shared_id=p_shared_id and recipient_id=auth.uid() and id=any(p_ids) and read_at is null;
end;$$;
revoke all on function public.add_mood(text,text,text),public.read_moods(text,uuid[]),public.read_item_notifications(text,uuid[]) from public,anon;
grant execute on function public.add_mood(text,text,text),public.read_moods(text,uuid[]),public.read_item_notifications(text,uuid[]) to authenticated;

-- 仅这三张表实时同步。无需为纪念日开启 Realtime。
do $$
declare tab text;
begin
 foreach tab in array array['mood_entries','mood_reads','item_notifications'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=tab) then
   execute format('alter publication supabase_realtime add table public.%I',tab);
  end if;
 end loop;
end;$$;
notify pgrst,'reload schema';
commit;
