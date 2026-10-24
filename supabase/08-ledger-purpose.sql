-- 在 Supabase SQL Editor 完整执行；依赖 07，可重复执行。不重跑旧迁移。
-- 用途与分摊性质独立；历史数据保持 NULL（未分类），不改金额、分配或凭证。
begin;
alter table public.ledger_entries add column if not exists purpose text;
alter table public.ledger_entries drop constraint if exists ledger_entries_purpose_check;
alter table public.ledger_entries add constraint ledger_entries_purpose_check check (purpose is null or purpose in ('self','romance'));
create or replace function public.ledger_bootstrap(p_space text) returns jsonb language plpgsql security definer set search_path='' as $$declare n text;begin
 perform private.ledger_require(p_space);
 foreach n in array array['餐饮','购物','交通','住房','旅行','医疗','娱乐','其他支出'] loop perform public.ledger_add_category(p_space,'expense',n);end loop;
 foreach n in array array['工资','奖金','理财收益','礼金','其他收入'] loop perform public.ledger_add_category(p_space,'income',n);end loop;
 return jsonb_build_object('purpose_enabled',true,'people',(select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'nickname',coalesce(nullif(p.nickname,''),'成员')) order by m.user_id), '[]') from public.shared_members m left join public.shared_profiles p on p.shared_id=m.shared_id and p.user_id=m.user_id where m.shared_id=p_space),
 'categories',(select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at,c.id),'[]') from public.ledger_categories c where c.shared_id=p_space));
end$$;

create or replace function public.ledger_save(p_space text,p_id uuid,p_expected_version integer,p_request_id uuid,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
<<entry_values>>
declare oldrow public.ledger_entries%rowtype; members uuid[]; amount bigint; who uuid; payer uuid; cat uuid; subcat uuid; day date; mode text; scope text; purpose text; kind text; shares jsonb; receipt text; result jsonb; prior private.ledger_mutations%rowtype; signature jsonb;
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
 purpose:=nullif(p_data->>'purpose','');
 if purpose is null then
  -- 兼容仍开着旧网页的客户端：新记录留空，编辑保留原用途。
  purpose:=oldrow.purpose;
 elsif purpose not in ('self','romance') then raise exception '消费用途必须为自己消费或恋爱消费';end if;
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
  insert into public.ledger_entries(id,shared_id,kind,amount_minor,scope,purpose,owner_user_id,payer_user_id,split_method,category_id,subcategory_id,occurred_on,description,notes,payment_method)
  values(p_id,p_space,kind,amount,scope,purpose,who,payer,mode,cat,subcat,day,btrim(p_data->>'description'),coalesce(p_data->>'notes',''),coalesce(p_data->>'payment_method',''));
 else
  update public.ledger_entries set kind=entry_values.kind,amount_minor=amount,scope=entry_values.scope,purpose=entry_values.purpose,owner_user_id=who,payer_user_id=payer,split_method=mode,category_id=cat,subcategory_id=subcat,occurred_on=day,description=btrim(p_data->>'description'),notes=coalesce(p_data->>'notes',''),payment_method=coalesce(p_data->>'payment_method',''),updated_at=now(),version=version+1 where id=p_id;
 end if;
 delete from public.ledger_allocations where entry_id=p_id;
 insert into public.ledger_allocations(entry_id,user_id,amount_minor) select p_id,(s->>'user_id')::uuid,(s->>'amount_minor')::bigint from jsonb_array_elements(shares) s;
 delete from public.ledger_receipts where entry_id=p_id;
 if receipt is not null then insert into public.ledger_receipts values(p_id,receipt,auth.uid());end if;
 select jsonb_build_object('id',id,'version',version) into result from public.ledger_entries where id=p_id;
 insert into private.ledger_mutations(user_id,request_id,shared_id,payload,result) values(auth.uid(),p_request_id,p_space,signature,result);
 return result;
end$$;

create or replace function private.ledger_selected(p_space text,p_filters jsonb) returns setof public.ledger_entries language sql stable set search_path='' as $$
 select e.* from public.ledger_entries e where e.shared_id=p_space and e.deleted_at is null
 and (nullif(p_filters->>'from','') is null or e.occurred_on>=(p_filters->>'from')::date)
 and (nullif(p_filters->>'to','') is null or e.occurred_on<(p_filters->>'to')::date)
 and (nullif(p_filters->>'kind','') is null or e.kind=p_filters->>'kind')
 and (nullif(p_filters->>'purpose','') is null or coalesce(e.purpose,'unclassified')=p_filters->>'purpose')
 and (nullif(p_filters->>'scope','') is null or e.scope=p_filters->>'scope')
 and (nullif(p_filters->>'category_id','') is null or e.category_id=(p_filters->>'category_id')::uuid)
 and (nullif(p_filters->>'payer_user_id','') is null or e.payer_user_id=(p_filters->>'payer_user_id')::uuid)
 and (nullif(btrim(p_filters->>'query'),'') is null or strpos(lower(e.description||' '||e.notes),lower(btrim(p_filters->>'query')))>0)
$$;

create or replace function private.ledger_totals(p_space text,p_filters jsonb) returns jsonb language sql stable set search_path='' as $$
 with selected as materialized (select * from private.ledger_selected(p_space,p_filters)),
 totals as (select coalesce(sum(amount_minor) filter(where kind='income'),0) inc,coalesce(sum(amount_minor) filter(where kind='expense'),0) exp,count(*) cnt from selected),
 scopes as (select x.scope,coalesce(sum(s.amount_minor) filter(where kind='income'),0) inc,coalesce(sum(s.amount_minor) filter(where kind='expense'),0) exp from (values('shared'),('personal')) x(scope) left join selected s on s.scope=x.scope group by x.scope),
 purposes as (select x.purpose,coalesce(sum(s.amount_minor) filter(where kind='income'),0) inc,coalesce(sum(s.amount_minor) filter(where kind='expense'),0) exp from (values('self'),('romance'),('unclassified')) x(purpose) left join selected s on coalesce(s.purpose,'unclassified')=x.purpose group by x.purpose),
 people_ids as (select user_id from public.shared_members where shared_id=p_space union select a.user_id from public.ledger_allocations a join selected s on s.id=a.entry_id union select payer_user_id from selected),
 people as (select u.user_id,(select coalesce(sum(a.amount_minor),0)::text from public.ledger_allocations a join selected s on s.id=a.entry_id where a.user_id=u.user_id and s.kind='expense') expense,(select coalesce(sum(a.amount_minor),0)::text from public.ledger_allocations a join selected s on s.id=a.entry_id where a.user_id=u.user_id and s.kind='income') income,(select coalesce(sum(amount_minor),0)::text from selected where payer_user_id=u.user_id and kind='expense') paid,(select coalesce(sum(amount_minor),0)::text from selected where payer_user_id=u.user_id and kind='income') received from people_ids u),
 cats as (select s.kind,c.id,c.name,sum(s.amount_minor)::text amount,count(*) count from selected s join public.ledger_categories c on c.id=s.category_id group by s.kind,c.id,c.name),
 months as (select to_char(occurred_on,'YYYY-MM') as "month",coalesce(sum(amount_minor) filter(where kind='income'),0)::text income,coalesce(sum(amount_minor) filter(where kind='expense'),0)::text expense from selected group by 1)
 select jsonb_build_object('income',inc::text,'expense',exp::text,'net',(inc-exp)::text,'count',cnt,
 'purposes',(select jsonb_object_agg(purpose,jsonb_build_object('income',inc::text,'expense',exp::text,'net',(inc-exp)::text)) from purposes),
 'scopes',(select jsonb_object_agg(scope,jsonb_build_object('income',inc::text,'expense',exp::text,'net',(inc-exp)::text)) from scopes),
 'people',(select coalesce(jsonb_agg(to_jsonb(p) order by user_id),'[]') from people p),
 'categories',(select coalesce(jsonb_agg(to_jsonb(c) order by amount::numeric desc,c.id),'[]') from cats c),
 'months',(select coalesce(jsonb_agg(to_jsonb(m) order by m."month"),'[]') from months m)) from totals
$$;
-- CREATE OR REPLACE 保留原权限；再次明确禁止匿名及客户端绕过 RPC 写入。
revoke all on function public.ledger_bootstrap(text),public.ledger_save(text,uuid,integer,uuid,jsonb) from public,anon;
grant execute on function public.ledger_bootstrap(text),public.ledger_save(text,uuid,integer,uuid,jsonb) to authenticated;
revoke all on function private.ledger_selected(text,jsonb),private.ledger_totals(text,jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
