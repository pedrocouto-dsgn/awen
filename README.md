# Awen

A private creative reference bank for AI-driven video and photography: collect images, videos and links, get AI-assisted technical tagging, review it, and search your library by shot, mood, light, palette color and more.

- UI in Brazilian Portuguese (pt-BR); AI descriptions, tags and vocabularies in English.
- Invite-only: public sign-up is off. Each account sees only its own data (Row Level Security).

**Stack:** Next.js 16 (App Router) · TypeScript (strict) · Tailwind v4 · shadcn/ui · Supabase (Postgres + pgvector, Auth) · Cloudflare R2 · Gemini API · Vercel.

---

## Features (Phase 1)

| Area | What it does |
| --- | --- |
| **Add** | Drag and drop (many files), paste an image or link anywhere (⌘V), or paste a link. YouTube/Vimeo via oEmbed (embedded player), Pinterest/Instagram/pages via Open Graph. When no media can be captured, the link is kept and you can upload the file manually. Files go **straight from the browser to R2** (presigned PUT), never through Vercel. |
| **Technical data (code, not AI)** | Width, height, aspect ratio, size, MIME type; duration and fps for video (MP4 headers via mp4box); a 6-color palette (k-means in Lab) with percentages; a 64-bit perceptual hash to flag near-duplicates. Four video frames are extracted in the browser. |
| **AI analysis** | Gemini with structured JSON output limited to your vocabularies (with "suggested new term" when nothing fits): shot type, camera angle, camera movement (video), lighting, mood, visual style, texture/grain, setting, era, subject, description, tags, and a possible artist/director (always a suggestion). Lens is never analyzed. Runs as a resumable queue with retry, backoff and a "failed" state with a retry button. |
| **Review** | One card at a time with editable AI fields. **A** approve · **E** edit · **R** reject · **← →** navigate · **1–5** rating · **P** add to the active project · **Esc** cancel · **⌘↵** save. Undo after approve or reject. Only approved items reach the Library. |
| **Library** | Masonry grid, hover preview, detail view with a large viewer (image, HTML5 video, YouTube/Vimeo embed), all metadata, palette, notes, people, projects. Combinable filters (shot, mood, lighting, aspect ratio, person, project, image/video, source, date, rating), full-text search (description, tags, notes…) and search by color. |
| **People** | Directors, photographers and artists with autocomplete, a role per link, and a page per person. |
| **Projects** | A reference can sit in several projects; one project can be active (top-bar chip, **P** shortcut). Canvas position columns are stored for the future moodboard. |
| **Settings** | Edit vocabularies: add, rename (updates every reference using the term), archive/restore, reorder. |

Out of scope for Phase 1 (the schema is ready): prompt library UI, Chrome extension, semantic/image-similarity search (`references.embedding`), moodboard canvas and export, random mode, folder autosync, bulk import.

---

## 1. Supabase

### 1.1 Apply the migrations (in order)

| File | What it does |
| --- | --- |
| `supabase/migrations/20260930000001_schema.sql` | Enums, tables and indexes. `references.embedding vector(768)` is created in the schema where pgvector lives (installing it in `extensions` if needed). |
| `…000002_rls.sql` | Enables RLS on every table. Nothing is granted to `anon`, the minimum is granted to `authenticated`, and policies use `owner_id = auth.uid()`. |
| `…000003_functions.sql` | Full-text trigger, analysis queue (`claim_next_analysis`, `queue_stats`), `search_references` (filters + color), `find_near_duplicates`, `set_active_project`, `ensure_vocabularies`. |
| `…000004_vocabulary_admin.sql` | `rename_vocab_term` (cascades to references) and `reorder_vocabulary`, used by Settings. |

**SQL editor (simplest):** Supabase Dashboard → SQL Editor → paste each file's contents **in order** → *Run*.

**Or the Supabase CLI:**

```bash
brew install supabase/tap/supabase
supabase login
supabase link --project-ref <project-ref>   # asks for the DB password
supabase db push                              # applies supabase/migrations in order
```

Project settings assumed: Data API on, "automatically expose new tables" **off**, automatic RLS **on**. The migrations enable RLS and set grants explicitly anyway.

**Security check (optional).** This should return **no rows**:

```sql
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon';
```

### 1.2 Auth (invite-only, email + password)

1. **Authentication → Sign In / Providers:** keep **Email** on; turn **off** "Allow new users to sign up".
2. **Authentication → URL Configuration:**
   - Site URL: `https://awen.vercel.app`
   - Redirect URLs: `http://localhost:3000/**` and `https://awen.vercel.app/**`
3. **Add people** (Authentication → Users → *Add user*):
   - *Create new user*: set a password, tick **Auto Confirm User**, share the credentials privately. No email needed.
   - *Send invitation*: the link opens Awen at `/auth/set-password`.
4. Anyone can reset their password at `/auth/forgot-password`.

> Supabase's built-in email sender only delivers to members of your Supabase team, with a low hourly limit. For invites and password resets to other people, set up custom SMTP (Authentication → Emails → SMTP, e.g. Resend).
>
> Optional, more robust links: in Authentication → Emails → Templates, set *Invite user* to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` and *Reset password* to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`. The default templates work too.

Vocabularies are seeded per user on first login.

---

## 2. Cloudflare R2

1. Create a **private** bucket named `awen-references` (no public access, no custom domain needed).
2. Create an API token with **Object Read & Write** on that bucket and note the Access Key ID and Secret.
3. Bucket → Settings → **CORS policy**:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://awen.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Objects are stored as `{userId}/{referenceId}/original.ext | thumb.jpg | frames/n.jpg` and read through short-lived presigned URLs. Uploads are presigned with the exact `Content-Type` and `Content-Length`. Per-file limits: images 50 MB, videos 300 MB (`lib/media/limits.ts`).

---

## 3. Gemini

Create an API key in Google AI Studio **in a project on the free tier** (no billing), or in a project with billing and available credits. A prepaid project with no credits returns `402` and the queue shows "Análise pausada".

- Default model: `gemini-3.8-flash` (current stable Flash on the free tier). If you hit the daily limit often, try `gemini-3.5-flash-lite`.
- All users share one key, so `ANALYSIS_DAILY_LIMIT` (default 100 per user per 24 h) protects the quota.

**How the queue runs.** While Awen is open, a browser worker (one per browser, via the Web Locks API; state is shared across tabs) calls `POST /api/analysis/run` about every 4 s. Each call claims one item with `FOR UPDATE SKIP LOCKED` and finishes well within the function limit. Transient errors back off exponentially (30 s → 30 min) for up to 5 attempts; then the item is `failed`, with a retry button. Rate limits, billing and bad keys pause the whole queue without spending attempts. A daily Vercel Cron (`/api/cron/analysis`) drains up to 20 items when nobody has the app open.

---

## 4. Environment variables

Copy `.env.example` to `.env.local` for local development. Set the same variables in Vercel.

| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase **publishable** key (`sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Supabase **secret** key (`sb_secret_…`). Used only by the cron route. |
| `R2_ACCOUNT_ID` | server only | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | server only | R2 API token |
| `R2_BUCKET` | server only | `awen-references` |
| `R2_PUBLIC_BASE_URL` | server only | Optional; leave empty (reads use presigned URLs) |
| `GEMINI_API_KEY` | server only | Google AI Studio key |
| `GEMINI_MODEL` | server only | e.g. `gemini-3.8-flash` |
| `ANALYSIS_DAILY_LIMIT` | server only | Optional, default `100` |
| `CRON_SECRET` | server only | Long random string; Vercel sends it to the cron route |

Variables without the `NEXT_PUBLIC_` prefix never reach the browser. `lib/env/*` validates them with Zod at runtime and reports only variable names, never values.

---

## 5. Local development

```bash
npm install
cp .env.example .env.local     # fill in the values
npm run dev                    # http://localhost:3000
```

Checks: `npm run typecheck`, `npm run lint`, `npm run build`.

---

## 6. Deploy on Vercel (free plan)

1. Push the repo to GitHub and **Import** it in Vercel (framework: Next.js; defaults are fine).
2. **Settings → Environment Variables:** add every variable from section 4 (Production and Preview).
3. **Region:** `vercel.json` pins functions to **Dublin (`dub1`)**, next to the Supabase project in `eu-west-1`. Check Settings → Functions → Function Region shows `dub1`.
4. **Cron:** `vercel.json` registers `GET /api/cron/analysis` daily at 06:00 UTC (Hobby allows one run per day). Vercel adds `Authorization: Bearer $CRON_SECRET` automatically once `CRON_SECRET` is set.
5. Deploy, then make sure Supabase **Site URL / Redirect URLs** and the R2 **CORS** list include the production domain (`https://awen.vercel.app`).

Every route stays short: uploads never touch Vercel, and analysis handles one item per request (`maxDuration` 60 s).

---

## Design system

`awen-DESIGN.md` defines the visual language, and `app/globals.css` implements it as tokens:

- colors, including a light variant derived from the doc; dark is the default
- 8 gradients (`bg-gradient-canvas | glow | card | dusk | accent | steel | scrim | hairline`)
- typography utilities (`type-display-*`, `type-title-*`, `type-label`, `type-button`, `type-nav`…)
- radii (`rounded-input`, `rounded-popover`, `rounded-modal`; everything else square)
- the overlay shadow

Components only use tokens. To restyle, edit the token values.

---

## Project structure

```
app/
  (auth)/            login, forgot/set password
  (app)/             library, review, people, projects, settings (+ loading/error/not-found)
  api/               references, uploads, links, analysis, library, people, projects, vocabularies, cron
  auth/confirm/      email link landing (token_hash and PKCE code)
features/            ingest, analysis, review, library, media, references, people, projects, settings, auth
lib/
  env/  supabase/  r2/  gemini/  analysis/  palette/  phash/  links/  library/  references/  media/  validation/
components/          ui (shadcn, token-only), shell (sidebar, top bar, empty/confirm), brand
supabase/migrations/ SQL, applied in order
types/database.ts    supabase-js types mirroring the migrations
```
