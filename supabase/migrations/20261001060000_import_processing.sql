-- Caller privileges and RLS apply to every statement (security invoker).
alter table public.imports add column validation_errors jsonb not null default '[]';
alter table public.imports add column warnings jsonb not null default '[]';
alter table public.imports add column processing_token uuid;
alter table public.imports add column processing_started_at timestamptz;

create function public.claim_import(p_import_id uuid, p_token uuid)
returns setof public.imports language plpgsql security invoker
set search_path = '' as $$
declare item public.imports;
begin
  select * into item from public.imports
    where id = p_import_id and user_id = auth.uid() for update;
  if not found then return; end if;
  if item.status not in ('uploaded', 'failed') and not
    (item.status = 'processing' and item.processing_started_at < now() - interval '10 minutes')
    then return; end if;
  return query update public.imports set status = 'processing', processing_token = p_token,
    processing_started_at = now(), updated_at = now(), error_message = null,
    validation_errors = '[]', warnings = '[]'
    where id = p_import_id and user_id = auth.uid() returning *;
end $$;

create function public.commit_import_rows(p_import_id uuid, p_token uuid, p_rows jsonb,
  p_warnings jsonb) returns setof public.imports language plpgsql security invoker
set search_path = '' as $$
declare item public.imports;
begin
  select * into item from public.imports where id = p_import_id and user_id = auth.uid()
    and status = 'processing' and processing_token = p_token for update;
  if not found then return; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 50000
    then raise exception 'Invalid row count'; end if;
  delete from public.financial_lines where import_id = item.id and user_id = auth.uid();
  delete from public.cash_items where import_id = item.id and user_id = auth.uid();
  if item.kind = 'cash' then
    insert into public.cash_items (user_id, company_id, import_id, expected_date,
      description, category, direction, amount, status, source_row)
    select item.user_id, item.company_id, item.id, x.expected_date, x.description,
      x.category, x.direction, x.amount, x.status, x.source_row
      from jsonb_to_recordset(p_rows) as x(expected_date date, description text,
        category text, direction text, amount numeric, status text, source_row int);
  else
    insert into public.financial_lines (user_id, company_id, import_id, kind, period,
      department, account_code, account_name, account_type, amount, source_row)
    select item.user_id, item.company_id, item.id, item.kind, x.period, x.department,
      x.account_code, x.account_name, x.account_type, x.amount, x.source_row
      from jsonb_to_recordset(p_rows) as x(period date, department text, account_code text,
        account_name text, account_type text, amount numeric, source_row int);
  end if;
  return query update public.imports set status = 'processed',
    row_count = jsonb_array_length(p_rows), warnings = p_warnings, validation_errors = '[]',
    error_message = null, processed_at = now(), updated_at = now(),
    processing_token = null, processing_started_at = null
    where id = item.id and user_id = auth.uid() returning *;
end $$;

revoke all on function public.claim_import(uuid, uuid) from public, anon;
revoke all on function public.commit_import_rows(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.claim_import(uuid, uuid) to authenticated;
grant execute on function public.commit_import_rows(uuid, uuid, jsonb, jsonb) to authenticated;
