-- Storage-Buckets für Belegfotos und Übungsmedien (Bilder/Videos)

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('exercise-media', 'exercise-media', false)
on conflict (id) do nothing;

create policy receipts_storage_select on storage.objects for select
  using (bucket_id = 'receipts' and auth.uid() is not null);
create policy receipts_storage_insert on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.uid() is not null);
create policy receipts_storage_delete on storage.objects for delete
  using (bucket_id = 'receipts' and (is_admin() or owner = auth.uid()));

create policy exercise_media_storage_select on storage.objects for select
  using (bucket_id = 'exercise-media' and auth.uid() is not null);
create policy exercise_media_storage_insert on storage.objects for insert
  with check (bucket_id = 'exercise-media' and auth.uid() is not null);
create policy exercise_media_storage_delete on storage.objects for delete
  using (bucket_id = 'exercise-media' and (is_admin() or owner = auth.uid()));
