-- ============================================================================
-- school-test-platform — reconstructed schema
-- Rebuilt from application code (no migrations existed in the repo before this).
-- Run this once, in full, in the SQL editor of a fresh Supabase project.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- teachers
-- ---------------------------------------------------------------------------
create table public.teachers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  password_hash text not null,
  subjects      text[] not null default '{}',
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- teacher_sessions (bearer tokens for the custom teacher auth)
-- ---------------------------------------------------------------------------
create table public.teacher_sessions (
  token      uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index idx_teacher_sessions_teacher_id on public.teacher_sessions(teacher_id);

-- ---------------------------------------------------------------------------
-- classes (app assigns the numeric id itself — 1-12, or grade*100+letter for
-- lettered classes — so id is NOT auto-generated)
-- ---------------------------------------------------------------------------
create table public.classes (
  id         integer primary key,
  class_key  text,
  teacher_id uuid references public.teachers(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- teacher_classes (M:N teacher <-> class, plus per-teacher prep code)
-- ---------------------------------------------------------------------------
create table public.teacher_classes (
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  class_id   integer not null references public.classes(id) on delete cascade,
  prep_code  text unique,
  created_at timestamptz not null default now(),
  primary key (teacher_id, class_id)
);

-- ---------------------------------------------------------------------------
-- teacher_exam_status (one row per teacher+class: is an exam open right now)
-- ---------------------------------------------------------------------------
create table public.teacher_exam_status (
  teacher_id   uuid not null references public.teachers(id) on delete cascade,
  class_id     integer not null references public.classes(id) on delete cascade,
  exam_active  boolean not null default false,
  session_code text,
  primary key (teacher_id, class_id)
);
create index idx_teacher_exam_status_session_code on public.teacher_exam_status(session_code);

-- ---------------------------------------------------------------------------
-- students (NOTE: no route in the app creates/edits these — must be seeded
-- manually per class, e.g. via SQL insert or the Supabase table editor)
-- ---------------------------------------------------------------------------
create table public.students (
  id         uuid primary key default gen_random_uuid(),
  class_id   integer not null references public.classes(id) on delete cascade,
  full_name  text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_students_class_id on public.students(class_id);

-- ---------------------------------------------------------------------------
-- works (exam/test content: one row per class+variant+subject+teacher)
-- ---------------------------------------------------------------------------
create table public.works (
  id               uuid primary key default gen_random_uuid(),
  class_id         integer not null references public.classes(id) on delete cascade,
  variant          integer not null check (variant in (1, 2)),
  subject          text not null,
  teacher_id       uuid not null references public.teachers(id) on delete cascade,
  work_type        text,
  title            text not null,
  duration_minutes integer not null,
  tasks            jsonb not null default '[]',
  online_mode      boolean not null default false,
  prep_enabled     boolean not null default false,
  calculator_enabled boolean not null default true,
  draft_enabled      boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (class_id, variant, subject, teacher_id)
);
create index idx_works_class_teacher on public.works(class_id, teacher_id);

-- ---------------------------------------------------------------------------
-- student_sessions (one row per student exam attempt)
-- ---------------------------------------------------------------------------
create table public.student_sessions (
  id             uuid primary key default gen_random_uuid(),
  class_id       integer references public.classes(id) on delete cascade,
  student_id     uuid references public.students(id) on delete cascade,
  teacher_id     uuid references public.teachers(id) on delete set null,
  full_name      text,
  variant        integer check (variant in (1, 2)),
  subject        text,
  work_type      text,
  status         text not null default 'writing' check (status in ('writing', 'blocked', 'finished')),
  block_reason   text,
  blocked_at     timestamptz,
  unlocked_at    timestamptz,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  updated_at     timestamptz not null default now(),
  extra_minutes  integer not null default 0,
  teacher_message text,
  exit_logs      jsonb not null default '[]',
  shuffle_order  jsonb,
  score          numeric,
  answers        jsonb
);
create index idx_student_sessions_class_id on public.student_sessions(class_id);
create index idx_student_sessions_student_id on public.student_sessions(student_id);
create index idx_student_sessions_teacher_id on public.student_sessions(teacher_id);
create index idx_student_sessions_status on public.student_sessions(status);

-- keep updated_at current on every UPDATE (archive page relies on this)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_student_sessions_updated_at
  before update on public.student_sessions
  for each row execute function public.set_updated_at();

create trigger trg_works_updated_at
  before update on public.works
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- prep_logs (AI-tutor chat log, for teacher analytics)
-- ---------------------------------------------------------------------------
create table public.prep_logs (
  id           uuid primary key default gen_random_uuid(),
  class_id     integer references public.classes(id) on delete cascade,
  teacher_id   uuid references public.teachers(id) on delete cascade,
  student_name text,
  subject      text,
  message      text not null,
  created_at   timestamptz not null default now()
);
create index idx_prep_logs_class_teacher on public.prep_logs(class_id, teacher_id, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security: the app only ever talks to Postgres through the
-- service-role key (supabaseAdmin), which bypasses RLS entirely. Enabling RLS
-- with no policies just makes sure the anon/public key (used client-side)
-- can't read or write anything directly.
-- ---------------------------------------------------------------------------
alter table public.teachers enable row level security;
alter table public.teacher_sessions enable row level security;
alter table public.classes enable row level security;
alter table public.teacher_classes enable row level security;
alter table public.teacher_exam_status enable row level security;
alter table public.students enable row level security;
alter table public.works enable row level security;
alter table public.student_sessions enable row level security;
alter table public.prep_logs enable row level security;

-- ============================================================================
-- After running this file:
-- 1. Storage -> New bucket -> name "task-images" -> Public bucket = ON
--    (used by app/api/upload-task-image for task images, served via public URL)
-- 2. Re-register your teacher account(s) via /teacher/register (password
--    hashing is app-side, so old password hashes from the dead project are
--    useless even if you had a data export).
-- 3. Re-add classes via the dashboard "add class" UI (this recreates
--    classes / teacher_classes / teacher_exam_status rows automatically).
-- 4. Manually insert rows into `students` for each class — no UI creates
--    these, they were always seeded directly in Supabase.
-- 5. If you use the manual "class key" join path (classes.class_key /
--    /api/verify-class-key), set that column by hand too — no route writes it.
-- ============================================================================
