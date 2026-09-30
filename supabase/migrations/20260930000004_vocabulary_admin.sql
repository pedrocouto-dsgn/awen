-- Awen · 0004 · Vocabulary administration (Settings screen)
-- rename_vocab_term: renames a term and updates every reference that uses it.
-- reorder_vocabulary: sets the display order of a category in one call.
-- Both are SECURITY INVOKER: RLS limits them to the caller's own rows.

create or replace function public.rename_vocab_term(p_id uuid, p_term text)
returns public.vocabularies
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old public.vocabularies;
  v_new public.vocabularies;
  v_term text := btrim(regexp_replace(p_term, '\s+', ' ', 'g'));
begin
  if v_term = '' or length(v_term) > 60 then
    raise exception 'invalid term' using errcode = '22023';
  end if;

  select * into v_old from public.vocabularies where id = p_id;
  if not found then
    raise exception 'term not found' using errcode = 'P0002';
  end if;

  update public.vocabularies set term = v_term where id = p_id returning * into v_new;

  if v_old.term is distinct from v_term then
    case v_old.category
      when 'shot_type' then
        update public."references" set shot_type = v_term where shot_type = v_old.term;
      when 'camera_angle' then
        update public."references" set camera_angle = v_term where camera_angle = v_old.term;
      when 'camera_movement' then
        update public."references" set camera_movement = v_term where camera_movement = v_old.term;
      when 'lighting' then
        update public."references" set lighting = array_replace(lighting, v_old.term, v_term)
        where v_old.term = any (lighting);
      when 'mood' then
        update public."references" set mood = array_replace(mood, v_old.term, v_term)
        where v_old.term = any (mood);
    end case;
  end if;

  return v_new;
end;
$$;

create or replace function public.reorder_vocabulary(p_category public.vocab_category, p_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.vocabularies v
  set sort_order = o.ord
  from unnest(p_ids) with ordinality as o (id, ord)
  where v.id = o.id and v.category = p_category;
$$;

revoke execute on function public.rename_vocab_term(uuid, text) from public, anon;
revoke execute on function public.reorder_vocabulary(public.vocab_category, uuid[]) from public, anon;
grant execute on function public.rename_vocab_term(uuid, text) to authenticated;
grant execute on function public.reorder_vocabulary(public.vocab_category, uuid[]) to authenticated;
