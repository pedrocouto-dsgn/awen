-- Awen · 0009 · Natural-language and similar-image search (M11)
-- Query vectors live in search_queries, so the library URL only carries an id:
--   ?q=…        text query; its vector is cached per owner + model + text
--   ?imagem=id  an image dropped on the search box (vector + small preview)
--   ?parecida=id  neighbours of an existing reference (uses its own vector)
-- pgvector lives in the "extensions" schema (see 0001); functions with an empty
-- search_path qualify its type and operator.

create table public.search_queries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('text', 'image')),
  -- Normalized query text (kind = 'text'), the cache key.
  text_key text check (text_key is null or length(text_key) <= 200),
  model text not null,
  embedding extensions.vector(768) not null,
  -- Small JPEG data URL of the dropped image (kind = 'image'), shown in the search chip.
  preview text check (preview is null or length(preview) <= 40000),
  check ((kind = 'text') = (text_key is not null))
);

create unique index search_queries_text_idx on public.search_queries (owner_id, model, text_key) where kind = 'text';
create index search_queries_owner_idx on public.search_queries (owner_id, created_at);

alter table public.search_queries enable row level security;

revoke all on public.search_queries from anon, authenticated, public;
grant select, insert, delete on public.search_queries to authenticated;

create policy search_queries_owner_all on public.search_queries
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Library search, now with a vector mode. Same filters as before (0003), plus:
--   p_query_vector  search_queries.id: rank by distance to that vector
--   p_similar_to    reference id: rank by distance to its vector (itself excluded)
-- With a vector, a row is kept when its distance is under p_max_distance and
-- within p_distance_margin of the best match (distances bunch up, so a fixed
-- threshold alone lets weak matches through). A text query keeps exact
-- full-text matches too, which also covers references not embedded yet.
-- The library is small (hundreds to a few thousand rows), so an exact scan is
-- fine and combines freely with the filters; the HNSW index is not needed here.
-- ---------------------------------------------------------------------------
drop function public.search_references(
  text, text[], text[], text[], numeric, numeric, uuid, uuid, public.reference_type,
  public.source_kind[], timestamptz, timestamptz, smallint, double precision[], double precision,
  public.reference_status
);

create function public.search_references(
  p_query text default null,
  p_shot_types text[] default null,
  p_moods text[] default null,
  p_lighting text[] default null,
  p_aspect_min numeric default null,
  p_aspect_max numeric default null,
  p_person_id uuid default null,
  p_project_id uuid default null,
  p_type public.reference_type default null,
  p_source_kinds public.source_kind[] default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_min_rating smallint default null,
  p_color_lab double precision[] default null,
  p_color_max_distance double precision default 30,
  p_status public.reference_status default 'approved',
  p_query_vector uuid default null,
  p_similar_to uuid default null,
  p_embedding_model text default null,
  p_max_distance double precision default 0.65,
  p_distance_margin double precision default 0.05
)
returns setof public."references"
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
    select coalesce(
      (select sq.embedding from public.search_queries sq
        where sq.id = p_query_vector and sq.model = p_embedding_model),
      (select s.embedding from public."references" s
        where s.id = p_similar_to and s.embedding_model = p_embedding_model)
    ) as vec,
    -- A vector was asked for, even if it is missing: then nothing matches by vector.
    (p_query_vector is not null or p_similar_to is not null) as wanted
  ),
  filtered as (
    select r.id, r.created_at,
      case when v.vec is not null and r.embedding_model = p_embedding_model
        then r.embedding operator(extensions.<=>) v.vec
      end as vec_distance,
      q.tsq is not null and r.search_tsv @@ q.tsq as text_match,
      case when q.tsq is null then 0 else ts_rank(r.search_tsv, q.tsq) end as text_rank,
      c.distance as color_distance
    from public."references" r
    cross join q
    cross join v
    left join lateral (
      select min(sqrt(
        power((e -> 'lab' ->> 0)::double precision - p_color_lab[1], 2) +
        power((e -> 'lab' ->> 1)::double precision - p_color_lab[2], 2) +
        power((e -> 'lab' ->> 2)::double precision - p_color_lab[3], 2)
      )) as distance
      from jsonb_array_elements(coalesce(r.palette, '[]'::jsonb)) e
      where coalesce((e ->> 'pct')::double precision, 0) >= 3
    ) c on p_color_lab is not null and cardinality(p_color_lab) = 3
    where r.status = p_status
      and (p_similar_to is null or r.id <> p_similar_to)
      and (p_shot_types is null or cardinality(p_shot_types) = 0 or r.shot_type = any (p_shot_types))
      and (p_moods is null or cardinality(p_moods) = 0 or r.mood && p_moods)
      and (p_lighting is null or cardinality(p_lighting) = 0 or r.lighting && p_lighting)
      and (p_aspect_min is null or r.aspect_ratio >= p_aspect_min)
      and (p_aspect_max is null or r.aspect_ratio < p_aspect_max)
      and (p_person_id is null or exists (
        select 1 from public.reference_people rp where rp.reference_id = r.id and rp.person_id = p_person_id))
      and (p_project_id is null or exists (
        select 1 from public.project_references pr where pr.reference_id = r.id and pr.project_id = p_project_id))
      and (p_type is null or r.type = p_type)
      and (p_source_kinds is null or cardinality(p_source_kinds) = 0 or r.source_kind = any (p_source_kinds))
      and (p_date_from is null or r.created_at >= p_date_from)
      and (p_date_to is null or r.created_at < p_date_to)
      and (p_min_rating is null or r.rating >= p_min_rating)
      and (p_color_lab is null or c.distance <= p_color_max_distance)
  ),
  ranked as (
    select f.id, f.created_at, f.vec_distance, f.text_match, f.text_rank, f.color_distance,
      min(f.vec_distance) over () as best_distance
    from filtered f
  ),
  kept as (
    select x.*
    from ranked x
    cross join v
    cross join q
    where
      case
        -- Vector search: close enough, and not far behind the best match. A text
        -- query also keeps its exact full-text matches.
        when v.wanted then
          (x.vec_distance <= p_max_distance and x.vec_distance <= x.best_distance + p_distance_margin)
          or x.text_match
        when q.tsq is not null then x.text_match
        else true
      end
  )
  select r.*
  from kept k
  join public."references" r on r.id = k.id
  order by
    -- Exact text matches get a small head start over pure vector matches.
    k.vec_distance - case when k.text_match then 0.05 else 0 end asc nulls last,
    k.color_distance asc nulls last,
    k.text_rank desc,
    k.created_at desc;
$$;

revoke execute on function public.search_references from public, anon;
grant execute on function public.search_references to authenticated;
