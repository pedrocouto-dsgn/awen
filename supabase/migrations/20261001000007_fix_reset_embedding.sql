-- Awen · 0007 · Fix reset_embedding (0006)
-- The trigger runs with an empty search_path, so the pgvector "=" operator (in the
-- extensions schema) was not found and every UPDATE on references failed.
-- Comparing the text form uses a cast, which does not depend on the search_path.

create or replace function public.reset_embedding()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.embedding::text is not distinct from old.embedding::text
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
