-- Awen · 0002 · Row Level Security and grants
-- Every table: RLS enabled, no privileges for anon, only the privileges the app
-- needs for authenticated, and policies restricted to owner_id = auth.uid().
-- service_role (secret key) is used only by the daily cron safety net, which
-- needs to read and update references and read vocabularies.

-- ---------------------------------------------------------------------------
-- Enable RLS (explicit, even though automatic RLS is on)
-- ---------------------------------------------------------------------------
alter table public."references"       enable row level security;
alter table public.people             enable row level security;
alter table public.reference_people   enable row level security;
alter table public.projects           enable row level security;
alter table public.project_references enable row level security;
alter table public.vocabularies       enable row level security;
alter table public.prompts            enable row level security;
alter table public.prompt_assets      enable row level security;
alter table public.prompt_references  enable row level security;

-- ---------------------------------------------------------------------------
-- Grants: start from nothing, then grant the minimum to authenticated
-- ---------------------------------------------------------------------------
revoke all on
  public."references", public.people, public.reference_people, public.projects,
  public.project_references, public.vocabularies, public.prompts,
  public.prompt_assets, public.prompt_references
from anon, authenticated, public;

grant select, insert, update, delete on
  public."references", public.people, public.reference_people, public.projects,
  public.project_references, public.vocabularies, public.prompts,
  public.prompt_assets, public.prompt_references
to authenticated;

grant select, update on public."references" to service_role;
grant select on public.vocabularies to service_role;

-- ---------------------------------------------------------------------------
-- Owner tables: owner_id = auth.uid()
-- ---------------------------------------------------------------------------
create policy references_owner_all on public."references"
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy people_owner_all on public.people
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy projects_owner_all on public.projects
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy vocabularies_owner_all on public.vocabularies
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy prompts_owner_all on public.prompts
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
-- (No parent_prompt_id ownership check here: a self-referencing subquery in a
-- prompts policy recurses. Prompts are single-owner, and the FK guarantees existence.)

-- ---------------------------------------------------------------------------
-- Join tables: owner_id = auth.uid(), and every linked row must be owned too
-- ---------------------------------------------------------------------------
create policy reference_people_owner_all on public.reference_people
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public."references" r where r.id = reference_id and r.owner_id = (select auth.uid()))
    and exists (select 1 from public.people p where p.id = person_id and p.owner_id = (select auth.uid()))
  );

create policy project_references_owner_all on public.project_references
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
    and exists (select 1 from public."references" r where r.id = reference_id and r.owner_id = (select auth.uid()))
  );

create policy prompt_assets_owner_all on public.prompt_assets
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.prompts p where p.id = prompt_id and p.owner_id = (select auth.uid()))
    and (
      reference_id is null
      or exists (select 1 from public."references" r where r.id = reference_id and r.owner_id = (select auth.uid()))
    )
  );

create policy prompt_references_owner_all on public.prompt_references
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.prompts p where p.id = prompt_id and p.owner_id = (select auth.uid()))
    and exists (select 1 from public."references" r where r.id = reference_id and r.owner_id = (select auth.uid()))
  );
