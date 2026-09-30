-- Awen · 0001 · Schema
-- Tables, enums, indexes. RLS and grants are in 0002, functions in 0003.
-- Note: "references" is a reserved word in Postgres, so it is always quoted.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.reference_type as enum ('image', 'video');
create type public.source_kind as enum ('upload', 'youtube', 'vimeo', 'link');
create type public.reference_status as enum ('pending', 'analyzing', 'approved', 'rejected', 'failed');
create type public.person_role as enum ('director', 'photographer', 'artist');
create type public.vocab_category as enum ('shot_type', 'camera_angle', 'camera_movement', 'lighting', 'mood');
create type public.prompt_type as enum ('text_to_video', 'image_to_video', 'image', 'edit');
create type public.prompt_status as enum ('worked', 'partial', 'failed');
create type public.prompt_origin as enum ('own', 'third_party');
create type public.prompt_asset_role as enum ('result', 'input');

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- references
-- ---------------------------------------------------------------------------
create table public."references" (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- source
  type public.reference_type not null,
  source_kind public.source_kind not null,
  source_url text,
  source_meta jsonb,                     -- provider info: embed id, oEmbed author, og data...
  title text,                            -- oEmbed / og:title / filename

  -- storage (R2 object keys, never public URLs)
  storage_key text,                      -- original file
  thumbnail_key text,
  frame_keys text[] not null default '{}', -- extra analysis frames for video
  media_ready boolean not null default false, -- true once uploads are finalized

  -- technical data (computed in code)
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  aspect_ratio numeric(8, 4),            -- width / height
  file_size bigint check (file_size is null or file_size >= 0),
  mime_type text,
  duration numeric(10, 3),               -- seconds
  fps numeric(7, 3),
  palette jsonb,                         -- [{hex, pct, lab:[l,a,b]}]
  phash text check (phash is null or phash ~ '^[0-9a-f]{16}$'),

  -- workflow
  status public.reference_status not null default 'pending',
  analysis_attempts integer not null default 0,
  analysis_error text,
  next_attempt_at timestamptz,
  analyzing_since timestamptz,
  analyzed_at timestamptz,
  reviewed_at timestamptz,

  -- AI analysis (raw) + curated fields
  ai jsonb,
  shot_type text,
  camera_angle text,
  camera_movement text,
  lighting text[] not null default '{}',
  mood text[] not null default '{}',
  visual_style text,
  texture_grain text,
  setting text,
  era text,
  subject text,
  description text,
  tags text[] not null default '{}',
  rating smallint check (rating is null or rating between 1 and 5),
  notes text,

  -- search
  search_tsv tsvector
  -- embedding vector(768) is added below, in the schema where pgvector lives
);

-- pgvector: Supabase installs extensions in the "extensions" schema, which is not
-- always on the search_path (e.g. in the SQL editor). Find the schema where
-- vector is installed (or install it in "extensions") and qualify the type.
do $$
declare
  v_schema text;
begin
  select n.nspname into v_schema
  from pg_extension e join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'vector';

  if v_schema is null then
    create schema if not exists extensions;
    create extension vector with schema extensions;
    v_schema := 'extensions';
  end if;

  -- Reserved for Phase 2 (semantic search); unused in Phase 1.
  execute format('alter table public."references" add column embedding %I.vector(768)', v_schema);
end;
$$;

create index references_owner_status_idx on public."references" (owner_id, status, created_at desc);
create index references_queue_idx on public."references" (status, next_attempt_at)
  where status in ('pending', 'analyzing');
create index references_search_idx on public."references" using gin (search_tsv);
create index references_tags_idx on public."references" using gin (tags);
create index references_mood_idx on public."references" using gin (mood);
create index references_lighting_idx on public."references" using gin (lighting);
create index references_phash_idx on public."references" (owner_id) where phash is not null;

create trigger references_set_updated_at
  before update on public."references"
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- people
-- ---------------------------------------------------------------------------
create table public.people (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) > 0)
);

create unique index people_owner_name_key on public.people (owner_id, lower(name));

create table public.reference_people (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  reference_id uuid not null references public."references" (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  role public.person_role not null,
  unique (reference_id, person_id, role)
);

create index reference_people_person_idx on public.reference_people (person_id);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (length(trim(name)) > 0),
  description text,
  is_active boolean not null default false
);

-- At most one active project per owner.
create unique index projects_one_active_idx on public.projects (owner_id) where is_active;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create table public.project_references (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  project_id uuid not null references public.projects (id) on delete cascade,
  reference_id uuid not null references public."references" (id) on delete cascade,
  -- Reserved for the future moodboard canvas.
  x numeric,
  y numeric,
  width numeric,
  height numeric,
  z_index integer not null default 0,
  caption text,
  unique (project_id, reference_id)
);

create index project_references_reference_idx on public.project_references (reference_id);

-- ---------------------------------------------------------------------------
-- vocabularies
-- ---------------------------------------------------------------------------
create table public.vocabularies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  category public.vocab_category not null,
  term text not null check (length(trim(term)) > 0),
  archived boolean not null default false,
  sort_order integer not null default 0
);

create unique index vocabularies_owner_category_term_key
  on public.vocabularies (owner_id, category, lower(term));

-- ---------------------------------------------------------------------------
-- prompts (schema only in Phase 1, no UI yet)
-- ---------------------------------------------------------------------------
create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  prompt_text text not null,             -- no length limit
  tool text,
  model text,
  type public.prompt_type,
  status public.prompt_status,
  params jsonb,
  origin public.prompt_origin not null default 'own',
  author text,
  source_url text,
  notes text,
  parent_prompt_id uuid references public.prompts (id) on delete set null
);

create index prompts_parent_idx on public.prompts (parent_prompt_id);

create trigger prompts_set_updated_at
  before update on public.prompts
  for each row execute function public.set_updated_at();

create table public.prompt_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  prompt_id uuid not null references public.prompts (id) on delete cascade,
  reference_id uuid references public."references" (id) on delete set null,
  storage_key text,
  role public.prompt_asset_role not null
);

create index prompt_assets_prompt_idx on public.prompt_assets (prompt_id);

create table public.prompt_references (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  prompt_id uuid not null references public.prompts (id) on delete cascade,
  reference_id uuid not null references public."references" (id) on delete cascade,
  unique (prompt_id, reference_id)
);

create index prompt_references_reference_idx on public.prompt_references (reference_id);
