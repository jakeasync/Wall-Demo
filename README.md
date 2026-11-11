# Facebook Wall (2008 Edition)

A pixel-perfect retro 2008 Facebook Wall built with **React 19**, **Next.js (App Router)**, **Supabase (Database + Realtime)**, and **Tailwind CSS**.

---

## 🚀 Features

- **Classic 2008 Facebook Styling**: Authentic typography (`Lucida Grande`, 11px), official 2008 blue navigation bar (`#3b5998`), wall tabs, profile header, and interactive poke button.
- **Message Composer**:
  - Enforced 280-character maximum limit.
  - Dynamic character countdown indicator with warning states.
  - Share button automatically disabled when empty or over limit.
- **Real-Time Live Feed**:
  - Connects to Supabase Realtime using Postgres Change feeds (`INSERT` events on the `posts` table).
  - Posts automatically appear in reverse-chronological order (newest first) without needing a page refresh.
- **Optional Photo Upload**:
  - Attach images directly from the Wall composer (`wall-photos` bucket in Supabase Storage).
  - Previews selected photos before posting, with responsive rendering on Wall feed items.
- **Supabase Integration**:
  - Full schema setup with RLS policies and realtime publication script included in `supabase-setup.sql`.
  - Graceful fallback: functions out-of-the-box locally even before database keys are hooked up.

---

## 🛠️ Step-by-Step Setup Guide

### 1. Database Setup (Supabase)

1. Create a project on [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** and run the contents of [supabase-setup.sql](supabase-setup.sql):

```sql
-- Create posts table
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  body text check (char_length(body) <= 280),
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table posts enable row level security;

-- Allow public read access
create policy "Allow public read access"
  on posts for select
  using (true);

-- Allow public insert access
create policy "Allow public insert access"
  on posts for insert
  with check (char_length(body) <= 280);

-- Enable Supabase Realtime for the posts table
alter publication supabase_realtime add table posts;
```

3. Obtain your API credentials:
   - Go to **Project Settings** → **API**.
   - Copy **Project URL** and **anon public Key**.

---

### 2. Configure Environment Variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

---

### 3. Run Locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

### 4. Deploy to Vercel

1. Commit and push the repository to GitHub:
   ```bash
   git add .
   git commit -m "Complete 2008 Facebook Wall with Supabase Realtime"
   git remote add origin https://github.com/your-username/facebook-wall-2008.git
   git push -u origin main
   ```
2. Log into [Vercel](https://vercel.com) and import the repository.
3. In **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**.
5. Copy your public production URL (e.g., `https://facebook-wall-2008.vercel.app`).
