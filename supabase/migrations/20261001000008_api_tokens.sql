-- Awen · 0008 · Personal API tokens (Chrome extension)
-- The token itself is shown once and never stored: only its SHA-256 hash.
-- The extension has no Supabase session, so its requests run server-side with the
-- secret key, scoped to the token's owner in code (lib/ext). service_role gets only
-- the extra privileges those requests need.

create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 60),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- First characters of the token, to tell tokens apart in the list.
  token_prefix text not null check (length(token_prefix) <= 16),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index api_tokens_owner_idx on public.api_tokens (owner_id, created_at desc);

alter table public.api_tokens enable row level security;

revoke all on public.api_tokens from anon, authenticated, public;
grant select, insert, delete on public.api_tokens to authenticated;
grant update (name, revoked_at) on public.api_tokens to authenticated;
grant select, update (last_used_at) on public.api_tokens to service_role;

create policy api_tokens_owner_all on public.api_tokens
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Extension requests: create references (and drop one whose upload is not a readable
-- image), and add them to the active project.
grant insert, delete on public."references" to service_role;
grant select on public.projects to service_role;
grant select, insert on public.project_references to service_role;
