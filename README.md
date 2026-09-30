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

## AI analysis (Gemini)

Every new reference enters with `status = pending`. Analysis runs as a queue, never blocking the UI:

- **Browser worker.** While Awen is open, a worker (one per browser, coordinated with the Web Locks API) calls `POST /api/analysis/run`. Each call claims one item (`claim_next_analysis`, `FOR UPDATE SKIP LOCKED`), sends it to Gemini, and returns within the function time limit. The worker spaces calls about 4 s apart to respect free-tier RPM.
- **Input.** Images use the stored 1280px JPEG. Uploaded videos use the thumbnail plus 3 extracted frames. YouTube links send the first 90 s of the video by URL, falling back to the thumbnail. Vimeo and other links use the thumbnail.
- **Output.** Structured JSON (`responseJsonSchema`) restricted to the user's vocabularies, with `"other"` + a suggested new term when nothing fits. The raw output is kept in `references.ai` and the curated columns are filled from it. Lens is never analyzed.
- **Retries.** Transient errors are retried with exponential backoff (30 s → 30 min), up to 5 attempts, then the item becomes `failed` with a retry button. Quota, billing (402) and key errors pause the whole queue without spending attempts.
- **Per-user limit.** `ANALYSIS_DAILY_LIMIT` (default 100) analyses per user per 24 h, since all users share one Gemini key.
- **Cron safety net.** Vercel Cron calls `GET /api/cron/analysis` once a day (Hobby plan limit) with `Authorization: Bearer $CRON_SECRET`, draining up to 20 items for all users.

> The Gemini key must belong to a project on the **free tier**, or have billing with available credits. A project with prepaid billing and no credits returns `402` and the queue shows "Análise pausada".
