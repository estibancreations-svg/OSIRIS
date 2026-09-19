-- Explicit browser-role deny policies plus a safe U.S. domestic baseline.
-- The corridor resolves the organization dynamically; no generated UUID is hard-coded.

create policy "osiris corridors deny browser access"
on public.osiris_tracked_corridors
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create policy "osiris signals deny browser access"
on public.osiris_world_signals
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create policy "osiris sync runs deny browser access"
on public.osiris_sync_runs
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

insert into public.osiris_tracked_corridors (
  workspace_id, name, mode, min_lat, max_lat, min_lng, max_lng, metadata
)
select
  id,
  'Continental United States baseline',
  'multimodal',
  24.3963,
  49.3844,
  -124.8490,
  -66.8854,
  jsonb_build_object(
    'scope', 'temporary baseline',
    'modes', jsonb_build_array('truck', 'car', 'aviation', 'maritime'),
    'replace_with', 'real operating corridors when logistics THELMA target is attached'
  )
from public.ceo_organizations
where slug = 'estiban-creations'
  and not exists (
    select 1
    from public.osiris_tracked_corridors
    where name = 'Continental United States baseline'
  );