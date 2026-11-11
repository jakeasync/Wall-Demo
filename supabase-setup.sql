-- Step 1: Create posts table
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  body text check (char_length(body) <= 280),
  created_at timestamptz default now()
);

-- Step 2: Enable Row Level Security (RLS) and policies for public Wall usage
alter table posts enable row level security;

-- Allow anyone (anon) to read posts
create policy "Allow public read access"
  on posts for select
  using (true);

-- Allow anyone (anon) to insert posts
create policy "Allow public insert access"
  on posts for insert
  with check (char_length(body) <= 280);

-- Step 3: Enable Realtime for the posts table
alter publication supabase_realtime add table posts;

