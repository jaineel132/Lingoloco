insert into storage.buckets (id, name, public)
values ('profileimages', 'profileimages', true)
on conflict (id) do update
set name = excluded.name,
    public = true;

drop policy if exists "profileimages_public_read" on storage.objects;
create policy "profileimages_public_read"
on storage.objects
for select
to public
using (bucket_id = 'profileimages');

drop policy if exists "profileimages_insert_own" on storage.objects;
create policy "profileimages_insert_own"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'profileimages'
    and auth.uid() is not null
    and name like auth.uid()::text || '/%'
);

drop policy if exists "profileimages_update_own" on storage.objects;
create policy "profileimages_update_own"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'profileimages'
    and auth.uid() is not null
    and name like auth.uid()::text || '/%'
)
with check (
    bucket_id = 'profileimages'
    and auth.uid() is not null
    and name like auth.uid()::text || '/%'
);

drop policy if exists "profileimages_delete_own" on storage.objects;
create policy "profileimages_delete_own"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'profileimages'
    and auth.uid() is not null
    and name like auth.uid()::text || '/%'
);