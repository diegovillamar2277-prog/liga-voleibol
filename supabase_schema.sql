-- ============================================================
--  LIGA VOLEIBOL — Schema Supabase
--  Ejecutar en: SQL Editor de tu proyecto Supabase
-- ============================================================

-- 1. PERFILES DE USUARIO (extiende auth.users de Supabase)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  nombre      text,
  role        text not null default 'organizador' check (role in ('superadmin','admin','organizador')),
  activo      boolean not null default true,
  created_at  timestamptz default now()
);

-- 2. LIGAS
create table if not exists public.leagues (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  temporada     text,
  codigo        text unique not null,           -- código público de 6 chars, ej: VOL-2K7
  owner_id      uuid references public.profiles(id) on delete set null,
  config        jsonb not null default '{}',
  reglas        jsonb not null default '[]',
  playoffs_cfg  jsonb not null default '{}',
  activa        boolean not null default true,
  created_at    timestamptz default now()
);

-- 3. MIEMBROS DE LIGA (organizadores co-admins)
create table if not exists public.league_members (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references public.leagues(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'co-admin' check (role in ('owner','co-admin')),
  created_at timestamptz default now(),
  unique(league_id, user_id)
);

-- 4. EQUIPOS
create table if not exists public.teams (
  id              uuid primary key default gen_random_uuid(),
  league_id       uuid not null references public.leagues(id) on delete cascade,
  nombre          text not null,
  inscripcion_pagada boolean default false,
  arb_saldo       numeric default 0,
  created_at      timestamptz default now()
);

-- 5. PARTIDOS
create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references public.leagues(id) on delete cascade,
  vuelta      int not null default 1,
  fecha       date,
  equipo_a    text not null,
  equipo_b    text not null,
  sets        jsonb default '[]',
  sets_a      int default 0,
  sets_b      int default 0,
  ganador     text check (ganador in ('A','B',null)),
  jugado      boolean default false,
  pago_arb_a  boolean default false,
  pago_arb_b  boolean default false,
  es_playoff  boolean default false,
  created_at  timestamptz default now()
);

-- 6. PLAYOFFS
create table if not exists public.playoffs (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references public.leagues(id) on delete cascade,
  data       jsonb not null default '{}',
  updated_at timestamptz default now()
);

-- 7. PETICIONES (más de 2 ligas)
create table if not exists public.join_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  mensaje     text,
  estado      text default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
  created_at  timestamptz default now()
);

-- ── ROW LEVEL SECURITY ──────────────────────────────────────

alter table public.profiles       enable row level security;
alter table public.leagues        enable row level security;
alter table public.league_members enable row level security;
alter table public.teams          enable row level security;
alter table public.matches        enable row level security;
alter table public.playoffs       enable row level security;
alter table public.join_requests  enable row level security;

-- PROFILES
create policy "Perfil propio" on public.profiles
  for select using (auth.uid() = id);
create policy "Admin ve todos" on public.profiles
  for select using (
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('superadmin','admin'))
  );
create policy "Admin modifica roles" on public.profiles
  for update using (
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('superadmin','admin'))
  );

-- LEAGUES: lectura pública por código
create policy "Liga pública por código" on public.leagues
  for select using (activa = true);
create policy "Miembro puede ver su liga" on public.leagues
  for select using (
    exists(select 1 from public.league_members m where m.league_id=id and m.user_id=auth.uid())
  );
create policy "Organizador puede crear" on public.leagues
  for insert with check (auth.uid() = owner_id);
create policy "Owner/admin puede modificar" on public.leagues
  for update using (
    owner_id = auth.uid() or
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('superadmin','admin')) or
    exists(select 1 from public.league_members m where m.league_id=id and m.user_id=auth.uid())
  );
create policy "Admin puede eliminar" on public.leagues
  for delete using (
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('superadmin','admin'))
  );

-- LEAGUE MEMBERS
create policy "Ver miembros de tu liga" on public.league_members
  for select using (
    user_id = auth.uid() or
    exists(select 1 from public.league_members m where m.league_id=league_id and m.user_id=auth.uid())
  );
create policy "Owner puede agregar miembros" on public.league_members
  for insert with check (
    exists(select 1 from public.leagues l where l.id=league_id and l.owner_id=auth.uid()) or
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('superadmin','admin'))
  );
create policy "Owner puede quitar miembros" on public.league_members
  for delete using (
    exists(select 1 from public.leagues l where l.id=league_id and l.owner_id=auth.uid()) or
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('superadmin','admin'))
  );

-- TEAMS
create policy "Equipos públicos" on public.teams
  for select using (true);
create policy "Miembro puede gestionar equipos" on public.teams
  for all using (
    exists(select 1 from public.league_members m where m.league_id=league_id and m.user_id=auth.uid()) or
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('superadmin','admin'))
  );

-- MATCHES
create policy "Partidos públicos" on public.matches
  for select using (true);
create policy "Miembro puede gestionar partidos" on public.matches
  for all using (
    exists(select 1 from public.league_members m where m.league_id=league_id and m.user_id=auth.uid()) or
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('superadmin','admin'))
  );

-- PLAYOFFS
create policy "Playoffs públicos" on public.playoffs
  for select using (true);
create policy "Miembro puede gestionar playoffs" on public.playoffs
  for all using (
    exists(select 1 from public.league_members m where m.league_id=league_id and m.user_id=auth.uid()) or
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('superadmin','admin'))
  );

-- JOIN REQUESTS
create policy "Ver mis peticiones" on public.join_requests
  for select using (
    user_id = auth.uid() or
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('superadmin','admin'))
  );
create policy "Crear petición" on public.join_requests
  for insert with check (auth.uid() = user_id);
create policy "Admin gestiona peticiones" on public.join_requests
  for update using (
    exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('superadmin','admin'))
  );

-- ── FUNCIÓN: crear perfil automático al registrarse ─────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, nombre, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)),
    case when new.email = 'diegovillamar2277@gmail.com' then 'superadmin' else 'organizador' end
  );
  return new;
end;
$$;

-- Trigger para crear perfil automáticamente
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── FUNCIÓN: código único de liga ───────────────────────────
create or replace function public.generar_codigo_liga()
returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  codigo text;
  existe boolean;
begin
  loop
    codigo := '';
    for i in 1..3 loop
      codigo := codigo || substr(chars, floor(random()*length(chars)+1)::int, 1);
    end loop;
    codigo := codigo || '-';
    for i in 1..3 loop
      codigo := codigo || substr(chars, floor(random()*length(chars)+1)::int, 1);
    end loop;
    select exists(select 1 from public.leagues where codigo=codigo) into existe;
    exit when not existe;
  end loop;
  return codigo;
end;
$$;

-- ── FUNCIÓN: aplicar pago/saldo de arbitraje de forma atómica ──
-- Evita condiciones de carrera: el cliente ya NO lee arb_saldo,
-- calcula el resto y lo vuelve a escribir (eso permite que dos
-- operaciones casi simultáneas se pisen y se pierda dinero).
-- Esta función bloquea la fila del equipo (FOR UPDATE), suma el
-- monto nuevo al saldo existente, cubre los partidos pendientes
-- en orden de fecha (igual que el botón "Aplicar saldo"), y
-- guarda el resto — todo en una sola transacción.
create or replace function public.aplicar_pago_arbitraje(
  p_team_id    uuid,
  p_monto      numeric,
  p_precio_arb numeric
)
returns table(cubiertos int, resto numeric)
language plpgsql
as $$
declare
  v_team      record;
  v_total     numeric;
  v_cubiertos int := 0;
  v_match     record;
begin
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then
    raise exception 'Equipo no encontrado';
  end if;

  v_total := coalesce(v_team.arb_saldo, 0) + coalesce(p_monto, 0);

  for v_match in
    select m.id, m.equipo_a, m.equipo_b
    from public.matches m
    where m.league_id = v_team.league_id
      and m.jugado = true
      and m.es_playoff = false
      and (
        (m.equipo_a = v_team.nombre and m.pago_arb_a = false) or
        (m.equipo_b = v_team.nombre and m.pago_arb_b = false)
      )
    order by m.fecha asc nulls last, m.created_at asc
  loop
    exit when v_total < p_precio_arb;
    if v_match.equipo_a = v_team.nombre then
      update public.matches set pago_arb_a = true where id = v_match.id;
    else
      update public.matches set pago_arb_b = true where id = v_match.id;
    end if;
    v_total := v_total - p_precio_arb;
    v_cubiertos := v_cubiertos + 1;
  end loop;

  update public.teams set arb_saldo = v_total where id = p_team_id;

  return query select v_cubiertos, v_total;
end;
$$;

-- ── Idempotencia de webhooks de MercadoPago ─────────────────
-- Sin esto, si MercadoPago reintenta la notificación (o alguien
-- reenvía el mismo payment id manualmente) el webhook vuelve a
-- sumar meses de plan gratis con el mismo pago ya procesado.
alter table public.profiles add column if not exists last_mp_payment_id text;
