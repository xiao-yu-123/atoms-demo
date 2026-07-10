-- ============================================================================
-- 002_fix_profiles — 修复 profile 触发器 + 补齐已存在用户
-- ============================================================================

-- 1. 为已存在的用户补齐 profile 记录
insert into public.profiles (id, username)
select id, split_part(email, '@', 1)
from auth.users
where id not in (select id from public.profiles);

-- 2. 重建新用户注册触发器（去掉 search_path = ''，避免权限问题）
drop trigger if exists on_auth_user_created on auth.users;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
