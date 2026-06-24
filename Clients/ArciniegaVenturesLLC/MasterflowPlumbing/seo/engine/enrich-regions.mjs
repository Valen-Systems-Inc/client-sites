import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSeoData } from "./build.mjs";

const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const outFile = path.join(seoDir, "data", "region-enrichment.json");

const userAgent = "ValenSystems-MasterflowSEO/0.1 (public-data enrichment; no personal data)";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, { timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": userAgent, accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) {
      const text = await response.text();
      throw new Error(`expected JSON, got ${contentType || "unknown content type"}: ${text.replace(/\s+/g, " ").slice(0, 120)}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function getCensusPlaces() {
  const key = process.env.CENSUS_API_KEY;
  if (!key) {
    return new Map([["__skipped__", { reason: "CENSUS_API_KEY not set; retained curated local population values" }]]);
  }
  const url = `https://api.census.gov/data/2023/acs/acs5?get=NAME,B01003_001E&for=place:*&in=state:06&key=${encodeURIComponent(key)}`;
  try {
    const rows = await fetchJson(url);
    const [headers, ...body] = rows;
    const nameIndex = headers.indexOf("NAME");
    const popIndex = headers.indexOf("B01003_001E");
    const map = new Map();
    for (const row of body) {
      const name = String(row[nameIndex] ?? "").replace(/ city, California| CDP, California| town, California/i, "");
      map.set(name.toLowerCase(), {
        source: "US Census ACS 2023 5-year place population",
        population: Number(row[popIndex]) || null,
        geoid: `06${row[headers.indexOf("place")]}`,
      });
    }
    return map;
  } catch (error) {
    return new Map([["__error__", { error: error.message }]]);
  }
}

async function getNominatimPlace(market) {
  const query = encodeURIComponent(`${market.city}, ${market.county}, California, USA`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=jsonv2&limit=1&addressdetails=1&extratags=1`;
  try {
    const rows = await fetchJson(url);
    const row = rows[0];
    if (!row) return { source: "OpenStreetMap Nominatim", found: false };
    return {
      source: "OpenStreetMap Nominatim",
      found: true,
      osm_type: row.osm_type,
      osm_id: row.osm_id,
      display_name: row.display_name,
      lat: Number(row.lat),
      lng: Number(row.lon),
      class: row.class,
      type: row.type,
      importance: row.importance,
    };
  } catch (error) {
    return { source: "OpenStreetMap Nominatim", found: false, error: error.message };
  }
}

const { markets } = await loadSeoData();
const census = await getCensusPlaces();
const censusError = census.get("__error__");
const censusSkipped = census.get("__skipped__");
const enriched = [];

for (const market of markets) {
  const censusPlace = census.get(market.city.toLowerCase()) ?? null;
  const nominatim = await getNominatimPlace(market);
  enriched.push({
    slug: market.slug,
    city: market.city,
    county: market.county,
    existing_population: market.population,
    census_population: censusPlace?.population ?? null,
    census_geoid: censusPlace?.geoid ?? null,
    public_coordinates: nominatim.found ? { lat: nominatim.lat, lng: nominatim.lng } : null,
    public_place: nominatim,
  });
  await sleep(1100);
}

const report = {
  generatedAt: new Date().toISOString(),
  ok: true,
  notes: [
    "Only public, non-personal region data is fetched.",
    "Existing hand-curated city signals remain authoritative for generated pages.",
    "Census or Nominatim failures do not block local preview generation.",
    "Set CENSUS_API_KEY to hydrate census_population and census_geoid when available.",
  ],
  sources: [
    "US Census ACS 2023 5-year API",
    "OpenStreetMap Nominatim search API",
  ],
  censusError: censusError?.error ?? null,
  censusSkipped: censusSkipped?.reason ?? null,
  regions: enriched,
};

await fs.writeFile(outFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(`wrote ${path.relative(process.cwd(), outFile)} with ${enriched.length} region enrichment rows`);
