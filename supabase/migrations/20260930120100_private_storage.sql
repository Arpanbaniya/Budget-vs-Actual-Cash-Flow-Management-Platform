-- Phase 2: both object buckets are private. Application flows use signed
-- upload/download URLs, and object paths begin with the owning user UUID.

insert into storage.buckets (id, name, public)
values
  ('fpna-imports', 'fpna-imports', false),
  ('fpna-reports', 'fpna-reports', false)
on conflict (id) do update set public = false;

create policy fpna_imports_select_own on storage.objects for select to authenticated
  using (bucket_id = 'fpna-imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fpna_imports_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'fpna-imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fpna_imports_update_own on storage.objects for update to authenticated
  using (bucket_id = 'fpna-imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'fpna-imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fpna_imports_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'fpna-imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy fpna_reports_select_own on storage.objects for select to authenticated
  using (bucket_id = 'fpna-reports'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fpna_reports_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'fpna-reports'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fpna_reports_update_own on storage.objects for update to authenticated
  using (bucket_id = 'fpna-reports'
    and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'fpna-reports'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fpna_reports_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'fpna-reports'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
