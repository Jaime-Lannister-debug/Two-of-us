-- Supabase → SQL Editor → New query，完整执行一次；可重复执行。
-- 依赖 05；不改变成员/RLS，不订阅 milestones，不补发历史操作。
begin;
do $$begin
 if to_regclass('public.milestones') is null or to_regclass('public.item_notifications') is null or to_regprocedure('private.can_access_space(text)') is null then
  raise exception '请先完整执行 05-together-features.sql';
 end if;
end$$;
create or replace function private.notify_milestone_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare space text; item uuid; title text; actor uuid:=auth.uid(); nick text;
begin
 if tg_op='DELETE' then space:=old.shared_id; item:=old.id; title:=old.title;
 else space:=new.shared_id; item:=new.id; title:=new.title; end if;
 if tg_op='UPDATE' and row(new.title,new.date,new.repeat_yearly,new.is_relationship) is not distinct from row(old.title,old.date,old.repeat_yearly,old.is_relationship) then return new; end if;
 -- 管理员维护不冒充用户，非成员不能发送提醒；操作账号由 JWT 获取。
 if actor is null or not private.can_access_space(space) then
  if tg_op='DELETE' then return old; else return new; end if;
 end if;
 select coalesce(nullif(btrim(p.nickname),''),case when m.user_id=(select min(x.user_id::text)::uuid from public.shared_members x where x.shared_id=space) then 'A' else 'B' end)
 into nick from public.shared_members m left join public.shared_profiles p on p.shared_id=m.shared_id and p.user_id=m.user_id
 where m.shared_id=space and m.user_id=actor;
 -- 沿用消息表/已读 RPC/接收人 RLS。item_id 不依赖外键，删除后仍保留当时的标题。
 insert into public.item_notifications(shared_id,recipient_id,actor_id,actor_name,action,item_id,item_title,item_cat)
 select space,m.user_id,actor,coalesce(nick,'对方'),tg_op,item,left(title,100),'milestone'
 from public.shared_members m where m.shared_id=space and m.user_id<>actor;
 if tg_op='DELETE' then return old; else return new; end if;
end;$$;
revoke all on function private.notify_milestone_change() from public,anon,authenticated;
drop trigger if exists milestone_notification on public.milestones;
create trigger milestone_notification after insert or update or delete on public.milestones for each row execute function private.notify_milestone_change();
-- item_notifications 已在 05 加入 publication。这里幂等检查，确保对方页面能收到提醒。
do $$begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='item_notifications') then
  alter publication supabase_realtime add table public.item_notifications;
 end if;
end$$;
notify pgrst,'reload schema';
commit;
