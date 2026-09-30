-- Phase 2: private, user-owned FP&A data model.
-- Composite foreign keys keep a child row, its company, and its import under
-- the same user even when a caller knows another user's UUID.

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  currency text not null default 'USD',
  fiscal_year_start_month int not null default 1
    check (fiscal_year_start_month between 1 and 12),
  minimum_cash_threshold numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null,
  kind text not null check (kind in ('budget', 'actual', 'cash')),
  filename text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint check (size_bytes >= 0),
  status text not null check (status in ('reserved', 'uploaded', 'processing', 'processed', 'failed')),
  row_count int check (row_count >= 0),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (id, company_id, user_id),
  foreign key (company_id, user_id)
    references public.companies (id, user_id) on delete cascade
);

create table public.financial_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null,
  import_id uuid not null,
  kind text not null check (kind in ('budget', 'actual')),
  period date not null,
  department text not null,
  account_code text not null,
  account_name text not null,
  account_type text not null check (account_type in
    ('revenue', 'cogs', 'operating_expense', 'other_income', 'other_expense')),
  amount numeric not null,
  source_row int check (source_row > 0),
  created_at timestamptz not null default now(),
  foreign key (company_id, user_id)
    references public.companies (id, user_id) on delete cascade,
  foreign key (import_id, company_id, user_id)
    references public.imports (id, company_id, user_id) on delete cascade
);

create table public.cash_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null,
  balance_date date not null,
  amount numeric not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, balance_date),
  foreign key (company_id, user_id)
    references public.companies (id, user_id) on delete cascade
);

create table public.cash_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null,
  import_id uuid,
  expected_date date not null,
  description text not null,
  category text not null,
  direction text not null check (direction in ('inflow', 'outflow')),
  amount numeric not null check (amount >= 0),
  status text not null check (status in ('planned', 'confirmed', 'actual')),
  source_row int check (source_row > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (company_id, user_id)
    references public.companies (id, user_id) on delete cascade,
  foreign key (import_id, company_id, user_id)
    references public.imports (id, company_id, user_id) on delete cascade
);

create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null,
  name text not null,
  inflow_adjustment_pct numeric not null default 0
    check (inflow_adjustment_pct between -100 and 500),
  outflow_adjustment_pct numeric not null default 0
    check (outflow_adjustment_pct between -100 and 500),
  collection_delay_days int not null default 0
    check (collection_delay_days between 0 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (company_id, user_id)
    references public.companies (id, user_id) on delete cascade
);

create table public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null,
  fact_hash text not null,
  provider text not null check (provider in ('groq', 'deterministic')),
  fallback_used boolean not null,
  analysis_text text not null,
  parameters jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (company_id, user_id)
    references public.companies (id, user_id) on delete cascade
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null,
  status text not null check (status in ('generating', 'ready', 'failed')),
  storage_path text,
  parameters jsonb not null,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (company_id, user_id)
    references public.companies (id, user_id) on delete cascade
);

-- Ownership checks and common company-scoped reads.
create index companies_user_id_idx on public.companies (user_id);
create index imports_user_company_idx on public.imports (user_id, company_id);
create index imports_company_created_idx on public.imports (company_id, created_at desc);
create index financial_lines_user_id_idx on public.financial_lines (user_id);
create index financial_lines_import_company_user_idx on public.financial_lines (import_id, company_id, user_id);
create index financial_lines_company_period_idx on public.financial_lines (company_id, period);
create index financial_lines_company_kind_period_idx on public.financial_lines (company_id, kind, period);
create index financial_lines_company_department_idx on public.financial_lines (company_id, department);
create index financial_lines_company_account_code_idx on public.financial_lines (company_id, account_code);
create index cash_balances_user_id_idx on public.cash_balances (user_id);
create index cash_items_user_id_idx on public.cash_items (user_id);
create index cash_items_company_expected_date_idx on public.cash_items (company_id, expected_date);
create index cash_items_import_company_user_idx on public.cash_items (import_id, company_id, user_id);
create index scenarios_user_company_idx on public.scenarios (user_id, company_id);
create index scenarios_company_id_idx on public.scenarios (company_id);
create index analysis_results_user_company_idx on public.analysis_results (user_id, company_id);
create index analysis_results_company_created_idx on public.analysis_results (company_id, created_at desc);
create index reports_user_company_idx on public.reports (user_id, company_id);
create index reports_company_created_idx on public.reports (company_id, created_at desc);

alter table public.companies enable row level security;
alter table public.imports enable row level security;
alter table public.financial_lines enable row level security;
alter table public.cash_balances enable row level security;
alter table public.cash_items enable row level security;
alter table public.scenarios enable row level security;
alter table public.analysis_results enable row level security;
alter table public.reports enable row level security;

revoke all on public.companies, public.imports, public.financial_lines,
  public.cash_balances, public.cash_items, public.scenarios,
  public.analysis_results, public.reports from anon, authenticated;
grant select, insert, update, delete on public.companies, public.imports,
  public.financial_lines, public.cash_balances, public.cash_items,
  public.scenarios, public.analysis_results, public.reports to authenticated;

create policy companies_select_own on public.companies for select to authenticated
  using ((select auth.uid()) = user_id);
create policy companies_insert_own on public.companies for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy companies_update_own on public.companies for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy companies_delete_own on public.companies for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy imports_select_own on public.imports for select to authenticated
  using ((select auth.uid()) = user_id);
create policy imports_insert_own on public.imports for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy imports_update_own on public.imports for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy imports_delete_own on public.imports for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy financial_lines_select_own on public.financial_lines for select to authenticated
  using ((select auth.uid()) = user_id);
create policy financial_lines_insert_own on public.financial_lines for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy financial_lines_update_own on public.financial_lines for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy financial_lines_delete_own on public.financial_lines for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy cash_balances_select_own on public.cash_balances for select to authenticated
  using ((select auth.uid()) = user_id);
create policy cash_balances_insert_own on public.cash_balances for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy cash_balances_update_own on public.cash_balances for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy cash_balances_delete_own on public.cash_balances for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy cash_items_select_own on public.cash_items for select to authenticated
  using ((select auth.uid()) = user_id);
create policy cash_items_insert_own on public.cash_items for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy cash_items_update_own on public.cash_items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy cash_items_delete_own on public.cash_items for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy scenarios_select_own on public.scenarios for select to authenticated
  using ((select auth.uid()) = user_id);
create policy scenarios_insert_own on public.scenarios for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy scenarios_update_own on public.scenarios for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy scenarios_delete_own on public.scenarios for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy analysis_results_select_own on public.analysis_results for select to authenticated
  using ((select auth.uid()) = user_id);
create policy analysis_results_insert_own on public.analysis_results for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy analysis_results_update_own on public.analysis_results for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy analysis_results_delete_own on public.analysis_results for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy reports_select_own on public.reports for select to authenticated
  using ((select auth.uid()) = user_id);
create policy reports_insert_own on public.reports for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy reports_update_own on public.reports for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy reports_delete_own on public.reports for delete to authenticated
  using ((select auth.uid()) = user_id);
