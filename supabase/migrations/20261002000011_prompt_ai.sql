-- Awen · 0011 · Prompt analysis, sections and semantic search (M12c)
-- The AI reads a prompt (text + first result) and returns suggested tags and the
-- prompt split into sections (camera, lighting, style…), copied from the text, never
-- rewritten. Each prompt also gets one image+text vector for search by meaning.
-- Both run in the same background worker as reference analysis.

alter table public.prompts
  -- Model output: { model, analyzed_at, suggested_tags[], sections{} }.
  add column ai jsonb,
  -- Sections of the text, by key (subject, setting, camera, lighting, style, motion, audio).
  add column sections jsonb,
  add column analyzed_at timestamptz,
  -- Last failed attempt: failed rows wait before being retried and go to the back of the line.
  add column analysis_attempted_at timestamptz,
  add column analysis_error text,
  add column embedding extensions.vector(768),
  add column embedding_model text,
  add column embedded_at timestamptz,
  add column embedding_attempted_at timestamptz;

-- Editing the text asks for a new analysis; editing anything that feeds the vector
-- asks for a new vector. Updates that write the analysis or the vector themselves
-- are left alone (the text compare avoids pgvector operators, see 0007).
create or replace function public.prompts_reset_ai()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.prompt_text is distinct from old.prompt_text and new.analyzed_at is not distinct from old.analyzed_at then
    new.analyzed_at := null;
    new.analysis_attempted_at := null;
    new.analysis_error := null;
  end if;

  if new.embedding::text is not distinct from old.embedding::text
     and (
       new.prompt_text is distinct from old.prompt_text
       or new.title is distinct from old.title
       or new.tags is distinct from old.tags
       or new.notes is distinct from old.notes
       or new.sections is distinct from old.sections
       or new.tool is distinct from old.tool
       or new.model is distinct from old.model
     )
  then
    new.embedding := null;
    new.embedding_model := null;
    new.embedded_at := null;
    new.embedding_attempted_at := null;
  end if;
  return new;
end;
$$;

create trigger prompts_reset_ai_trg
  before update on public.prompts
  for each row execute function public.prompts_reset_ai();

-- A new result can change what the analysis and the vector see.
create or replace function public.prompt_assets_reset_ai()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_prompt uuid := coalesce(new.prompt_id, old.prompt_id);
  v_role public.prompt_asset_role := coalesce(new.role, old.role);
begin
  if v_role = 'result' then
    update public.prompts
    set analyzed_at = null, analysis_attempted_at = null, analysis_error = null,
        embedding = null, embedding_model = null, embedded_at = null, embedding_attempted_at = null
    where id = v_prompt;
  end if;
  return null;
end;
$$;

create trigger prompt_assets_reset_ai_trg
  after insert or delete or update of media_ready on public.prompt_assets
  for each row execute function public.prompt_assets_reset_ai();

create index prompts_needs_analysis_idx on public.prompts (owner_id, analysis_attempted_at nulls first)
  where analyzed_at is null;

do $$
begin
  execute 'create index prompts_embedding_idx on public.prompts using hnsw (embedding extensions.vector_cosine_ops)';
end;
$$;

-- Next prompts to analyze, oldest first. Waits for result uploads to finish, so the
-- analysis sees the image (a prompt with no result at all is analyzed from its text).
create or replace function public.next_prompt_analysis(p_limit integer default 1)
returns setof public.prompts
language sql
stable
security invoker
set search_path = ''
as $$
  select p.*
  from public.prompts p
  where p.analyzed_at is null
    and (p.analysis_attempted_at is null or p.analysis_attempted_at < now() - interval '6 hours')
    and not exists (
      select 1 from public.prompt_assets a
      where a.prompt_id = p.id and a.role = 'result' and not a.media_ready
    )
  order by p.analysis_attempted_at nulls first, p.created_at
  limit least(greatest(p_limit, 1), 10);
$$;

-- Next prompts whose vector is missing or was made by another model.
create or replace function public.next_prompt_embedding(p_model text, p_limit integer default 8)
returns setof public.prompts
language sql
stable
security invoker
set search_path = ''
as $$
  select p.*
  from public.prompts p
  where (p.embedding is null or p.embedding_model is distinct from p_model)
    and (p.embedding_attempted_at is null or p.embedding_attempted_at < now() - interval '6 hours')
    and not exists (
      select 1 from public.prompt_assets a
      where a.prompt_id = p.id and a.role = 'result' and not a.media_ready
    )
  order by p.embedding_attempted_at nulls first, p.created_at
  limit least(greatest(p_limit, 1), 32);
$$;

revoke execute on function public.next_prompt_analysis(integer) from public, anon;
revoke execute on function public.next_prompt_embedding(text, integer) from public, anon;
grant execute on function public.next_prompt_analysis(integer) to authenticated, service_role;
grant execute on function public.next_prompt_embedding(text, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Prompt search: as in 0010, plus search by meaning and search inside one section.
--   p_query_vector  search_queries.id of the text query: rank by meaning, keep
--                   exact full-text matches too (and prompts not embedded yet)
--   p_section       only look for the words in that section of the text
-- ---------------------------------------------------------------------------
drop function public.search_prompts(
  text, text, text, public.prompt_type, public.prompt_status, public.prompt_origin, uuid, text, boolean, boolean
);

create function public.search_prompts(
  p_query text default null,
  p_tool text default null,
  p_model text default null,
  p_type public.prompt_type default null,
  p_status public.prompt_status default null,
  p_origin public.prompt_origin default null,
  p_project_id uuid default null,
  p_tag text default null,
  p_templates boolean default false,
  p_latest_only boolean default true,
  p_section text default null,
  p_query_vector uuid default null,
  p_embedding_model text default null,
  p_max_distance double precision default 0.65,
  p_distance_margin double precision default 0.05
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
  ),
  v as (
    select (select sq.embedding from public.search_queries sq
            where sq.id = p_query_vector and sq.model = p_embedding_model) as vec
  ),
  filtered as (
    select p.id, p.updated_at,
      case when v.vec is not null and p_section is null and p.embedding_model = p_embedding_model
        then p.embedding operator(extensions.<=>) v.vec
      end as vec_distance,
      case
        when q.tsq is null then false
        when p_section is not null then
          to_tsvector('english'::regconfig, coalesce(p.sections ->> p_section, '')) @@ q.tsq
          or to_tsvector('simple'::regconfig, coalesce(p.sections ->> p_section, '')) @@ q.tsq
        else p.search_tsv @@ q.tsq
      end as text_match,
      case when q.tsq is null then 0 else ts_rank(p.search_tsv, q.tsq) end as text_rank
    from public.prompts p
    cross join q
    cross join v
    where p.is_template = coalesce(p_templates, false)
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
      -- A section filter without words lists the prompts that have that section.
      and (p_section is null or q.tsq is not null or nullif(trim(p.sections ->> p_section), '') is not null)
  ),
  ranked as (
    select f.*, min(f.vec_distance) over () as best_distance from filtered f
  ),
  kept as (
    select x.*
    from ranked x
    cross join q
    where
      case
        when q.tsq is null then true
        when x.vec_distance is not null then
          (x.vec_distance <= p_max_distance and x.vec_distance <= x.best_distance + p_distance_margin)
          or x.text_match
        else x.text_match
      end
  )
  select p.*
  from kept k
  join public.prompts p on p.id = k.id
  order by
    k.vec_distance - case when k.text_match then 0.05 else 0 end asc nulls last,
    k.text_rank desc,
    k.updated_at desc;
$$;

revoke execute on function public.search_prompts from public, anon;
grant execute on function public.search_prompts to authenticated;

-- ---------------------------------------------------------------------------
-- service_role: the daily cron analyzes prompts for every user, and the Chrome
-- extension saves a prompt with its result (both without a user session).
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.prompts to service_role;
grant select, insert, update, delete on public.prompt_assets to service_role;
grant select on public.search_queries to service_role;
