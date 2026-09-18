# OSIRIS Integration

This repo is not a fork of OSIRIS itself — it's the integration plan and decision trail for bringing OSIRIS's live intelligence feeds into Sire's **logistics THELMA** system as a risk overlay.

## What OSIRIS is

- Live map: [osirisai.live](https://osirisai.live/?layers=maritime,cctv,cctv_previews,live_news,earthquakes,global_incidents,day_night,cables,sdk_sea,sdk_air,sdk_naval)
- Source: [github.com/simplifaisoul/osiris](https://github.com/simplifaisoul/osiris) — Next.js + MapLibre GL, MIT licensed, deployed on Vercel's edge network.
- Layers: maritime (39 global ports, 10 chokepoints — **static reference geography, not live vessel tracking**), CCTV (largely U.S. state DOT camera networks — WSDOT, Caltrans, NYC DOT), live news, earthquakes, global incidents, undersea cables, and SDK feeds for sea/air/naval (aviation via OpenSky).

## Status: BLOCKED on target confirmation

Sire's logistics THELMA — described as a **separate system from the production-coordinator THELMA**, with a trading hub and a transit-mapping section, focused on U.S. domestic transit (trucks, cars, aviation, maritime) — has not been located.

Claude checked, with real GitHub and Vercel access (2026-09-17):
- **GitHub** (`estibancreations-svg`): only one THELMA repo exists — [`-THELMA-AI`](https://github.com/estibancreations-svg/-THELMA-AI). Its own README identifies it as the **governed operations/orchestration backbone** (core, orchestration, work queues, policy engine, audit ledger, training — the enterprise coordinator for Book Creation, Video Production, Character Production, and Podcast). It is explicitly **not** the logistics/trading/transit system described in the source conversation.
- **Vercel** (team Estibancreations): only five projects exist, all linked to `Master-System-Buildout`, `Master-dashboard-`, or `MASTER_CEO_DASHBOARD`. Nothing matching a logistics/trading/transit THELMA.

**Needed from Sire:** where the logistics THELMA actually lives — a GitHub repo name, a Vercel project under a different team, or a different platform entirely (e.g. Lovable, Google AI Studio, local-only). Nothing below gets built until that target is confirmed.

## Why OSIRIS fits logistics THELMA, specifically

OSIRIS was evaluated against two different THELMA systems in the source conversation:

1. **Production-coordinator THELMA** (Book/Video/Character/Podcast pipelines) — OSIRIS mostly doesn't apply. The only genuine fits: print/merch fulfillment (port chokepoint + conflict-zone delay risk), location shoots (weather/wildfire/earthquake reschedule triggers), and news-driven release timing.
2. **Logistics THELMA** (U.S. domestic trucks, cars, aviation, maritime; trading hub; transit mapping) — this is the real fit. Once scoped to U.S. domestic-only, most of OSIRIS's headline layers (conflict zones, chokepoints, global incident feeds) are dead weight. What's actually useful:
   - **CCTV / state DOT feeds** (WSDOT, Caltrans, NYC DOT, etc.) — map directly onto U.S. highway corridors
   - **Wildfires, weather, earthquakes** — route risk
   - **Aviation (OpenSky)** — relevant if air freight/transit is in scope
   - **Maritime** — still only static port/chokepoint geography, not live vessel positions; useful for planning around a port closure, not for tracking a specific ship

Treat all of it as a **risk overlay feeding decisions**, not a tracking system.

## Proposed architecture (not yet built — waiting on target confirmation)

Don't embed the OSIRIS app. Embed the signals.

1. **Supabase table** `world_signals`: `id, signal_type, severity, lat, lng, region_label, source, detected_at, expires_at, raw jsonb`
2. **Supabase Edge Function** `sync-world-signals`: hits only the needed OSIRIS API routes (e.g. `/api/maritime`, `/api/earthquakes`, `/api/weather`, `/api/news`) on a fork you control, normalizes each response into the shape above, and upserts. Ignore the rest of the app.
3. **pg_cron**: run every 30–60 minutes. OSIRIS itself polls upstream on 15–30 minute intervals for stable data, so faster gains nothing but rate-limit risk.
4. **Relevance filter** (the piece that does the real work): before writing to `world_signals`, check whether a signal touches something the logistics system is actually managing — an active corridor, a scheduled shipment, a tracked lane. Non-matching signals get dropped. Without this step you've handed the system 10,000 earthquakes and no judgment.
5. **Logistics THELMA reads the table, not the API.** It queries `world_signals` like any other Supabase table. If OSIRIS goes down or gets swapped for a different source later, the logistics system never notices — only what fills the table changes.

## Guardrails before anything touches production

- **Strip the recon tools.** OSIRIS ships with browser-based Nmap port scanning, DNS enumeration, WHOIS, and IP reputation lookups (`/api/scanner`, `/api/osint/*`). Running port scans from a business system against hosts you don't own can violate the Computer Fraud and Abuse Act and almost certainly Vercel's acceptable use policy. Delete those routes before deployment — not optional.
- **MIT covers the code, not the data.** The repo license lets you use/modify commercially with attribution, but the upstream feeds (OpenSky, USGS, state DOT networks, news wires) each carry their own terms. Redistributing that data inside a commercial product is a separate legal question from forking the repo — worth checking before building revenue on top of it.
- **Fork specifically from `simplifaisoul/osiris`, pinned to a commit hash, not tracking `main`.** The project is partly funded through a crypto token and several near-identical forks exist — pinning avoids inheriting an unreviewed upstream change.
- **Own the deployment.** Don't iframe `osirisai.live` directly for anything beyond a demo — fork, self-host under Estibancreations' own Vercel, and pin a version.

## Directory Index

- **09-source-conversations** — the original planning conversation, verbatim

## Open Questions

1. Where does the logistics THELMA (trading hub + transit mapping) actually live? (blocking)
2. Which U.S. corridors does it run most? (asked in the source conversation, never answered — needed to prioritize which DOT camera feeds matter)
3. Is the "trading hub" freight/commodities or financial instruments? (changes which OSIRIS layers are relevant — chokepoints/ports vs. markets/news)

## Decision Trail

Full source conversation (OSIRIS discovery → fit-check against both THELMA systems → U.S.-domestic scoping → GitHub search attempt that failed for lack of a connector) archived in `09-source-conversations/`. Repo created and this plan written once GitHub and Vercel access confirmed no existing logistics THELMA target.
