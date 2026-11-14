-- Martian Map (LAIKA II) — tablas de misiones y puntuaciones. Parte B, tarea B2.
-- Cada persona entra con sesión anónima; la seguridad por filas hace que solo vea y cambie
-- sus propias misiones. Las puntuaciones las lee cualquiera, pero cada quien inserta las suyas.

-- ---------- Misiones ----------

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '',
  data jsonb not null,               -- state.mission + state.clock, tal cual
  updated_at timestamptz not null default now()
);

create index missions_owner_updated_idx on public.missions (owner, updated_at desc);

alter table public.missions enable row level security;

create policy "misiones propias" on public.missions
  for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

-- ---------- Puntuaciones ----------

create table public.scores (
  id bigint generated always as identity primary key,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  game text not null check (char_length(game) between 1 and 32),
  alias text not null check (char_length(alias) between 1 and 16),
  points integer not null check (points >= 0),
  created_at timestamptz not null default now()
);

create index scores_game_points_idx on public.scores (game, points desc);

alter table public.scores enable row level security;

create policy "leer puntuaciones" on public.scores
  for select to anon, authenticated
  using (true);

create policy "insertar propias" on public.scores
  for insert to authenticated
  with check (owner = (select auth.uid()));

-- ---------- Permisos ----------
-- Explícitos, para no depender de los permisos por defecto del proyecto.
-- Las sesiones anónimas usan el rol `authenticated`; `anon` es quien aún no abre sesión.

grant select, insert, update, delete on public.missions to authenticated;
grant select on public.scores to anon, authenticated;
grant insert on public.scores to authenticated;
