-- 在已经启用成员方案 B 的项目中执行。仅新增个人资料，不修改条目和原有授权。
begin;
create table if not exists public.shared_profiles (
  shared_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null default '' check(char_length(nickname)<=24),
  avatar text not null default '' check(
    char_length(avatar)<=60000 and
    (avatar='' or avatar ~ '^data:image/(jpeg|png|webp);base64,')
  ),
  updated_at timestamptz not null default now(),
  primary key(shared_id,user_id),
  foreign key(shared_id,user_id) references public.shared_members(shared_id,user_id) on delete cascade
);
alter table public.shared_profiles enable row level security;
revoke all on public.shared_profiles from anon,authenticated;
grant select,insert,update on public.shared_profiles to authenticated;
drop policy if exists profiles_select on public.shared_profiles;
drop policy if exists profiles_insert on public.shared_profiles;
drop policy if exists profiles_update on public.shared_profiles;
create policy profiles_select on public.shared_profiles for select to authenticated
using(private.can_access_space(shared_id));
create policy profiles_insert on public.shared_profiles for insert to authenticated
with check(user_id=auth.uid() and private.can_access_space(shared_id));
create policy profiles_update on public.shared_profiles for update to authenticated
using(user_id=auth.uid() and private.can_access_space(shared_id))
with check(user_id=auth.uid() and private.can_access_space(shared_id));

-- 返回当前空间两位成员的显示资料，不返回邮箱或其他账号信息。
-- 按不可变 UUID 排序，确保两个浏览器中的 A/B 顺序一致。
create or replace function public.get_shared_people(p_shared_id text)
returns table(user_id uuid,nickname text,avatar text,updated_at timestamptz)
language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null or not private.can_access_space(p_shared_id) then
    raise exception '请先登录并加入该共享空间' using errcode='42501';
  end if;
  return query
  select m.user_id,coalesce(p.nickname,''),coalesce(p.avatar,''),p.updated_at
  from public.shared_members m
  left join public.shared_profiles p on p.shared_id=m.shared_id and p.user_id=m.user_id
  where m.shared_id=p_shared_id
  order by m.user_id
  limit 2;
end;
$$;
revoke all on function public.get_shared_people(text) from public,anon;
grant execute on function public.get_shared_people(text) to authenticated;
do $$
begin
  if not exists(select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='shared_profiles') then
    alter publication supabase_realtime add table public.shared_profiles;
  end if;
end;
$$;
notify pgrst,'reload schema';
commit;
