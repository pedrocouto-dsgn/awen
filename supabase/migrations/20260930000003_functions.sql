-- Awen · 0003 · Functions: full-text search, analysis queue, search, duplicates,
-- active project, vocabulary seed.
-- All functions are SECURITY INVOKER (RLS applies) with an empty search_path.
--
-- Reference lifecycle:
--   pending (analyzed_at is null, media_ready)  -> waiting for AI analysis
--   analyzing                                  -> claimed by a worker
--   pending (analyzed_at is not null)          -> waiting for review
--   approved | rejected                        -> reviewed
--   failed                                     -> analysis gave up (retry available)
-- Link-only items without media (media_ready = false) skip analysis and go straight to review.

-- ---------------------------------------------------------------------------
-- Full-text search vector (description, tags, notes and other text fields)
-- ---------------------------------------------------------------------------
create or replace function public.references_search_tsv()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('english'::regconfig, coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(array_to_string(new.tags, ' '), '')), 'A') ||
    setweight(to_tsvector('english'::regconfig,
      concat_ws(' ', new.description, new.subject, new.visual_style, new.setting, new.era, new.texture_grain)), 'B') ||
    setweight(to_tsvector('english'::regconfig,
      concat_ws(' ', new.shot_type, new.camera_angle, new.camera_movement,
        array_to_string(new.mood, ' '), array_to_string(new.lighting, ' '))), 'C') ||
    -- Notes may be written in Portuguese: index them without English stemming too.
    setweight(to_tsvector('simple'::regconfig, coalesce(new.notes, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(new.notes, '')), 'B');
  return new;
end;
$$;

create trigger references_search_tsv_trg
  before insert or update of title, tags, description, subject, visual_style, setting, era,
    texture_grain, shot_type, camera_angle, camera_movement, mood, lighting, notes
  on public."references"
  for each row execute function public.references_search_tsv();

-- ---------------------------------------------------------------------------
-- Analysis queue: atomically claim the next due item.
-- Also reclaims items stuck in "analyzing" for more than 5 minutes.
-- ---------------------------------------------------------------------------
create or replace function public.claim_next_analysis()
returns setof public."references"
language sql
volatile
security invoker
set search_path = ''
as $$
  update public."references" r
  set status = 'analyzing',
      analyzing_since = now(),
      analysis_attempts = r.analysis_attempts + 1
  where r.id = (
    select c.id
    from public."references" c
    where c.media_ready
      and c.analyzed_at is null
      and (
        (c.status = 'pending' and (c.next_attempt_at is null or c.next_attempt_at <= now()))
        or (c.status = 'analyzing' and c.analyzing_since < now() - interval '5 minutes')
      )
    order by c.created_at
    for update skip locked
    limit 1
  )
  returning r.*;
$$;

-- Counters for the header badge and the worker loop.
create or replace function public.queue_stats()
returns table (
  queued bigint,
  analyzing bigint,
  to_review bigint,
  failed bigint,
  next_due timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*) filter (where status = 'pending' and analyzed_at is null and media_ready
                       and (next_attempt_at is null or next_attempt_at <= now())),
    count(*) filter (where status = 'analyzing'),
    count(*) filter (where status = 'pending' and (analyzed_at is not null or not media_ready)),
    count(*) filter (where status = 'failed'),
    min(next_attempt_at) filter (where status = 'pending' and analyzed_at is null and media_ready
                                   and next_attempt_at > now())
  from public."references";
$$;

-- ---------------------------------------------------------------------------
-- Library search: full text + combinable filters + nearest palette color.
-- Empty arrays and nulls mean "no filter". Color distance is CIE76 (ΔE in Lab),
-- the minimum across palette colors covering at least 3% of the image.
-- ---------------------------------------------------------------------------
create or replace function public.search_references(
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
  p_status public.reference_status default 'approved'
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
  )
  select r.*
  from public."references" r
  cross join q
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
    and (q.tsq is null or r.search_tsv @@ q.tsq)
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
  order by
    c.distance asc nulls last,
    case when q.tsq is null then 0 else ts_rank(r.search_tsv, q.tsq) end desc,
    r.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Duplicate detection: perceptual hash Hamming distance
-- ---------------------------------------------------------------------------
create or replace function public.find_near_duplicates(
  p_phash text,
  p_max_distance integer default 8,
  p_exclude uuid default null
)
returns table (
  id uuid,
  distance integer,
  status public.reference_status,
  thumbnail_key text,
  title text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select d.id, d.distance, d.status, d.thumbnail_key, d.title
  from (
    select r.id, r.status, r.thumbnail_key, r.title,
      bit_count(('x' || r.phash)::bit(64) # ('x' || p_phash)::bit(64))::integer as distance
    from public."references" r
    where r.phash is not null
      and p_phash ~ '^[0-9a-f]{16}$'
      and r.status <> 'rejected'
      and (p_exclude is null or r.id <> p_exclude)
  ) d
  where d.distance <= p_max_distance
  order by d.distance
  limit 5;
$$;

-- ---------------------------------------------------------------------------
-- Projects: mark one project active (or clear it) in a single transaction
-- ---------------------------------------------------------------------------
create or replace function public.set_active_project(p_project_id uuid, p_active boolean default true)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_active then
    update public.projects set is_active = false where is_active and id <> p_project_id;
  end if;
  update public.projects set is_active = p_active where id = p_project_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vocabulary seed: vocabularies are per owner, so they are seeded on first use
-- for the signed-in user. It is idempotent and does nothing if terms already exist.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_vocabularies()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from public.vocabularies where owner_id = v_uid) then
    return 0;
  end if;

  insert into public.vocabularies (owner_id, category, term, sort_order)
  select v_uid, s.category::public.vocab_category, t.term, t.ord::integer
  from (values
    ('shot_type', array['extreme close-up', 'close-up', 'medium close-up', 'medium', 'medium wide',
                        'wide', 'extreme wide', 'insert', 'over-the-shoulder', 'POV', 'top shot']),
    ('camera_angle', array['eye level', 'low angle', 'high angle', 'dutch angle', 'overhead']),
    ('camera_movement', array['static', 'handheld', 'dolly in', 'dolly out', 'tracking', 'pan', 'tilt',
                              'crane', 'drone', 'orbit', 'whip pan', 'zoom', 'steadicam']),
    ('lighting', array['hard light', 'soft light', 'backlight', 'rim light', 'low key', 'high key',
                       'golden hour', 'blue hour', 'neon', 'practical', 'silhouette']),
    ('mood', array['melancholic', 'tense', 'serene', 'epic', 'intimate', 'eerie', 'nostalgic',
                   'energetic', 'raw', 'dreamlike', 'cold', 'warm'])
  ) as s (category, terms)
  cross join lateral unnest(s.terms) with ordinality as t (term, ord)
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: Supabase grants EXECUTE to anon by default. Revoke it.
-- ---------------------------------------------------------------------------
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.references_search_tsv() from public, anon, authenticated;

revoke execute on function public.claim_next_analysis() from public, anon;
revoke execute on function public.queue_stats() from public, anon;
revoke execute on function public.search_references(
  text, text[], text[], text[], numeric, numeric, uuid, uuid, public.reference_type,
  public.source_kind[], timestamptz, timestamptz, smallint, double precision[], double precision,
  public.reference_status) from public, anon;
revoke execute on function public.find_near_duplicates(text, integer, uuid) from public, anon;
revoke execute on function public.set_active_project(uuid, boolean) from public, anon;
revoke execute on function public.ensure_vocabularies() from public, anon;

grant execute on function public.claim_next_analysis() to authenticated, service_role;
grant execute on function public.queue_stats() to authenticated;
grant execute on function public.search_references(
  text, text[], text[], text[], numeric, numeric, uuid, uuid, public.reference_type,
  public.source_kind[], timestamptz, timestamptz, smallint, double precision[], double precision,
  public.reference_status) to authenticated;
grant execute on function public.find_near_duplicates(text, integer, uuid) to authenticated;
grant execute on function public.set_active_project(uuid, boolean) to authenticated;
grant execute on function public.ensure_vocabularies() to authenticated;
