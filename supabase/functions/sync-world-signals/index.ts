import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

type Corridor = {
  id: string;
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
};

type Signal = {
  source: string;
  external_id: string;
  signal_type: string;
  severity: number;
  latitude: number;
  longitude: number;
  region_label: string | null;
  detected_at: string;
  expires_at: string;
  matched_corridor_ids: string[];
  raw: Record<string, unknown>;
  last_seen_at: string;
};

const FEEDS = [
  { route: "/api/earthquakes", type: "earthquake", ttlMinutes: 1440 },
  { route: "/api/fires", type: "wildfire", ttlMinutes: 360 },
  { route: "/api/weather", type: "weather", ttlMinutes: 360 },
  { route: "/api/maritime", type: "maritime", ttlMinutes: 120 },
] as const;

function secretKey(): string {
  const nextKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (nextKeys) {
    const parsed = JSON.parse(nextKeys) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }

  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  throw new Error("No Supabase backend secret is available");
}

function numberValue(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function arraysFromPayload(payload: Record<string, unknown>): Record<string, unknown>[] {
  const keys = ["earthquakes", "events", "fires", "data", "ports", "chokepoints", "ships"];
  return keys.flatMap((key) => Array.isArray(payload[key]) ? payload[key] as Record<string, unknown>[] : []);
}

function position(item: Record<string, unknown>): { lat: number; lng: number } | null {
  const geometry = item.geometry as { coordinates?: unknown[] } | undefined;
  const coordinates = geometry?.coordinates;
  const lat = numberValue(item.lat, item.latitude, coordinates?.[1]);
  const lng = numberValue(item.lng, item.lon, item.longitude, coordinates?.[0]);
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function severity(item: Record<string, unknown>): number {
  const magnitude = numberValue(item.magnitude, item.mag);
  if (magnitude !== null) {
    if (magnitude >= 7) return 5;
    if (magnitude >= 6) return 4;
    if (magnitude >= 5) return 3;
    return 2;
  }

  const label = String(item.severity ?? item.risk ?? item.risk_level ?? item.congestion ?? "").toUpperCase();
  if (/(CRITICAL|EXTREME|SEVERE)/.test(label)) return 5;
  if (/(HIGH|CONGESTED|WARNING)/.test(label)) return 4;
  if (/(ELEVATED|MODERATE)/.test(label)) return 3;
  if (/(LOW|NORMAL)/.test(label)) return 2;
  return 1;
}

function corridorMatches(lat: number, lng: number, corridors: Corridor[]): string[] {
  return corridors
    .filter((corridor) =>
      lat >= corridor.min_lat &&
      lat <= corridor.max_lat &&
      lng >= corridor.min_lng &&
      lng <= corridor.max_lng
    )
    .map((corridor) => corridor.id);
}

function externalId(route: string, item: Record<string, unknown>, lat: number, lng: number): string {
  const candidate = item.id ?? item.external_id ?? item.code ?? item.mmsi ?? item.name ??
    (item.properties as Record<string, unknown> | undefined)?.id;
  return String(candidate ?? `${route}:${lat.toFixed(4)}:${lng.toFixed(4)}`).slice(0, 300);
}

function isoDate(value: unknown, fallback: Date): string {
  const parsed = value ? new Date(String(value)) : fallback;
  return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString();
}

async function fetchJson(baseUrl: URL, route: string): Promise<Record<string, unknown>> {
  const url = new URL(route, baseUrl);
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Estibancreations-OSIRIS-Adapter/1.0" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`${route} returned HTTP ${response.status}`);
  return await response.json() as Record<string, unknown>;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });
  }

  const startedAt = new Date();
  const configuredBase = Deno.env.get("OSIRIS_BASE_URL") ?? "https://osirisai.live";
  const baseUrl = new URL(configuredBase);
  if (baseUrl.protocol !== "https:") {
    return Response.json({ error: "OSIRIS_BASE_URL must use HTTPS" }, { status: 500 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return Response.json({ error: "SUPABASE_URL is unavailable" }, { status: 500 });

  const supabase = createClient(supabaseUrl, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: corridors, error: corridorError } = await supabase
    .from("osiris_tracked_corridors")
    .select("id,min_lat,max_lat,min_lng,max_lng")
    .eq("active", true);

  if (corridorError) return Response.json({ error: corridorError.message }, { status: 500 });

  const { data: run, error: runError } = await supabase
    .from("osiris_sync_runs")
    .insert({ status: "running", source_base_url: baseUrl.origin, started_at: startedAt.toISOString() })
    .select("id")
    .single();

  if (runError || !run) return Response.json({ error: runError?.message ?? "Unable to create sync run" }, { status: 500 });

  const errors: string[] = [];
  let fetchedCount = 0;
  const signals: Signal[] = [];
  const activeCorridors = (corridors ?? []) as Corridor[];

  for (const feed of FEEDS) {
    try {
      const payload = await fetchJson(baseUrl, feed.route);
      const items = arraysFromPayload(payload).slice(0, 5_000);
      fetchedCount += items.length;

      for (const item of items) {
        const point = position(item);
        if (!point) continue;
        const matched = corridorMatches(point.lat, point.lng, activeCorridors);
        if (matched.length === 0) continue;

        const now = new Date();
        const properties = item.properties as Record<string, unknown> | undefined;
        signals.push({
          source: `osiris:${feed.route}`,
          external_id: externalId(feed.route, item, point.lat, point.lng),
          signal_type: feed.type,
          severity: severity({ ...properties, ...item }),
          latitude: point.lat,
          longitude: point.lng,
          region_label: String(item.region_label ?? item.place ?? item.name ?? properties?.place ?? "") || null,
          detected_at: isoDate(item.detected_at ?? item.timestamp ?? item.time ?? properties?.time, now),
          expires_at: new Date(now.getTime() + feed.ttlMinutes * 60_000).toISOString(),
          matched_corridor_ids: matched,
          raw: item,
          last_seen_at: now.toISOString(),
        });
      }
    } catch (error) {
      errors.push(`${feed.route}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let upsertedCount = 0;
  if (signals.length > 0) {
    const { error: upsertError } = await supabase
      .from("osiris_world_signals")
      .upsert(signals, { onConflict: "source,external_id" });
    if (upsertError) errors.push(`upsert: ${upsertError.message}`);
    else upsertedCount = signals.length;
  }

  await supabase
    .from("osiris_world_signals")
    .delete()
    .lt("expires_at", new Date().toISOString());

  const status = errors.length === 0 ? "succeeded" : upsertedCount > 0 ? "partial" : "failed";
  await supabase
    .from("osiris_sync_runs")
    .update({
      status,
      completed_at: new Date().toISOString(),
      fetched_count: fetchedCount,
      matched_count: signals.length,
      upserted_count: upsertedCount,
      errors,
    })
    .eq("id", run.id);

  return Response.json({
    status,
    fetched: fetchedCount,
    matched: signals.length,
    upserted: upsertedCount,
    activeCorridors: activeCorridors.length,
    errors,
  }, { status: status === "failed" ? 502 : 200 });
});
