# Awen

A private, single-user creative reference bank for images and video, with AI-assisted tagging.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Supabase (Postgres + Auth) · Cloudflare R2 · Gemini API · Vercel.

> Setup instructions are filled in milestone by milestone. See the sections below.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

Scripts: `npm run typecheck`, `npm run lint`, `npm run build`.

## Environment variables

See `.env.example`. Anything without the `NEXT_PUBLIC_` prefix is server-only and never reaches the browser.

## Supabase

### 1. Apply the migrations

The migrations live in `supabase/migrations/` and must run **in order**:

| File | What it does |
| --- | --- |
| `20260930000001_schema.sql` | enums, tables, indexes (`references`, `people`, `projects`, `vocabularies`, `prompts`, joins) |
| `20260930000002_rls.sql` | enables RLS on every table, revokes everything from `anon`, grants the minimum to `authenticated`, owner-only policies |
| `20260930000003_functions.sql` | full-text trigger, analysis queue (`claim_next_analysis`, `queue_stats`), `search_references`, `find_near_duplicates`, `set_active_project`, `ensure_vocabularies` |

**Option A: SQL editor (simplest).** In Supabase Dashboard → SQL Editor, paste each file's contents in order and click *Run*.

**Option B: Supabase CLI.**

```bash
brew install supabase/tap/supabase
supabase login
supabase link --project-ref <your-project-ref>   # asks for the DB password
supabase db push                                   # applies supabase/migrations in order
```

`pgvector` must already be enabled (Database → Extensions → `vector`). `references.embedding vector(768)` is created but unused in Phase 1.

### 2. Auth (invite-only, email + password)

Awen is private: public sign-up is off and you create accounts yourself. Each user only ever sees their own data (RLS on `owner_id`).

1. Authentication → Sign In / Providers: keep **Email** enabled and turn **off** "Allow new users to sign up".
2. Authentication → URL Configuration:
   - Site URL: `https://awen.vercel.app` (use `http://localhost:3000` while you only run it locally)
   - Redirect URLs: `http://localhost:3000/**` and `https://awen.vercel.app/**`
3. Adding a person, either way works:
   - **Create user** (no email needed): Authentication → Users → *Add user → Create new user*, set a password, tick *Auto Confirm User*, and send the credentials privately.
   - **Invite user**: Authentication → Users → *Add user → Send invitation*. The link opens Awen, which asks the person to set a password (`/auth/set-password`).
4. Anyone can reset their password at `/auth/forgot-password`.

> Supabase's built-in email sender only delivers to members of your Supabase team and has a low hourly limit. To send invites or password resets to other people, configure custom SMTP (Authentication → Emails → SMTP settings, e.g. Resend).

Optional, more robust email links: in Authentication → Emails → Templates, set the *Invite user* link to
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` and the *Reset password* link to
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`. The default templates also work.

The vocabularies (shot type, camera angle, camera movement, lighting, mood) are seeded automatically for each user on their first login.

### 3. Security check (optional)

Run this in the SQL editor. It should return **no rows**, which means `anon` has no table privileges:

```sql
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon';
```
