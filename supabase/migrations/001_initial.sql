create extension if not exists "pgcrypto";

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  name          text,
  password_hash text,
  tier          text default 'free' check (tier in ('free','plus','ultra')),
  created_at    timestamptz default now(),
  deleted_at    timestamptz
);

create table topics (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references users(id) on delete cascade,
  name          text not null,
  content_text  text,
  pdf_url       text,
  created_at    timestamptz default now(),
  deleted_at    timestamptz
);

create table question_sets (
  id            uuid primary key default gen_random_uuid(),
  topic_id      uuid references topics(id) on delete cascade,
  level         int not null check (level between 1 and 5),
  questions     jsonb not null default '[]',
  job_status    text default 'pending' check (job_status in ('pending','processing','done','error')),
  job_error     text,
  generated_at  timestamptz default now(),
  unique(topic_id, level)
);

create table sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references users(id),
  topic_id      uuid references topics(id),
  level         int not null,
  score         int,
  started_at    timestamptz default now(),
  completed_at  timestamptz
);

create table attempts (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid references sessions(id) on delete cascade,
  question_index int not null,
  answer         text,
  correct        boolean,
  score          int,
  hints_used     int default 0
);

create table hint_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id) on delete cascade,
  created_at timestamptz default now()
);

-- RLS
alter table users        enable row level security;
alter table topics       enable row level security;
alter table question_sets enable row level security;
alter table sessions     enable row level security;
alter table attempts     enable row level security;
alter table hint_events  enable row level security;

create policy users_self      on users        for all using (id = auth.uid());
create policy topics_owner    on topics       for all using (user_id = auth.uid() and deleted_at is null);
create policy qsets_owner     on question_sets for all using (
  topic_id in (select id from topics where user_id = auth.uid())
);
create policy sessions_owner  on sessions     for all using (user_id = auth.uid());
create policy attempts_owner  on attempts     for all using (
  session_id in (select id from sessions where user_id = auth.uid())
);
create policy hint_owner      on hint_events  for all using (user_id = auth.uid());

-- Storage bucket for PDFs
insert into storage.buckets (id, name, public) values ('pdfs', 'pdfs', false);

create policy pdf_upload on storage.objects for insert
  with check (bucket_id = 'pdfs' and auth.uid()::text = (storage.foldername(name))[1]);

create policy pdf_read on storage.objects for select
  using (bucket_id = 'pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
