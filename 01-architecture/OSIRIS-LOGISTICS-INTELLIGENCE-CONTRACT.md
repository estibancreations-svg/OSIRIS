# OSIRIS Logistics Intelligence Contract

**Record:** CAP-OSIRIS-001  
**Owner:** Estibancreations  
**Status:** IMPLEMENTED_UNVERIFIED  
**Boundary:** shared intelligence capability; not a new enterprise system identity

## Purpose

Normalize selected OSIRIS environmental and transportation signals into a stable, server-only Supabase contract. A future logistics T.H.E.L.M.A. runtime consumes the normalized table rather than depending directly on OSIRIS.

## Database contract

### `osiris_tracked_corridors`

Defines active route areas as bounding boxes. The sync function stores only signals intersecting at least one active corridor.

### `osiris_world_signals`

Normalized signals with source provenance, severity, location, freshness and matched corridor identifiers. This table is an advisory risk overlay, not authoritative vehicle or shipment tracking.

### `osiris_sync_runs`

Immutable operational evidence for synchronization attempts, including counts and errors.

## Security

- RLS is enabled on all three tables.
- `anon` and `authenticated` receive no direct table privileges.
- Only backend service credentials may read or mutate these records.
- The Edge Function requires a valid Supabase JWT at the platform boundary.
- No OSIRIS recon/scanner endpoints are called.
- No secrets are stored in GitHub.

## Included feeds

- earthquakes
- wildfires
- weather
- maritime reference and live data when the selected OSIRIS deployment provides it

## Deliberately excluded

- `/api/scanner`
- `/api/osint/*`
- camera stream proxying
- unrestricted global-event storage
- direct browser access to source APIs

## Completion gates

1. Add at least one real U.S. logistics corridor.
2. Invoke `sync-world-signals` with an authorized backend identity.
3. Verify a matching live signal is stored with source and freshness metadata.
4. Configure a 30–60 minute scheduler using a secret stored in Supabase Vault.
5. Attach the consuming logistics T.H.E.L.M.A. runtime when its canonical location is recovered.
6. Complete upstream data-license review before commercial redistribution.
