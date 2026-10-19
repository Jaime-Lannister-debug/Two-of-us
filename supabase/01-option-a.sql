begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.shared_items (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  shared_id text not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists shared_items_space_time_idx
  on public.shared_items(shared_id, created_at, id);
alter table public.shared_items enable row level security;
revoke all on public.shared_items from anon, authenticated;
grant select, insert, delete on public.shared_items to authenticated;

-- 方案 A：必须在控制台关闭公开注册，仅保留手动创建的两个账号。
-- 该函数不能单独区分两个账号；方案 B 会将其替换为成员检查。
create or replace function private.can_access_space(p_shared_id text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and p_shared_id = 'our-shared-space';
$$;
revoke all on function private.can_access_space(text) from public, anon;
grant execute on function private.can_access_space(text) to authenticated;

-- 清理本表旧策略，避免旧 permissive 策略以 OR 放宽访问。
do $$
declare p record;
begin
  for p in select policyname from pg_policies
    where schemaname='public' and tablename='shared_items'
  loop
    execute format('drop policy %I on public.shared_items', p.policyname);
  end loop;
end;
$$;
create policy shared_items_select on public.shared_items
for select to authenticated
using (private.can_access_space(shared_id));
create policy shared_items_insert on public.shared_items
for insert to authenticated
with check (private.can_access_space(shared_id) and created_by=auth.uid());
create policy shared_items_delete on public.shared_items
for delete to authenticated
using (private.can_access_space(shared_id));

-- 虽然沿用旧 RPC 名称，但改为 UPDATE：id、创建者、创建时间均不变化。
-- SECURITY DEFINER 可能绕过 RLS，必须在函数体中显式鉴权。
create or replace function public.replace_shared_item(
  p_id uuid, p_content text, p_expected_content text
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare previous public.shared_items%rowtype;
begin
  if auth.uid() is null then
    raise exception '请先登录' using errcode='42501';
  end if;
  if p_content is null or p_expected_content is null then
    raise exception '记录内容或原始版本不能为空';
  end if;
  select * into previous from public.shared_items
  where id=p_id for update;
  if not found then
    raise exception '记录已被修改或删除，请刷新后重试';
  end if;
  if not private.can_access_space(previous.shared_id) then
    raise exception '没有该共享空间的访问权限' using errcode='42501';
  end if;
  if previous.content is distinct from p_expected_content then
    raise exception '记录已被修改，请刷新列表后重新编辑';
  end if;
  update public.shared_items set content=p_content where id=p_id;
  return p_id;
end;
$$;
revoke all on function public.replace_shared_item(uuid,text,text)
  from public, anon;
grant execute on function public.replace_shared_item(uuid,text,text)
  to authenticated;

-- 控制台 Database → Replication / Publications → supabase_realtime
-- 必须勾选 shared_items。下方 SQL 等价启用，不需要重复手动添加。
do $$
begin
  if not exists(select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public'
      and tablename='shared_items') then
    alter publication supabase_realtime add table public.shared_items;
  end if;
end;
$$;
notify pgrst, 'reload schema';
commit;
