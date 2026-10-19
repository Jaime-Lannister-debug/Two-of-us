-- 仅方案 B 使用，在 Supabase SQL Editor 以管理员身份执行。
-- 先将下方邮箱替换为你已注册并确认的邮箱；绝不在网页中执行。
insert into public.shared_members(shared_id,user_id)
select 'our-shared-space',id from auth.users
where lower(email)=lower('替换为你的已注册邮箱')
on conflict do nothing;

-- 确认返回一条成员记录；若返回 0 行，检查上面的邮箱是否正确。
select m.shared_id,u.email
from public.shared_members m join auth.users u on u.id=m.user_id
where m.shared_id='our-shared-space';
