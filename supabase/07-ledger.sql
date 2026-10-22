-- 双人账本：在 SQL Editor 完整执行。依赖成员方案 B 和 04 资料表；可重复执行。
-- 所有金额为整数分，RPC 将金额返回为字符串。无浏览器数据库密码，无公开写权限。
begin;
create table if not exists public.ledger_categories (
 id uuid primary key default gen_random_uuid(),shared_id text not null,
 kind text not null check(kind in ('expense','income')),name text not null check(char_length(btrim(name)) between 1 and 40),
 parent_id uuid references public.ledger_categories(id),created_by uuid default auth.uid(),created_at timestamptz not null default now()
);
create unique index if not exists ledger_category_name on public.ledger_categories(shared_id,kind,coalesce(parent_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(name));
create table if not exists public.ledger_entries (
 id uuid primary key,shared_id text not null,kind text not null check(kind in ('expense','income')),
 amount_minor bigint not null check(amount_minor between 1 and 1000000000000),
 scope text not null check(scope in ('shared','personal')),owner_user_id uuid references auth.users(id),
 payer_user_id uuid not null references auth.users(id),split_method text not null check(split_method in ('equal','custom','none')),
 category_id uuid not null references public.ledger_categories(id),subcategory_id uuid references public.ledger_categories(id),
 occurred_on date not null,description text not null check(char_length(btrim(description)) between 1 and 120),
 notes text not null default '' check(char_length(notes)<=2000),payment_method text not null default '' check(payment_method in ('','现金','微信','支付宝','银行卡','信用卡','其他')),
 created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 version integer not null default 1,deleted_at timestamptz,
 check((scope='personal' and owner_user_id is not null and split_method='none') or (scope='shared' and owner_user_id is null and split_method in ('equal','custom')))
);
create index if not exists ledger_space_date on public.ledger_entries(shared_id,occurred_on desc,created_at desc,id) where deleted_at is null;
create table if not exists public.ledger_allocations (
 entry_id uuid not null references public.ledger_entries(id) on delete cascade,user_id uuid not null references auth.users(id),
 amount_minor bigint not null check(amount_minor between 0 and 1000000000000),primary key(entry_id,user_id)
);
create table if not exists public.ledger_receipts (
 entry_id uuid primary key references public.ledger_entries(id) on delete cascade,object_key text not null check(char_length(object_key) between 1 and 500),uploaded_by uuid not null references auth.users(id)
);
-- 重试请求在私有表保存，防止网络重试重复记账；客户端没有读写权限。
create table if not exists private.ledger_mutations (
 user_id uuid not null,request_id uuid not null,shared_id text not null,payload jsonb not null,result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,request_id)
);
revoke all on private.ledger_mutations from public,anon,authenticated;
alter table private.ledger_mutations enable row level security;
do $$declare tab text;begin
 foreach tab in array array['ledger_entries','ledger_categories','ledger_allocations','ledger_receipts'] loop
  execute format('alter table public.%I enable row level security',tab);
  execute format('revoke all on public.%I from public,anon,authenticated',tab);
  execute format('grant select on public.%I to authenticated',tab);
 end loop;
end$$;
drop policy if exists ledger_entries_read on public.ledger_entries;
create policy ledger_entries_read on public.ledger_entries for select to authenticated using(private.can_access_space(shared_id));
drop policy if exists ledger_categories_read on public.ledger_categories;
create policy ledger_categories_read on public.ledger_categories for select to authenticated using(private.can_access_space(shared_id));
drop policy if exists ledger_allocations_read on public.ledger_allocations;
create policy ledger_allocations_read on public.ledger_allocations for select to authenticated using(exists(select 1 from public.ledger_entries e where e.id=entry_id and private.can_access_space(e.shared_id)));
drop policy if exists ledger_receipts_read on public.ledger_receipts;
create policy ledger_receipts_read on public.ledger_receipts for select to authenticated using(exists(select 1 from public.ledger_entries e where e.id=entry_id and e.deleted_at is null and private.can_access_space(e.shared_id)));

create or replace function private.ledger_require(p_space text) returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or not private.can_access_space(p_space) then raise exception '请先登录并加入共享空间' using errcode='42501';end if;
end$$;
create or replace function public.ledger_add_category(p_space text,p_kind text,p_name text,p_parent uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$declare result uuid;begin
 perform private.ledger_require(p_space);
 if p_kind is null or p_kind not in ('expense','income') or p_name is null or char_length(btrim(p_name)) not between 1 and 40 then raise exception '请填写有效的分类名称和收支类型';end if;
 if p_parent is not null and not exists(select 1 from public.ledger_categories where id=p_parent and shared_id=p_space and kind=p_kind and parent_id is null) then raise exception '二级分类必须属于当前空间和收支类型的一级分类';end if;
 insert into public.ledger_categories(shared_id,kind,name,parent_id) values(p_space,p_kind,btrim(p_name),p_parent) on conflict do nothing returning id into result;
 if result is null then select id into result from public.ledger_categories where shared_id=p_space and kind=p_kind and lower(name)=lower(btrim(p_name)) and parent_id is not distinct from p_parent;end if;
 return result;
end$$;
create or replace function public.ledger_bootstrap(p_space text) returns jsonb language plpgsql security definer set search_path='' as $$declare n text;begin
 perform private.ledger_require(p_space);
 foreach n in array array['餐饮','购物','交通','住房','旅行','医疗','娱乐','其他支出'] loop perform public.ledger_add_category(p_space,'expense',n);end loop;
 foreach n in array array['工资','奖金','理财收益','礼金','其他收入'] loop perform public.ledger_add_category(p_space,'income',n);end loop;
 return jsonb_build_object('people',(select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'nickname',coalesce(nullif(p.nickname,''),'成员')) order by m.user_id), '[]') from public.shared_members m left join public.shared_profiles p on p.shared_id=m.shared_id and p.user_id=m.user_id where m.shared_id=p_space),
 'categories',(select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at,c.id),'[]') from public.ledger_categories c where c.shared_id=p_space));
end$$;

create or replace function public.ledger_save(p_space text,p_id uuid,p_expected_version integer,p_request_id uuid,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
<<entry_values>>
declare oldrow public.ledger_entries%rowtype; members uuid[]; amount bigint; who uuid; payer uuid; cat uuid; subcat uuid; day date; mode text; scope text; kind text; shares jsonb; receipt text; result jsonb; prior private.ledger_mutations%rowtype; signature jsonb;
begin
 perform private.ledger_require(p_space);
 if p_id is null or p_request_id is null or p_expected_version is null or p_data is null then raise exception '缺少记录标识或版本';end if;
 signature:=jsonb_build_object('id',p_id,'version',p_expected_version,'data',p_data);
 perform pg_advisory_xact_lock(hashtextextended('ledger:'||auth.uid()::text||':'||p_request_id::text,0));
 select * into prior from private.ledger_mutations where user_id=auth.uid() and request_id=p_request_id;
 if found then
  if prior.shared_id<>p_space or prior.payload<>signature then raise exception '请求内容已变化，请重新保存';end if;
  return prior.result;
 end if;
 -- 与邀请加入使用同一空间锁，保证两位参与人的快照在事务内一致。
 perform pg_advisory_xact_lock(hashtextextended(p_space,0));
 select array_agg(user_id order by user_id) into members from public.shared_members where shared_id=p_space;
 if coalesce(cardinality(members),0)<>2 then raise exception '双人账本需要共享空间中有两位成员';end if;
 select * into oldrow from public.ledger_entries where id=p_id for update;
 if found then
  if oldrow.shared_id<>p_space or oldrow.created_by<>auth.uid() then raise exception '只能编辑自己创建的账目' using errcode='42501';end if;
  if oldrow.deleted_at is not null or oldrow.version<>p_expected_version then raise exception '账目已被修改或删除，请刷新后重试';end if;
 elsif p_expected_version<>0 then raise exception '账目不存在或已被删除';end if;
 if coalesce(p_data->>'amount_minor','') !~ '^[0-9]{1,13}$' then raise exception '金额必须为大于零的整数分';end if;
 amount:=(p_data->>'amount_minor')::bigint;
 if amount not between 1 and 1000000000000 then raise exception '金额须大于零且不超过 100 亿元';end if;
 kind:=p_data->>'kind';scope:=p_data->>'scope';payer:=(p_data->>'payer_user_id')::uuid;cat:=(p_data->>'category_id')::uuid;subcat:=nullif(p_data->>'subcategory_id','')::uuid;
 if kind is null or kind not in ('expense','income') or scope is null or scope not in ('shared','personal') or payer is null or not(payer=any(members)) then raise exception '收支类型、消费性质或付款/收款人无效';end if;
 if not exists(select 1 from public.ledger_categories where id=cat and shared_id=p_space and parent_id is null and ledger_categories.kind=kind) then raise exception '请选择对应收支类型的一级分类';end if;
 if subcat is not null and not exists(select 1 from public.ledger_categories where id=subcat and shared_id=p_space and parent_id=cat and ledger_categories.kind=kind) then raise exception '二级分类不属于当前一级分类';end if;
 if coalesce(p_data->>'occurred_on','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception '请填写有效发生日期';end if;
 day:=(p_data->>'occurred_on')::date;
 if day<'1900-01-01' or day>(now() at time zone 'Asia/Shanghai')::date then raise exception '发生日期应为今天或过去日期';end if;
 if char_length(btrim(coalesce(p_data->>'description',''))) not between 1 and 120 or char_length(coalesce(p_data->>'notes',''))>2000 then raise exception '请填写 1–120 字说明，备注最多 2000 字';end if;
 if coalesce(p_data->>'payment_method','') not in ('','现金','微信','支付宝','银行卡','信用卡','其他') then raise exception '支付方式无效';end if;
 if scope='personal' then
  who:=(p_data->>'owner_user_id')::uuid;mode:='none';
  if who is null or not(who=any(members)) then raise exception '各自消费必须指定属于哪位成员';end if;
  shares:=jsonb_build_array(jsonb_build_object('user_id',who,'amount_minor',amount::text));
 else
  who:=null;mode:=p_data->>'split_method';
  if mode='equal' then
   shares:=jsonb_build_array(jsonb_build_object('user_id',members[1],'amount_minor',((amount+1)/2)::text),jsonb_build_object('user_id',members[2],'amount_minor',(amount/2)::text));
  elsif mode='custom' then
   shares:=p_data->'allocations';
   if jsonb_typeof(shares) is distinct from 'array' then raise exception '请填写两人的分摊金额';end if;
   if jsonb_array_length(shares)<>2 then raise exception '请填写两人的分摊金额';end if;
   if exists(select 1 from jsonb_array_elements(shares) s where coalesce(s->>'amount_minor','') !~ '^[0-9]{1,13}$' or not(coalesce(s->>'user_id','')=any(members::text[]))) then raise exception '分摊金额或成员无效';end if;
   if (select count(distinct s->>'user_id') from jsonb_array_elements(shares) s)<>2 or (select sum((s->>'amount_minor')::numeric) from jsonb_array_elements(shares) s)<>amount then raise exception '两人的分摊金额合计必须等于总金额';end if;
  else raise exception '请选择共同消费的分摊方式';end if;
 end if;
 receipt:=nullif(p_data->>'receipt_key','');
 if receipt is not null and (char_length(receipt)>500 or left(receipt,char_length('ledger/'||p_space||'/'||auth.uid()::text||'/'||p_id::text||'/'))<>'ledger/'||p_space||'/'||auth.uid()::text||'/'||p_id::text||'/' or receipt !~ '/[a-f0-9-]{36}\.jpg$') then raise exception '凭证不属于当前记录或创建人';end if;
 if oldrow.id is null then
  insert into public.ledger_entries(id,shared_id,kind,amount_minor,scope,owner_user_id,payer_user_id,split_method,category_id,subcategory_id,occurred_on,description,notes,payment_method)
  values(p_id,p_space,kind,amount,scope,who,payer,mode,cat,subcat,day,btrim(p_data->>'description'),coalesce(p_data->>'notes',''),coalesce(p_data->>'payment_method',''));
 else
  update public.ledger_entries set kind=entry_values.kind,amount_minor=amount,scope=entry_values.scope,owner_user_id=who,payer_user_id=payer,split_method=mode,category_id=cat,subcategory_id=subcat,occurred_on=day,description=btrim(p_data->>'description'),notes=coalesce(p_data->>'notes',''),payment_method=coalesce(p_data->>'payment_method',''),updated_at=now(),version=version+1 where id=p_id;
 end if;
 delete from public.ledger_allocations where entry_id=p_id;
 insert into public.ledger_allocations(entry_id,user_id,amount_minor) select p_id,(s->>'user_id')::uuid,(s->>'amount_minor')::bigint from jsonb_array_elements(shares) s;
 delete from public.ledger_receipts where entry_id=p_id;
 if receipt is not null then insert into public.ledger_receipts values(p_id,receipt,auth.uid());end if;
 select jsonb_build_object('id',id,'version',version) into result from public.ledger_entries where id=p_id;
 insert into private.ledger_mutations(user_id,request_id,shared_id,payload,result) values(auth.uid(),p_request_id,p_space,signature,result);
 return result;
end$$;

create or replace function public.ledger_delete(p_space text,p_id uuid,p_expected_version integer) returns void language plpgsql security definer set search_path='' as $$declare e public.ledger_entries%rowtype;begin
 perform private.ledger_require(p_space);select * into e from public.ledger_entries where id=p_id and shared_id=p_space for update;
 if not found or e.created_by<>auth.uid() then raise exception '只能删除自己创建的账目' using errcode='42501';end if;
 if e.deleted_at is not null then return;end if;
 if e.version<>p_expected_version then raise exception '账目已被修改，请刷新后重试';end if;
 update public.ledger_entries set deleted_at=now(),updated_at=now(),version=version+1 where id=p_id;
end$$;
create or replace function private.ledger_selected(p_space text,p_filters jsonb) returns setof public.ledger_entries language sql stable set search_path='' as $$
 select e.* from public.ledger_entries e where e.shared_id=p_space and e.deleted_at is null
 and (nullif(p_filters->>'from','') is null or e.occurred_on>=(p_filters->>'from')::date)
 and (nullif(p_filters->>'to','') is null or e.occurred_on<(p_filters->>'to')::date)
 and (nullif(p_filters->>'kind','') is null or e.kind=p_filters->>'kind')
 and (nullif(p_filters->>'scope','') is null or e.scope=p_filters->>'scope')
 and (nullif(p_filters->>'category_id','') is null or e.category_id=(p_filters->>'category_id')::uuid)
 and (nullif(p_filters->>'payer_user_id','') is null or e.payer_user_id=(p_filters->>'payer_user_id')::uuid)
 and (nullif(btrim(p_filters->>'query'),'') is null or strpos(lower(e.description||' '||e.notes),lower(btrim(p_filters->>'query')))>0)
$$;
create or replace function private.ledger_row(e public.ledger_entries) returns jsonb language sql stable set search_path='' as $$
 select to_jsonb(e)||jsonb_build_object('amount_minor',e.amount_minor::text,'allocations',(select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'amount_minor',a.amount_minor::text) order by a.user_id),'[]') from public.ledger_allocations a where a.entry_id=e.id),'receipt_key',(select object_key from public.ledger_receipts where entry_id=e.id),'category_name',(select name from public.ledger_categories where id=e.category_id),'subcategory_name',(select name from public.ledger_categories where id=e.subcategory_id))
$$;
create or replace function private.ledger_totals(p_space text,p_filters jsonb) returns jsonb language sql stable set search_path='' as $$
 with selected as materialized (select * from private.ledger_selected(p_space,p_filters)),
 totals as (select coalesce(sum(amount_minor) filter(where kind='income'),0) inc,coalesce(sum(amount_minor) filter(where kind='expense'),0) exp,count(*) cnt from selected),
 scopes as (select x.scope,coalesce(sum(s.amount_minor) filter(where kind='income'),0) inc,coalesce(sum(s.amount_minor) filter(where kind='expense'),0) exp from (values('shared'),('personal')) x(scope) left join selected s on s.scope=x.scope group by x.scope),
 people_ids as (select user_id from public.shared_members where shared_id=p_space union select a.user_id from public.ledger_allocations a join selected s on s.id=a.entry_id union select payer_user_id from selected),
 people as (select u.user_id,(select coalesce(sum(a.amount_minor),0)::text from public.ledger_allocations a join selected s on s.id=a.entry_id where a.user_id=u.user_id and s.kind='expense') expense,(select coalesce(sum(a.amount_minor),0)::text from public.ledger_allocations a join selected s on s.id=a.entry_id where a.user_id=u.user_id and s.kind='income') income,(select coalesce(sum(amount_minor),0)::text from selected where payer_user_id=u.user_id and kind='expense') paid,(select coalesce(sum(amount_minor),0)::text from selected where payer_user_id=u.user_id and kind='income') received from people_ids u),
 cats as (select s.kind,c.id,c.name,sum(s.amount_minor)::text amount,count(*) count from selected s join public.ledger_categories c on c.id=s.category_id group by s.kind,c.id,c.name),
 months as (select to_char(occurred_on,'YYYY-MM') as "month",coalesce(sum(amount_minor) filter(where kind='income'),0)::text income,coalesce(sum(amount_minor) filter(where kind='expense'),0)::text expense from selected group by 1)
 select jsonb_build_object('income',inc::text,'expense',exp::text,'net',(inc-exp)::text,'count',cnt,
 'scopes',(select jsonb_object_agg(scope,jsonb_build_object('income',inc::text,'expense',exp::text,'net',(inc-exp)::text)) from scopes),
 'people',(select coalesce(jsonb_agg(to_jsonb(p) order by user_id),'[]') from people p),
 'categories',(select coalesce(jsonb_agg(to_jsonb(c) order by amount::numeric desc,c.id),'[]') from cats c),
 'months',(select coalesce(jsonb_agg(to_jsonb(m) order by m."month"),'[]') from months m)) from totals
$$;
create or replace function public.ledger_list(p_space text,p_filters jsonb default '{}',p_offset integer default 0,p_limit integer default 50) returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform private.ledger_require(p_space);
 if p_offset is null or p_limit is null or p_offset<0 or p_limit not between 1 and 100 then raise exception '分页参数无效';end if;
 return jsonb_build_object('summary',private.ledger_totals(p_space,p_filters),'entries',(select coalesce(jsonb_agg(private.ledger_row(s) order by s.occurred_on desc,s.created_at desc,s.id desc),'[]') from (select * from private.ledger_selected(p_space,p_filters) order by occurred_on desc,created_at desc,id desc offset p_offset limit p_limit) s));
end$$;
create or replace function public.ledger_report(p_space text,p_year integer,p_month integer default null) returns jsonb language plpgsql security definer set search_path='' as $$declare first_day date;last_day date;begin
 perform private.ledger_require(p_space);
 if p_year is null or p_year not between 1900 and 2200 or (p_month is not null and p_month not between 1 and 12) then raise exception '报表年月无效';end if;
 first_day:=make_date(p_year,coalesce(p_month,1),1);last_day:=(first_day+case when p_month is null then interval '1 year' else interval '1 month' end)::date;
 return jsonb_build_object('current',private.ledger_totals(p_space,jsonb_build_object('from',first_day,'to',last_day)),
 'previous',case when p_month is not null then private.ledger_totals(p_space,jsonb_build_object('from',(first_day-interval '1 month')::date,'to',first_day)) else null end);
end$$;
create or replace function public.ledger_receipt_access(p_space text,p_id uuid,p_mode text) returns jsonb language plpgsql security definer set search_path='' as $$declare e public.ledger_entries%rowtype;key text;begin
 perform private.ledger_require(p_space);select * into e from public.ledger_entries where id=p_id;
 if p_mode='upload' then
  if e.id is not null and (e.shared_id<>p_space or e.created_by<>auth.uid() or e.deleted_at is not null) then raise exception '只能上传自己账目的凭证' using errcode='42501';end if;
  return jsonb_build_object('prefix','ledger/'||p_space||'/'||auth.uid()::text||'/'||p_id::text||'/');
 elsif p_mode='read' then
  if e.id is null or e.shared_id<>p_space or e.deleted_at is not null then raise exception '凭证不存在或账目已删除' using errcode='42501';end if;
  select object_key into key from public.ledger_receipts where entry_id=p_id;
  if key is null then raise exception '这笔账没有凭证';end if;
  return jsonb_build_object('objectKey',key);
 end if;
 raise exception '凭证操作无效';
end$$;
-- 收紧全部函数权限；私有辅助函数不可从客户端直接调用。
do $$declare f record;begin
 for f in select p.oid::regprocedure signature,n.nspname schema from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname like 'ledger_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  if f.schema='public' then execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ledger_entries') then alter publication supabase_realtime add table public.ledger_entries;end if;
end$$;
notify pgrst,'reload schema';
commit;
