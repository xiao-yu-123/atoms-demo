-- ============================================================================
-- Atoms-Demo: 初始数据库迁移
-- 文件: supabase/migrations/001_init.sql
-- 描述: 创建核心表 + RLS 策略 + 触发器 + 索引
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles — 用户资料
--    Supabase Auth 注册后由触发器自动创建
-- ----------------------------------------------------------------------------
create table public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  username    text        unique,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. projects — 项目
-- ----------------------------------------------------------------------------
create type public.project_status as enum ('draft', 'building', 'completed', 'deployed');

create table public.projects (
  id          uuid                primary key default gen_random_uuid(),
  user_id     uuid                not null references public.profiles(id) on delete cascade,
  name        text                not null,
  description text,
  status      public.project_status not null default 'draft',
  created_at  timestamptz         not null default now(),
  updated_at  timestamptz         not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. conversations — 对话
-- ----------------------------------------------------------------------------
create table public.conversations (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects(id) on delete cascade,
  title       text        not null default 'New Conversation',
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. messages — 消息
-- ----------------------------------------------------------------------------
create type public.message_role  as enum ('user', 'agent');
create type public.agent_name    as enum ('Mike', 'Iris', 'Emma', 'Bob', 'Alex', 'Sarah');

create table public.messages (
  id                uuid              primary key default gen_random_uuid(),
  conversation_id   uuid              not null references public.conversations(id) on delete cascade,
  role              public.message_role not null,
  agent_name        public.agent_name,
  content           text              not null,
  metadata          jsonb             not null default '{}'::jsonb,
  created_at        timestamptz       not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. generated_code — 生成代码快照
-- ----------------------------------------------------------------------------
create type public.code_type as enum ('react_component', 'full_app', 'snippet');

create table public.generated_code (
  id                uuid            primary key default gen_random_uuid(),
  project_id        uuid            not null references public.projects(id) on delete cascade,
  conversation_id   uuid            not null references public.conversations(id) on delete cascade,
  code_type         public.code_type not null default 'full_app',
  files             jsonb           not null default '{}'::jsonb,
  version           int             not null default 1,
  created_at        timestamptz     not null default now()
);

-- ----------------------------------------------------------------------------
-- 6. race_results — 多模型竞速结果
-- ----------------------------------------------------------------------------
create table public.race_results (
  id              uuid        primary key default gen_random_uuid(),
  project_id      uuid        not null references public.projects(id) on delete cascade,
  prompt          text        not null,
  model_name      text        not null,
  generated_code  jsonb       not null default '{}'::jsonb,
  quality_score   int         check (quality_score is null or (quality_score >= 0 and quality_score <= 100)),
  created_at      timestamptz not null default now()
);

-- ============================================================================
-- RLS (Row Level Security) — 用户只能访问自己的数据
-- ============================================================================

alter table public.profiles       enable row level security;
alter table public.projects       enable row level security;
alter table public.conversations  enable row level security;
alter table public.messages       enable row level security;
alter table public.generated_code enable row level security;
alter table public.race_results   enable row level security;

-- profiles: 查看 / 更新自己的资料
create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (id = auth.uid());

-- projects: 完全隔离
create policy "Users can view own projects"
  on public.projects for select
  using (user_id = auth.uid());

create policy "Users can create own projects"
  on public.projects for insert
  with check (user_id = auth.uid());

create policy "Users can update own projects"
  on public.projects for update
  using (user_id = auth.uid());

create policy "Users can delete own projects"
  on public.projects for delete
  using (user_id = auth.uid());

-- conversations: 通过 project → user 链式隔离
create policy "Users can access own conversations"
  on public.conversations for all
  using (project_id in (select id from public.projects where user_id = auth.uid()));

-- messages: 通过 conversation → project → user 链式隔离
create policy "Users can access own messages"
  on public.messages for all
  using (conversation_id in (
    select id from public.conversations
    where project_id in (select id from public.projects where user_id = auth.uid())
  ));

-- generated_code: 通过 project → user 链式隔离
create policy "Users can access own generated_code"
  on public.generated_code for all
  using (project_id in (select id from public.projects where user_id = auth.uid()));

-- race_results: 通过 project → user 链式隔离
create policy "Users can access own race_results"
  on public.race_results for all
  using (project_id in (select id from public.projects where user_id = auth.uid()));

-- ============================================================================
-- 触发器 & 函数
-- ============================================================================

-- 新用户注册时自动创建 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
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

-- 仅在触发器不存在时创建
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'on_auth_user_created'
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end;
$$;

-- 自动更新 projects.updated_at
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'projects_updated_at'
  ) then
    create trigger projects_updated_at
      before update on public.projects
      for each row execute function public.update_updated_at();
  end if;
end;
$$;

-- ============================================================================
-- 索引（常用查询加速）
-- ============================================================================

create index idx_projects_user_id        on public.projects(user_id);
create index idx_projects_status         on public.projects(status);
create index idx_projects_updated_at     on public.projects(updated_at desc);

create index idx_conversations_project   on public.conversations(project_id);
create index idx_conversations_created   on public.conversations(created_at desc);

create index idx_messages_conv           on public.messages(conversation_id);
create index idx_messages_conv_created   on public.messages(conversation_id, created_at);

create index idx_generated_code_project  on public.generated_code(project_id);
create index idx_generated_code_conv     on public.generated_code(conversation_id);

create index idx_race_results_project    on public.race_results(project_id);
