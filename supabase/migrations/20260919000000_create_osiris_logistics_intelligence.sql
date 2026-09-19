-- OSIRIS logistics-intelligence foundation
-- Server-only tables: browser roles receive no direct access.

create table if not exists public.osiris_tracked_corridors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  name text not null,
  mode text not null check (mode in ('road', 'rail', 'air', 'maritime', 'multimodal')),
  min_lat double precision not null check (min_lat between -90 and 90),
  max_lat double precision not null check (max_lat between -90 and 90),
  min_lng double precision not null check (min_lng between -180 and 180),
  max_lng double precision not null check (max_lng between -180 and 180),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint osiris_corridor_lat_order check (min_lat <= max_lat),
  constraint osiris_corridor_lng_order check (min_lng <= max_lng)
);

create table if not exists public.osiris_world_signals (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text not null,
  signal_type text not null,
  severity smallint not null check (severity between 1 and 5),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  region_label text,
  detected_at timestamptz not null,
  expires_at timestamptz not null,
  matched_corridor_ids uuid[] not null default '{}',
  raw jsonb not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (source, external_id)
);

create table if not exists public.osiris_sync_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('running', 'succeeded', 'partial', 'failed')),
  source_base_url text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  fetched_count integer not null default 0,
  matched_count integer not null default 0,
  upserted_count integer not null default 0,
  errors jsonb not null default '[]'::jsonb
);

create index if not exists osiris_world_signals_expires_idx
  on public.osiris_world_signals (expires_at);
create index if not exists osiris_world_signals_type_severity_idx
  on public.osiris_world_signals (signal_type, severity desc);
create index if not exists osiris_world_signals_detected_idx
  on public.osiris_world_signals (detected_at desc);
create index if not exists osiris_tracked_corridors_active_idx
  on public.osiris_tracked_corridors (active) where active;

alter table public.osiris_tracked_corridors enable row level security;
alter table public.osiris_world_signals enable row level security;
alter table public.osiris_sync_runs enable row level security;

revoke all on table public.osiris_tracked_corridors from anon, authenticated;
revoke all on table public.osiris_world_signals from anon, authenticated;
revoke all on table public.osiris_sync_runs from anon, authenticated;

grant select, insert, update, delete on table public.osiris_tracked_corridors to service_role;
grant select, insert, update, delete on table public.osiris_world_signals to service_role;
grant select, insert, update, delete on table public.osiris_sync_runs to service_role;

comment on table public.osiris_tracked_corridors is
  'Server-managed route and transit areas used to filter OSIRIS signals for logistics relevance.';
comment on table public.osiris_world_signals is
  'Normalized, corridor-matched OSIRIS risk signals. Not an authoritative tracking source.';
comment on table public.osiris_sync_runs is
  'Audit record for each OSIRIS synchronization attempt.';
