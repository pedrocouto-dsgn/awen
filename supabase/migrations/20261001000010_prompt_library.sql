-- Awen · 0010 · Prompt library (M12)
-- A prompt entry is the text plus what it generated (result) and what went in
-- (inputs). Its files live in R2 under {owner}/prompts/{promptId}/ and are not
-- references: they skip analysis and review and stay out of the library feed.
-- An input can also point at an existing reference instead of a file.
-- Versions chain through prompts.parent_prompt_id (0001); the newest version of
-- a chain is the one nobody points at.

-- ---------------------------------------------------------------------------
-- prompts: title, tags, version note, template flag, full-text search
-- ---------------------------------------------------------------------------
alter table public.prompts
  add column title text check (title is null or length(title) <= 200),
  add column tags text[] not null default '{}',
  -- What changed from the parent version (v2, v3…).
  add column version_note text,
  -- A template has {variables} to fill in; it is listed apart from regular prompts.
  add column is_template boolean not null default false,
  add column search_tsv tsvector;

create index prompts_search_idx on public.prompts using gin (search_tsv);
create index prompts_owner_updated_idx on public.prompts (owner_id, updated_at desc);
create index prompts_tags_idx on public.prompts using gin (tags);

create or replace function public.prompts_search_tsv()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('english'::regconfig, coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(array_to_string(new.tags, ' '), '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, concat_ws(' ', new.tool, new.model, new.author)), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(new.prompt_text, '')), 'B') ||
    -- Notes may be written in Portuguese: index them without English stemming too.
    setweight(to_tsvector('simple'::regconfig, concat_ws(' ', new.notes, new.version_note)), 'C') ||
    setweight(to_tsvector('english'::regconfig, concat_ws(' ', new.notes, new.version_note)), 'C');
  return new;
end;
$$;

create trigger prompts_search_tsv_trg
  before insert or update of title, tags, tool, model, author, prompt_text, notes, version_note
  on public.prompts
  for each row execute function public.prompts_search_tsv();

-- Fill the vector for any rows that already exist.
update public.prompts set title = title;

-- ---------------------------------------------------------------------------
-- prompt_assets: file metadata, preview and order
-- ---------------------------------------------------------------------------
alter table public.prompt_assets
  add column kind public.reference_type,
  add column mime_type text,
  add column width integer,
  add column height integer,
  add column duration numeric,
  add column file_size bigint,
  add column thumbnail_key text,
  add column palette jsonb,
  add column sort_order integer not null default 0,
  -- False until the browser finishes uploading the file to R2.
  add column media_ready boolean not null default false;

-- An asset is a file or a reference, never neither.
alter table public.prompt_assets
  add constraint prompt_assets_source_check check (storage_key is not null or reference_id is not null);

create index prompt_assets_reference_idx on public.prompt_assets (reference_id) where reference_id is not null;

-- ---------------------------------------------------------------------------
-- prompt_projects: projects a prompt was used in
-- ---------------------------------------------------------------------------
create table public.prompt_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  prompt_id uuid not null references public.prompts (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  unique (prompt_id, project_id)
);

create index prompt_projects_project_idx on public.prompt_projects (project_id);

alter table public.prompt_projects enable row level security;
revoke all on public.prompt_projects from anon, authenticated, public;
grant select, insert, delete on public.prompt_projects to authenticated;

create policy prompt_projects_owner_all on public.prompt_projects
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.prompts p where p.id = prompt_id and p.owner_id = (select auth.uid()))
    and exists (select 1 from public.projects j where j.id = project_id and j.owner_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- prompt_blocks: reusable pieces (lighting setup, camera system, materials…)
-- ---------------------------------------------------------------------------
create table public.prompt_blocks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 80),
  category text check (category is null or length(category) <= 40),
  body text not null
);

create index prompt_blocks_owner_idx on public.prompt_blocks (owner_id, category, name);

create trigger prompt_blocks_set_updated_at
  before update on public.prompt_blocks
  for each row execute function public.set_updated_at();

alter table public.prompt_blocks enable row level security;
revoke all on public.prompt_blocks from anon, authenticated, public;
grant select, insert, update, delete on public.prompt_blocks to authenticated;

create policy prompt_blocks_owner_all on public.prompt_blocks
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Prompt search: full text + filters. Empty values mean "no filter".
-- By default only the newest version of each chain is listed.
-- ---------------------------------------------------------------------------
create or replace function public.search_prompts(
  p_query text default null,
  p_tool text default null,
  p_model text default null,
  p_type public.prompt_type default null,
  p_status public.prompt_status default null,
  p_origin public.prompt_origin default null,
  p_project_id uuid default null,
  p_tag text default null,
  p_templates boolean default false,
  p_latest_only boolean default true
)
returns setof public.prompts
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select case
      when nullif(trim(coalesce(p_query, '')), '') is null then null::tsquery
      else websearch_to_tsquery('english'::regconfig, p_query)
        || websearch_to_tsquery('simple'::regconfig, p_query)
    end as tsq
  )
  select p.*
  from public.prompts p
  cross join q
  where p.is_template = coalesce(p_templates, false)
    and (q.tsq is null or p.search_tsv @@ q.tsq)
    and (p_tool is null or p.tool = p_tool)
    and (p_model is null or p.model = p_model)
    and (p_type is null or p.type = p_type)
    and (p_status is null or p.status = p_status)
    and (p_origin is null or p.origin = p_origin)
    and (p_tag is null or p.tags @> array[p_tag])
    and (p_project_id is null or exists (
      select 1 from public.prompt_projects pp where pp.prompt_id = p.id and pp.project_id = p_project_id))
    and (not p_latest_only or not exists (
      select 1 from public.prompts c where c.parent_prompt_id = p.id))
  order by
    case when q.tsq is null then 0 else ts_rank(p.search_tsv, q.tsq) end desc,
    p.updated_at desc;
$$;

revoke execute on function public.search_prompts from public, anon;
grant execute on function public.search_prompts to authenticated;

-- Tool and model names already used, for autocomplete next to the default lists.
create or replace function public.prompt_tool_names()
returns table (field text, name text, uses bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select 'tool', p.tool, count(*) from public.prompts p where p.tool is not null group by p.tool
  union all
  select 'model', p.model, count(*) from public.prompts p where p.model is not null group by p.model
  order by 3 desc;
$$;

revoke execute on function public.prompt_tool_names from public, anon;
grant execute on function public.prompt_tool_names to authenticated;
