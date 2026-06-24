import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { loadSeoData } from "./build.mjs";

const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const outFile = path.join(seoDir, "data", "search-intel.json");
const reportFile = path.join(seoDir, "reports", "search-intel-report.json");

const blockedHosts = [
  "google.com",
  "yelp.com",
  "angi.com",
  "homeadvisor.com",
  "thumbtack.com",
  "bbb.org",
  "mapquest.com",
  "facebook.com",
  "instagram.com",
  "nextdoor.com",
  "yellowpages.com",
  "porch.com",
  "houzz.com",
  "masterflowplumbing",
];

function parseArgs(argv = process.argv.slice(2)) {
  const opts = { full: false, limitMarkets: 6, limitServices: 5, delayMs: 1500 };
  for (const arg of argv) {
    if (arg === "--full") opts.full = true;
    else if (arg.startsWith("--limit-markets=")) opts.limitMarkets = Number(arg.slice("--limit-markets=".length));
    else if (arg.startsWith("--limit-services=")) opts.limitServices = Number(arg.slice("--limit-services=".length));
    else if (arg.startsWith("--delay-ms=")) opts.delayMs = Number(arg.slice("--delay-ms=".length));
  }
  return opts;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hostFor(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeDuckUrl(href) {
  if (!href) return "";
  try {
    const url = new URL(href, "https://duckduckgo.com");
    const redirect = url.searchParams.get("uddg");
    return redirect ? decodeURIComponent(redirect) : url.href;
  } catch {
    return href;
  }
}

function isCompetitorHost(host) {
  if (!host) return false;
  return !blockedHosts.some((blocked) => host.includes(blocked));
}

function keywordSeeds(market, service) {
  const city = `${market.city} CA`;
  const serviceName = service.name.toLowerCase().replace(/&/g, "and");
  const serviceCore = serviceName.replace(/\b(repair|install|installation|services|service)\b/g, "").replace(/\s+/g, " ").trim();
  return [
    `${serviceName} ${city}`,
    `${serviceCore} plumber ${city}`,
    `emergency plumber ${city}`,
    `${market.city} ${serviceCore} near me`,
  ];
}

async function fetchSearch(query) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "ValenSystems-MasterflowSEO/0.1 (public search intelligence; review only)",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];
  $(".result").each((index, node) => {
    const anchor = $(node).find(".result__a").first();
    const title = anchor.text().replace(/\s+/g, " ").trim();
    const url = normalizeDuckUrl(anchor.attr("href"));
    const snippet = $(node).find(".result__snippet").text().replace(/\s+/g, " ").trim();
    const host = hostFor(url);
    if (!title || !url) return;
    results.push({ rank: index + 1, title, url, host, snippet });
  });
  return { query, source: "duckduckgo-html", fetchedAt: new Date().toISOString(), resultCount: results.length, results };
}

function aggregate(rows) {
  const competitors = new Map();
  const keywords = new Map();
  for (const row of rows) {
    keywords.set(row.query, {
      query: row.query,
      market: row.market,
      service: row.service,
      resultCount: row.resultCount,
      usefulResultCount: row.results.filter((result) => isCompetitorHost(result.host)).length,
    });
    for (const result of row.results) {
      if (!isCompetitorHost(result.host)) continue;
      const existing = competitors.get(result.host) ?? {
        host: result.host,
        title: result.title,
        sampleUrl: result.url,
        mentions: 0,
        bestRank: result.rank,
        markets: new Set(),
        services: new Set(),
        queries: new Set(),
      };
      existing.mentions += 1;
      existing.bestRank = Math.min(existing.bestRank, result.rank);
      existing.markets.add(row.market.slug);
      existing.services.add(row.service.slug);
      existing.queries.add(row.query);
      competitors.set(result.host, existing);
    }
  }
  const competitorRows = [...competitors.values()]
    .map((item) => ({
      host: item.host,
      title: item.title,
      sampleUrl: item.sampleUrl,
      mentions: item.mentions,
      bestRank: item.bestRank,
      opportunityPressure: Math.round((item.mentions * 100) / Math.max(1, item.bestRank)),
      markets: [...item.markets].sort(),
      services: [...item.services].sort(),
      sampleQueries: [...item.queries].slice(0, 8),
    }))
    .sort((a, b) => b.opportunityPressure - a.opportunityPressure || a.bestRank - b.bestRank);
  return {
    competitors: competitorRows,
    keywordCandidates: [...keywords.values()].sort((a, b) => b.usefulResultCount - a.usefulResultCount),
  };
}

const opts = parseArgs();
const { markets, services } = await loadSeoData();
const selectedMarkets = opts.full ? markets : markets.slice(0, opts.limitMarkets);
const selectedServices = opts.full ? services : services.slice(0, opts.limitServices);
const rows = [];
const errors = [];

for (const market of selectedMarkets) {
  for (const service of selectedServices) {
    for (const query of keywordSeeds(market, service)) {
      try {
        const result = await fetchSearch(query);
        rows.push({ ...result, market: { slug: market.slug, city: market.city, county: market.county }, service: { slug: service.slug, name: service.name } });
      } catch (error) {
        errors.push({ query, market: market.slug, service: service.slug, error: error.message });
      }
      await sleep(opts.delayMs);
    }
  }
}

const aggregated = aggregate(rows);
const report = {
  generatedAt: new Date().toISOString(),
  ok: errors.length === 0,
  mode: opts.full ? "full" : "sample",
  counts: {
    markets: selectedMarkets.length,
    services: selectedServices.length,
    queries: rows.length,
    competitors: aggregated.competitors.length,
    errors: errors.length,
  },
  sources: ["DuckDuckGo HTML search results"],
  notes: [
    "Search intelligence is review-only and must not directly publish page claims.",
    "Competitor hosts are candidates for manual review, not assertions of market rank.",
    "Public publish, ads, outreach, and contact writes remain approval-gated.",
  ],
  errors,
};

await fs.mkdir(path.dirname(reportFile), { recursive: true });
await fs.writeFile(outFile, `${JSON.stringify({ ...report, ...aggregated, rawSearches: rows }, null, 2)}\n`);
await fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);

console.log(`wrote ${path.relative(process.cwd(), outFile)} with ${aggregated.competitors.length} competitor candidates from ${rows.length} searches`);
