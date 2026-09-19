# OSIRIS Logistics Intelligence Integration

This repository implements the governed adapter for bringing selected OSIRIS signals into Estibancreations' future **logistics T.H.E.L.M.A.** system as a risk overlay.

It is not an unrestricted fork of OSIRIS and it does not change the identity of the enterprise operations-orchestrator in `estibancreations-svg/-THELMA-AI`.

## Current status

**IMPLEMENTED_UNVERIFIED — integration foundation deployed; consuming logistics runtime attachment pending.**

Implemented:

- Supabase tables for tracked corridors, normalized world signals and sync audit runs
- RLS plus removal of direct `anon` and `authenticated` access
- authenticated `sync-world-signals` Edge Function
- corridor relevance filtering so unrelated global events are discarded
- source, freshness and error evidence
- exclusion of OSIRIS recon/scanner routes
- architecture and security contract

Still required before production certification:

1. Recover or designate the canonical logistics T.H.E.L.M.A. runtime.
2. Add real U.S. transit corridors.
3. Run an authenticated live sync and verify stored matching signals.
4. Configure a 30–60 minute scheduler using a backend secret stored in Supabase Vault.
5. Deploy an Estibancreations-controlled OSIRIS data runtime pinned to an audited upstream commit.
6. Review the terms for every upstream data source used commercially.

## Source project

- Live map: [osirisai.live](https://osirisai.live/?layers=maritime,cctv,cctv_previews,live_news,earthquakes,global_incidents,day_night,cables,sdk_sea,sdk_air,sdk_naval)
- Upstream source: [simplifaisoul/osiris](https://github.com/simplifaisoul/osiris)
- License: MIT for the software; individual upstream data feeds retain their own terms.

## Architecture

Do not iframe the public OSIRIS site as the production integration. The hosted deployment blocks cross-origin framing and would leave Estibancreations dependent on an uncontrolled runtime.

The implemented flow is:

```text
Selected OSIRIS read APIs
        |
        v
sync-world-signals Edge Function
        |
        v
active-corridor relevance filter
        |
        v
Supabase osiris_world_signals
        |
        v
future logistics T.H.E.L.M.A. consumer
```

The logistics runtime reads the normalized table, not OSIRIS directly. That keeps source replacement, outages and schema changes behind one controlled boundary.

## Included feeds

- earthquakes
- wildfires
- weather
- maritime reference/live data when available from the configured OSIRIS deployment

## Excluded capabilities

The integration does not call or expose:

- `/api/scanner`
- `/api/osint/*`
- CCTV stream proxies
- unrestricted global-event ingestion
- OSIRIS secrets in the browser

## Repository map

- `01-architecture/OSIRIS-LOGISTICS-INTELLIGENCE-CONTRACT.md` — authority, boundaries and completion gates
- `supabase/migrations/` — database schema and access controls
- `supabase/functions/sync-world-signals/` — authenticated sync and relevance filter
- `09-source-conversations/` — preserved original planning conversation

## Configuration

```env
OSIRIS_BASE_URL=https://osirisai.live
```

The public URL is a temporary read source. Replace it with an Estibancreations-controlled deployment before production certification. Supabase supplies its own URL and backend secret variables to the deployed function; never commit populated credentials.

## Data interpretation

OSIRIS information is advisory open-source intelligence. It does not replace carrier telemetry, ELD/GPS records, dispatch systems, aviation operational systems, port/terminal systems, or authoritative emergency alerts.

The original planning and discovery record remains preserved at `09-source-conversations/2026-09-17_OSIRIS-Integration-Planning-Conversation.md`.
