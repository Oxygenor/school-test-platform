-- Математичний помічник: прив'язка записів статистики до перевіреного учня,
-- облік моделі й токенів, лічильник для серверного обмеження частоти.
-- Код працює і без цієї міграції (тоді ліміт частоти — лише в межах інстансу,
-- а токени пишуться тільки в журнал сервера). Застосувати один раз у SQL Editor.

alter table public.prep_logs
  add column if not exists student_id uuid references public.students(id) on delete set null,
  add column if not exists mode text,
  add column if not exists model text,
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists cache_read_tokens integer,
  add column if not exists cache_write_tokens integer;

create index if not exists idx_prep_logs_student_created
  on public.prep_logs(student_id, created_at);
