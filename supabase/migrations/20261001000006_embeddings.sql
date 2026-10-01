-- Awen · 0006 · Embeddings for semantic and similar-image search
-- One multimodal vector per approved reference (image + curated text), in the
-- existing references.embedding vector(768) column. A NULL embedding, or one made
-- by another model, means "needs embedding"; the analysis worker fills it in.
-- Existing RLS policies on public."references" (owner_id = auth.uid()) cover the new columns.

alter table public."references"
  add column embedding_model text,
  add column embedded_at timestamptz,
  -- Last failed attempt; failed rows wait before being retried and go to the back of the line.
  add column embedding_attempted_at timestamptz;

-- Approving a reference, or editing the text that feeds its vector, invalidates the vector.
-- Updates that write the embedding itself are left alone.
create or replace function public.reset_embedding()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.embedding is not distinct from old.embedding
     and new.status = 'approved'
     and (
       old.status is distinct from 'approved'
       or new.title is distinct from old.title
       or new.description is distinct from old.description
       or new.subject is distinct from old.subject
       or new.setting is distinct from old.setting
       or new.era is distinct from old.era
       or new.visual_style is distinct from old.visual_style
       or new.texture_grain is distinct from old.texture_grain
       or new.shot_type is distinct from old.shot_type
       or new.camera_angle is distinct from old.camera_angle
       or new.camera_movement is distinct from old.camera_movement
       or new.lighting is distinct from old.lighting
       or new.mood is distinct from old.mood
       or new.tags is distinct from old.tags
       or new.notes is distinct from old.notes
       or new.thumbnail_key is distinct from old.thumbnail_key
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

create trigger references_reset_embedding
  before update on public."references"
  for each row execute function public.reset_embedding();

-- Next approved references whose vector is missing or was made by another model.
-- Returns only the columns needed to build the embedding input.
create or replace function public.next_embedding_batch(p_model text, p_limit integer default 8)
returns table (
  id uuid,
  thumbnail_key text,
  title text,
  description text,
  subject text,
  setting text,
  era text,
  visual_style text,
  texture_grain text,
  shot_type text,
  camera_angle text,
  camera_movement text,
  lighting text[],
  mood text[],
  tags text[],
  notes text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.id, r.thumbnail_key, r.title, r.description, r.subject, r.setting, r.era,
         r.visual_style, r.texture_grain, r.shot_type, r.camera_angle, r.camera_movement,
         r.lighting, r.mood, r.tags, r.notes
  from public."references" r
  where r.status = 'approved'
    and (r.embedding is null or r.embedding_model is distinct from p_model)
    and (r.embedding_attempted_at is null or r.embedding_attempted_at < now() - interval '6 hours')
  order by r.embedding_attempted_at nulls first, r.created_at
  limit least(greatest(p_limit, 1), 32);
$$;

revoke execute on function public.next_embedding_batch(text, integer) from public, anon;
grant execute on function public.next_embedding_batch(text, integer) to authenticated, service_role;

-- Cosine-distance index for nearest-neighbour search (M11). The opclass lives in
-- the schema where pgvector is installed, like the column in 0001.
do $$
declare
  v_schema text;
begin
  select n.nspname into v_schema
  from pg_extension e join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'vector';

  execute format(
    'create index references_embedding_idx on public."references" using hnsw (embedding %I.vector_cosine_ops)',
    v_schema
  );
end;
$$;
