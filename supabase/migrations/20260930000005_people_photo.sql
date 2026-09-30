-- Awen · 0005 · Artist photo (banner on the artist page)
-- The image lives in R2 under {owner_id}/people/{person_id}/; only the key is stored here.
-- Existing RLS policies on public.people (owner_id = auth.uid()) already cover the new column.

alter table public.people
  add column photo_key text check (photo_key is null or length(photo_key) <= 300);
