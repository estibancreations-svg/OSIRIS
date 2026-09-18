# OSIRIS Integration — Original Planning Conversation

**Captured:** 2026-09-17, pasted into the GitHub-organization session with Claude by Sire.
**Source platform:** Not specified by Sire — preserved verbatim as supplied, including its own References section.
**Purpose:** Founding conversation that identified OSIRIS, evaluated it against both THELMA systems, scoped it to U.S. domestic logistics, and attempted (unsuccessfully, for lack of a GitHub connector at the time) to locate the logistics THELMA repo.

---

## Sire (opening)

> How do I embed this progrsm I to my systems especially my logistics system? It says it's opensourced on @GitHub
> https://osirisai.live/?layers=maritime,cctv,cctv_previews,live_news,earthquakes,global_incidents,day_night,cables,sdk_sea,sdk_air,sdk_naval

## Response

**What I understood**
You want to take OSIRIS (the live map at osirisai.live) and pull it into your own stack — mainly whatever runs your logistics side — and you've confirmed it's open source on GitHub. So the question is how to wire it in, not whether to.

Before the how, one thing you need to know, because it changes the plan.

**What OSIRIS actually is**
The live site is built from github.com/simplifaisoul/osiris. It's a Next.js and MapLibre GL dashboard, MIT licensed, deployed on Vercel's edge network — which is good news, since that's already your stack.

The catch is the maritime layer. It covers 39 global ports and 10 chokepoints, sourced from static naval intel — meaning it's fixed reference geography, not live vessel tracking. Think of it like a map of every highway exit in the country: useful for planning, but it won't tell you where your truck is right now. If you were hoping to track shipments, this isn't that tool.

What it is good for in logistics: a risk overlay. Conflict zones, earthquakes, wildfires, weather, and port chokepoints sitting underneath your route data, so you can see when a lane is about to get ugly.

**Three ways to embed it**

1. iframe the public site — 10 minutes, zero control. You're depending on someone else's server staying up, and they can break your dashboard any time they push a change. Fine for a demo, not for production.
2. Fork → self-host → iframe your own copy — the sweet spot. Clone it, npm install, npm run dev, or use the included docker compose up -d setup. Deploy it as its own Vercel project under Estibancreations, then iframe that into your dashboard. You own the uptime and can pin a version.
3. Take the data, leave the UI — the right answer for logistics. The app exposes Next.js API routes like /api/maritime, /api/earthquakes, /api/news, and /api/weather. Have a scheduled job hit only the routes you care about, write the results into Supabase, and render them in your own map. You get the intelligence without inheriting their whole interface.

Path 3 is like buying the ingredients instead of the finished meal — more prep, but it fits your kitchen.

**Two guardrails before you deploy anything**

Strip the recon tools. The project ships with browser-based Nmap port scanning, DNS enumeration, WHOIS, and IP reputation lookups. Running port scans from a business system against hosts you don't own can violate the Computer Fraud and Abuse Act and almost certainly violates Vercel's acceptable use policy. Delete the /api/scanner and /api/osint/* routes before this touches production. Not optional.

MIT covers the code, not the data. You're free to use and modify it commercially as long as you keep the copyright notice. But the upstream feeds — OpenSky, USGS, the state DOT camera networks, the news wires — each carry their own terms. Redistributing that data inside a commercial product is a separate question from forking the repo. Worth a look before you build revenue on top of it.

One more note for due diligence: the project is partly funded through a crypto token, and several near-identical forks exist. Fork from simplifaisoul/osiris specifically, and pin to a commit hash rather than tracking main.

**One question**
Which of your systems is the logistics one — AABOS, CMGIO, or something separate? The integration path differs depending on whether I'm writing into an existing Supabase schema or standing up a new service.

**References**
- simplifaisoul. (2026). OSIRIS: Open source global intelligence platform [Computer software]. GitHub. https://github.com/simplifaisoul/osiris
- Osirisai. (2026). Support osirisai. Ko-fi. https://ko-fi.com/osirisai

---

## Sire

> T.H.E.L.A Ai is the logistics stack.

## Response

**What I understood**
THELMA is the coordinating brain you want OSIRIS feeding into. So the job is: pull OSIRIS's live world-state data into THELMA so it can make better routing and scheduling decisions.

Before I hand you code, one honest check.

**The fit question**
THELMA coordinates Book Creation, Video Production, Character Production, and Podcast — running on GitHub Actions, Supabase Edge Functions, and pg_cron. OSIRIS's strongest layers are maritime chokepoints, conflict zones, earthquakes, wildfires, and CCTV feeds.

Most of that has no bearing on a podcast episode shipping on time. Bolting the full OSIRIS map onto THELMA would be like mounting a marine radar on a delivery van — impressive screen, wrong problem.

There are three places it genuinely earns its spot, all of them where your pipelines touch the physical world:

- Print and merch fulfillment — if books or character products come from overseas printers, port chokepoint and conflict-zone data flags delays weeks before your vendor emails you.
- Location shoots — weather, wildfire, and earthquake layers give THELMA a reason to auto-reschedule a shoot day instead of you finding out morning-of.
- News-driven content timing — the news and GDELT feeds let THELMA hold or push a release when a major event would bury it.

If none of those describe what THELMA routes, the honest answer is: skip the integration. It'd be maintenance cost with no payoff.

**If it does fit — the architecture**
Don't embed the app. Embed the signals. Your stack already has everything needed:

1. A Supabase table — one row per active risk signal:
```
world_signals
  id, signal_type, severity, lat, lng,
  region_label, source, detected_at,
  expires_at, raw jsonb
```
2. A Supabase Edge Function — call it sync-world-signals. It hits only the OSIRIS routes you need (/api/maritime, /api/earthquakes, /api/weather, /api/news), normalizes each response into the shape above, and upserts. Ignore the rest of the app entirely.
3. pg_cron — run it every 30–60 minutes. OSIRIS itself polls upstream on 15–30 minute intervals for stable data, so faster gains you nothing but rate-limit risk.
4. THELMA reads the table, not the API. This is the important part. THELMA queries world_signals like any other Supabase table. If OSIRIS goes down or you swap it for a different data source later, THELMA never notices — you've only changed what fills the table. One seam instead of a tangle.
5. Point it at your own fork. Deploy your fork as a separate Vercel project under Estibancreations, with the /api/scanner and /api/osint/* recon routes deleted. Your Edge Function calls that, never osirisai.live.

**The piece that does real work**
The table alone is just data. The value is a relevance filter between step 2 and step 4: a small function that asks "does this signal touch anything THELMA is currently managing?" — a printer's country, a scheduled shoot location, a release window. Signals that match get written with a pipeline reference. Everything else gets dropped.

Without that filter you've given THELMA 10,000 earthquakes and no judgment.

**One question**
What does THELMA actually coordinate that has a physical location attached — print vendors, shoot sites, shipping, live events? Name those and I'll write the relevance filter and the Edge Function against your real cases rather than a generic one.

**References**
- simplifaisoul. (2026). OSIRIS: Open source global intelligence platform [Computer software]. GitHub. https://github.com/simplifaisoul/osiris

---

## Sire

> there is another version of Thelma AI in there. And it is a logistics system. It also has a trading hub and a mapping section for travel and transit.

## Response

Ah, right — so there's a second THELMA, separate from the production coordinator. That one's a proper logistics stack with trading and transit mapping. Good news: OSIRIS fits that one genuinely well.

Before I go further, I don't want to guess at its shape. Is the trading hub freight and commodities, or financial instruments? That changes which layers matter — chokepoints and port data serve the first, the markets and news feeds serve the second.

## Sire

> Right now, the logistics is focused on U.S. transit for trucks, cars, aviation, and maritime.

## Response

Right, that sharpens it a lot. Domestic U.S. transit means most of OSIRIS's headline layers are dead weight for you — the conflict zones, the chokepoints, the Telegram feeds. Those are built for global situational awareness, not moving freight across Ohio.

What actually serves you: the CCTV networks, since they're mostly state DOT feeds like WSDOT, Caltrans, and NYC DOT, so they map directly onto U.S. highway corridors. Plus wildfires, weather, and earthquakes for route risk, and the aviation layer from OpenSky.

Honest caveat though — that maritime layer is static port geography, not live vessel positions, so it won't track your ships. And for trucks, a DOT camera tells you a corridor looks jammed, not why. So I'd treat it as a risk overlay feeding THELMA, not a tracking system.

Which corridors do you run most?

## Sire

> This thing, so I haven't seen it out still. Got it up and running. Check my GitHub to see if you can find the information on it so you'll know what you're looking at.

## Response

I can look — quick check on where to point. Under estibancreations-svg, do you know roughly what the logistics THELMA repo is called, or should I just search the org for anything matching THELMA and logistics?

## Sire

> Search. Just search.

## Response

I'll search your org now — give me a moment.

I hit a snag — I don't actually have a GitHub connector loaded, so I can't browse your org directly. What I have is Vercel, Supabase, Google Drive, and a few others, but not GitHub itself.

Two ways around it. If the logistics THELMA is deployed on Vercel, I can list your projects there and find the linked repo that way. Or if the repo's public, give me the name and I'll pull it up. Which works?

---

## What happened next (2026-09-17, in the Claude GitHub-organization session)

Sire pasted the full conversation above and said: "This is the conversation - commit it and everything else as we are working - to the GitHub's repositories that we touch."

This time, with real GitHub and Vercel access, Claude searched both directly:
- GitHub search for `thelma`, `logistics`, `osiris`, and `transit` under `estibancreations-svg` found only one THELMA repo: `-THELMA-AI`, whose own README identifies it as the production-coordinator/orchestration backbone, not the logistics system.
- Vercel (team Estibancreations) listing showed only five projects, none matching a logistics/trading/transit system.

So the search the earlier assistant couldn't run came back empty. This repository (`OSIRIS`) was created to hold the plan and this record while Sire locates where the logistics THELMA actually lives.
