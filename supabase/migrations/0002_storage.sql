-- Supabase Storage buckets for lesson assets and independent .vtt subtitles.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('subtitles', 'subtitles', false, 2097152, array['text/vtt','text/plain','application/octet-stream'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lesson-assets', 'lesson-assets', true, 10485760,
        array['image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain'])
on conflict (id) do nothing;

-- Students may read published caption files; only instructors write them.
create policy "subtitles_read_checked" on storage.objects for select
  using (bucket_id = 'subtitles' and (public.is_instructor() or auth.role() = 'authenticated'));
create policy "subtitles_instructor_write" on storage.objects for insert
  with check (bucket_id = 'subtitles' and public.is_instructor());
create policy "subtitles_instructor_update" on storage.objects for update
  using (bucket_id = 'subtitles' and public.is_instructor());
create policy "subtitles_instructor_delete" on storage.objects for delete
  using (bucket_id = 'subtitles' and public.is_instructor());

create policy "lesson_assets_public_read" on storage.objects for select
  using (bucket_id = 'lesson-assets');
create policy "lesson_assets_instructor_write" on storage.objects for insert
  with check (bucket_id = 'lesson-assets' and public.is_instructor());
create policy "lesson_assets_instructor_delete" on storage.objects for delete
  using (bucket_id = 'lesson-assets' and public.is_instructor());
