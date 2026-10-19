-- 先执行 01-option-a.sql，再执行本脚本；本脚本在同一事务内切换授权。
begin;
create table if not exists public.shared_members (
  shared_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key(shared_id,user_id)
);
alter table public.shared_members enable row level security;
revoke all on public.shared_members from anon, authenticated;
grant select on public.shared_members to authenticated;
drop policy if exists own_membership on public.shared_members;
create policy own_membership on public.shared_members
for select to authenticated using(user_id=auth.uid());

-- 成员表不允许前端直接 INSERT/UPDATE/DELETE，避免自行加入任意空间。
create or replace function private.can_access_space(p_shared_id text)
returns boolean language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.shared_members
    where shared_id=p_shared_id and user_id=auth.uid()
  );
$$;
revoke all on function private.can_access_space(text) from public,anon;
grant execute on function private.can_access_space(text) to authenticated;

-- 邀请码仅存 SHA-256 摘要；原文只在创建时返回一次。
create table if not exists private.shared_invites (
  token_hash text primary key,
  shared_id text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);
alter table private.shared_invites enable row level security;
revoke all on private.shared_invites from public,anon,authenticated;

create or replace function public.create_shared_invite(p_shared_id text)
returns text language plpgsql security definer set search_path=''
as $$
declare token text;
begin
  if auth.uid() is null then
    raise exception '请先登录' using errcode='42501';
  end if;
  if not private.can_access_space(p_shared_id) then
    raise exception '只有空间成员才能创建邀请码' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_shared_id,0));
  if (select count(*) from public.shared_members where shared_id=p_shared_id)>=2 then
    raise exception '该空间已有两位成员';
  end if;
  -- 限制未使用邀请数量，避免无限生成；不对外提供验证码猜测接口。
  if (select count(*) from private.shared_invites
      where shared_id=p_shared_id and used_at is null and expires_at>now())>=5 then
    raise exception '已有有效邀请码，请先使用或等待其过期';
  end if;
  token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  insert into private.shared_invites(token_hash,shared_id,created_by,expires_at)
  values(encode(sha256(convert_to(token,'UTF8')),'hex'),p_shared_id,auth.uid(),now()+interval '24 hours');
  return token;
end;
$$;

create or replace function public.join_shared_space(p_token text)
returns text language plpgsql security definer set search_path=''
as $$
declare invitation private.shared_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception '请先登录' using errcode='42501';
  end if;
  if p_token is null or length(p_token)<>64 then
    raise exception '邀请码无效或已过期';
  end if;
  select * into invitation from private.shared_invites
  where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
  if not found then raise exception '邀请码无效或已过期'; end if;
  if invitation.used_at is not null or invitation.expires_at<=now() then
    raise exception '邀请码无效或已过期';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(invitation.shared_id,0));
  -- 邀请者已失去成员资格时，旧邀请码也不再有效。
  if not exists(select 1 from public.shared_members
    where shared_id=invitation.shared_id and user_id=invitation.created_by) then
    raise exception '邀请码无效或已过期';
  end if;
  if exists(select 1 from public.shared_members
    where shared_id=invitation.shared_id and user_id=auth.uid()) then
    raise exception '你已经是该空间成员';
  end if;
  if (select count(*) from public.shared_members
      where shared_id=invitation.shared_id)>=2 then
    raise exception '该空间已有两位成员';
  end if;
  insert into public.shared_members(shared_id,user_id)
  values(invitation.shared_id,auth.uid());
  update private.shared_invites set used_at=now()
  where token_hash=invitation.token_hash;
  return invitation.shared_id;
end;
$$;
revoke all on function public.create_shared_invite(text) from public,anon;
revoke all on function public.join_shared_space(text) from public,anon;
grant execute on function public.create_shared_invite(text) to authenticated;
grant execute on function public.join_shared_space(text) to authenticated;
notify pgrst,'reload schema';
commit;
