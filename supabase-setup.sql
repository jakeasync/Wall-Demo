

-- 1. Create table if not exists
create table if not exists public.posts (
  id uuid not null default gen_random_uuid(),
  user_id uuid null,
  body text null,
  created_at timestamp with time zone null default now(),
  photo_url text null,
  author_name text null default 'Jake Macua',
  image_url text null,
  constraint posts_pkey primary key (id),
  constraint posts_body_check check ((char_length(body) <= 280))
) tablespace pg_default;

-- Add photo_url and author_name columns if they don't already exist
alter table public.posts add column if not exists photo_url text null;
alter table public.posts add column if not exists author_name text null default 'Jake Macua';
alter table public.posts add column if not exists image_url text null;

-- Update any existing rows that still have 'Greg Wientjes'
update public.posts set author_name = 'Jake Macua' where author_name = 'Greg Wientjes' or author_name is null;

-- 2. Row Level Security (RLS) policies for anonymous public access
alter table public.posts enable row level security;

drop policy if exists "Allow public read access" on public.posts;
drop policy if exists "Allow public insert access" on public.posts;

create policy "Allow public read access"
  on public.posts for select
  using (true);

create policy "Allow public insert access"
  on public.posts for insert
  with check (char_length(body) <= 280);

-- 3. Enable Realtime publication (safe check to prevent ERROR: 42710)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
end $$;

-- 4. Storage Bucket Setup for 'wall-photos'
insert into storage.buckets (id, name, public)
values ('wall-photos', 'wall-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Allow public viewing of wall photos" on storage.objects;
drop policy if exists "Allow public uploading of wall photos" on storage.objects;

create policy "Allow public viewing of wall photos"
  on storage.objects for select
  using (bucket_id = 'wall-photos');

create policy "Allow public uploading of wall photos"
  on storage.objects for insert
  with check (bucket_id = 'wall-photos');
