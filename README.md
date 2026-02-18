# Smart Bookmark App

A simple bookmark manager with Google-only login, private user data, and real-time updates across tabs. Built with Next.js App Router, Supabase (Auth + Database + Realtime), and Tailwind CSS.

## Requirements Covered
- Google OAuth login only (no email/password)
- Authenticated users can add bookmarks (title + URL)
- Bookmarks are private per user via RLS
- Real-time updates without page refresh
- Users can delete their own bookmarks
- Deployable to Vercel with live URL

## Tech Stack
- Next.js (App Router, JavaScript)
- Supabase (Auth, Database, Realtime)
- Tailwind CSS

## Local Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Supabase setup:
- Create a new Supabase project.
- Enable Google Provider in Auth settings.
- Add `http://localhost:3000` as an authorized redirect URL in Google OAuth and Supabase Auth settings.

4. Create the database table and RLS policies (SQL editor in Supabase):
```sql
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null,
  url text not null,
  created_at timestamptz not null default now()
);

alter table public.bookmarks enable row level security;

create policy "Users can view their own bookmarks"
  on public.bookmarks
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own bookmarks"
  on public.bookmarks
  for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own bookmarks"
  on public.bookmarks
  for delete
  using (auth.uid() = user_id);
```

5. Enable Realtime for the `bookmarks` table:
- In Supabase Dashboard, go to Database → Replication → Realtime
- Enable Realtime on the `bookmarks` table

6. Run the app:
```bash
npm run dev
```
Open `http://localhost:3000`.

## Vercel Deployment
- Push to a GitHub repo (public)
- Import into Vercel
- Add the same env vars in Vercel project settings

## Notes / Issues Faced
- `create-next-app` required a version compatible with Node 18, so `create-next-app@15.1.6` was used.
- Supabase Realtime needs to be explicitly enabled on the `bookmarks` table.
