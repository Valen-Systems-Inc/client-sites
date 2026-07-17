import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const siteDir = path.dirname(seoDir);
const dataDir = path.join(seoDir, "data");
const inputsDir = path.join(seoDir, "inputs");
const reportsDir = path.join(seoDir, "reports");

const outFile = path.join(inputsDir, "keyword-universe.json");
const csvFile = path.join(inputsDir, "keyword-universe.csv");
const reportFile = path.join(reportsDir, "keyword-universe-report.json");

function parseArgs(argv = process.argv.slice(2)) {
  const opts = { marketScope: "all", suggest: false, suggestLimit: 80, delayMs: 250 };
  for (const arg of argv) {
    if (arg === "--suggest") opts.suggest = true;
    else if (arg.startsWith("--market-scope=")) opts.marketScope = arg.slice("--market-scope=".length);
    else if (arg.startsWith("--suggest-limit=")) opts.suggestLimit = Number(arg.slice("--suggest-limit=".length));
    else if (arg.startsWith("--delay-ms=")) opts.delayMs = Number(arg.slice("--delay-ms=".length));
  }
  return opts;
}

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeCsv(file, rows) {
  const headers = Object.keys(rows[0] ?? {});
  const escape = (value) => {
    const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${headers.join(",")}\n${rows.map((row) => headers.map((header) => escape(row[header])).join(",")).join("\n")}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeQuery(query) {
  return String(query ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromSlug(slug) {
  return String(slug ?? "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pageIndex(queue) {
  const index = new Map();
  for (const page of [...(queue.first_wave ?? []), ...(queue.backlog ?? [])]) {
    index.set(`${page.market_slug}|${page.service_slug ?? "hub"}`, page);
  }
  return index;
}

function targetPage(index, market, serviceSlug) {
  return index.get(`${market.slug}|${serviceSlug ?? "hub"}`) ?? index.get(`${market.slug}|hub`) ?? null;
}

function marketWeight(market, strategy) {
  if (market.slug === strategy.primaryMarket) return 100;
  if (market.slug === strategy.firstVisibilityGap) return 96;
  if ((strategy.supportMarkets ?? []).includes(market.slug)) return 82;
  if (market.priority === "primary") return 70;
  if (market.priority === "main") return 100;
  if (market.priority === "first-gap") return 96;
  return 45;
}

function serviceWeight(serviceSlug, term) {
  const text = `${serviceSlug ?? ""} ${term}`.toLowerCase();
  if ((serviceSlug === null || serviceSlug === "emergency-plumbing") && (text.includes("emergency") || text.includes("24 hour"))) return 105;
  if (/\bplumber\b|\bplumbing company\b/.test(text)) return 92;
  if (text.includes("emergency")) return 84;
  if (text.includes("drain") || text.includes("sewer") || text.includes("leak") || text.includes("water heater")) return 82;
  if (text.includes("gas") || text.includes("slab") || text.includes("repipe")) return 70;
  return 60;
}

function templateWeight(template) {
  if (template.startsWith("city term")) return 112;
  if (template.startsWith("term city")) return 108;
  if (template.startsWith("term in city")) return 104;
  if (template.includes("near me")) return 98;
  if (template.includes("open now") || template.includes("24 hour")) return 82;
  if (template.startsWith("best")) return 62;
  return 70;
}

function serviceTerms(service) {
  if (!service) {
    return [
      "plumber",
      "plumbers",
      "plumbing",
      "plumbing company",
      "plumbing service",
      "emergency plumber",
      "24 hour plumber",
      "same day plumber",
      "licensed plumber",
      "local plumber",
    ];
  }

  const name = normalizeQuery(service.name);
  const core = name
    .replace(/\b(repair|install|installation|services|service)\b/g, " ")
    .replace(/\band\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const terms = new Set([name, core].filter((item) => item && item.length > 2));
  if (!/\b(plumbing|plumber)\b/.test(core)) terms.add(`${core} plumber`);
  terms.add(`${core} service`);
  if (service.emergency && !core.includes("emergency")) terms.add(`emergency ${core}`);
  if (service.slug === "drain-cleaning") {
    terms.add("rooter service");
    terms.add("clogged drain");
    terms.add("drain plumber");
  }
  if (service.slug === "water-heater-repair-install") {
    terms.add("water heater repair");
    terms.add("water heater installation");
    terms.add("tankless water heater plumber");
  }
  if (service.slug === "leak-detection") {
    terms.add("water leak detection");
    terms.add("leak repair plumber");
  }
  if (service.slug === "sewer-line-repair") {
    terms.add("sewer repair");
    terms.add("sewer line plumber");
  }
  return [...terms];
}

function geoTerms(market) {
  const terms = [
    { value: market.city, type: "city", weight: 100 },
    { value: `${market.city} ca`, type: "city_state", weight: 96 },
  ];
  if (market.zip_primary) terms.push({ value: market.zip_primary, type: "zip", weight: 44 });
  for (const neighborhood of market.neighborhoods ?? []) {
    terms.push({ value: neighborhood, type: "neighborhood", weight: 62 });
    terms.push({ value: `${neighborhood} ${market.city}`, type: "neighborhood_city", weight: 58 });
  }
  return terms.filter((term) => term.value);
}

function queryTemplates(term, geo) {
  return [
    { label: "term city", query: `${term} ${geo.value}` },
    { label: "city term", query: `${geo.value} ${term}` },
    { label: "term in city", query: `${term} in ${geo.value}` },
    { label: "term near city", query: `${term} near ${geo.value}` },
    { label: "best term city", query: `best ${term} ${geo.value}` },
    { label: "term open now city", query: `${term} open now ${geo.value}` },
    ...(geo.type === "city" ? [{ label: "term near me", query: `${term} near me` }] : []),
  ];
}

function demandRecordFor(query, demandInput) {
  const normalized = normalizeQuery(query);
  const candidates = demandInput.keywords ?? demandInput.queries ?? [];
  if (Array.isArray(candidates)) {
    return candidates.find((entry) => normalizeQuery(entry.query ?? entry.keyword) === normalized) ?? null;
  }
  return candidates[normalized] ?? candidates[query] ?? null;
}

async function googleSuggest(query) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "ValenClientSiteTools/0.1 keyword-universe demand proxy",
      accept: "application/json,text/plain,*/*",
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const body = await response.json();
  return Array.isArray(body?.[1]) ? body[1].map(normalizeQuery) : [];
}

function serpCoverage(query, searchIntel) {
  const normalized = normalizeQuery(query);
  const row = (searchIntel?.rawSearches ?? []).find((item) => normalizeQuery(item.query) === normalized);
  if (!row) return null;
  return {
    source: row.source,
    resultCount: row.resultCount,
    topHosts: (row.results ?? []).slice(0, 10).map((result) => result.host).filter(Boolean),
  };
}

const opts = parseArgs();
const [marketsAll, services, stackConfig, queue, demandInput, searchIntel] = await Promise.all([
  readJson(path.join(dataDir, "markets.json"), []),
  readJson(path.join(dataDir, "services.json"), []),
  readJson(path.join(seoDir, "config", "stack.json"), {}),
  readJson(path.join(reportsDir, "microsite-deployment-queue.json"), { first_wave: [], backlog: [] }),
  readJson(path.join(inputsDir, "keyword-demand.json"), {}),
  readJson(path.join(dataDir, "search-intel.json"), {}),
]);

const strategy = stackConfig.marketStrategy ?? {};
const marketList =
  opts.marketScope === "focus"
    ? marketsAll.filter((market) => [strategy.primaryMarket, strategy.firstVisibilityGap, ...(strategy.supportMarkets ?? [])].includes(market.slug))
    : marketsAll;
const pages = pageIndex(queue);
const rows = [];
const seen = new Set();

for (const market of marketList) {
  const geos = geoTerms(market);
  const marketScore = marketWeight(market, strategy);
  const page = targetPage(pages, market, null);
  for (const term of serviceTerms(null)) {
    const urgentGeneral = term.includes("emergency") || term.includes("24 hour") || term.includes("same day");
    const termPage = urgentGeneral ? targetPage(pages, market, "emergency-plumbing") ?? page : page;
    for (const geo of geos) {
      for (const template of queryTemplates(term, geo)) {
        const query = normalizeQuery(template.query);
        const key = `${query}|${market.slug}|hub`;
        if (seen.has(key)) continue;
        seen.add(key);
        const demand = demandRecordFor(query, demandInput);
        const serp = serpCoverage(query, searchIntel);
        rows.push({
          query,
          market: market.slug,
          city: market.city,
          county: market.county,
          serviceSlug: urgentGeneral ? "emergency-plumbing" : null,
          service: urgentGeneral ? "Emergency Plumbing" : "All Plumbing Services",
          intentClass: term.includes("emergency") || term.includes("24 hour") ? "urgent_plumber" : "local_plumber",
          template: template.label,
          targetPath: termPage?.target_path ?? page?.target_path ?? `/${market.slug}-plumber`,
          targetUrl: termPage?.target_url ?? page?.target_url ?? `${stackConfig.canonicalDomain}/${market.slug}-plumber`,
          demandProxyScore: marketScore + geo.weight + serviceWeight(null, term) + templateWeight(template.label),
          searchVolumeMonthly: demand?.searchVolumeMonthly ?? demand?.volume ?? null,
          demandSource: demand?.source ?? null,
          competition: demand?.competition ?? null,
          serpSource: serp?.source ?? null,
          topRankingHosts: serp?.topHosts ?? [],
          tags: ["plumber", market.slug, term.replaceAll(" ", "-")],
        });
      }
    }
  }

  for (const service of services) {
    const servicePage = targetPage(pages, market, service.slug);
    for (const term of serviceTerms(service)) {
      for (const geo of geos) {
        for (const template of queryTemplates(term, geo)) {
          const query = normalizeQuery(template.query);
          const key = `${query}|${market.slug}|${service.slug}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const demand = demandRecordFor(query, demandInput);
          const serp = serpCoverage(query, searchIntel);
          rows.push({
            query,
            market: market.slug,
            city: market.city,
            county: market.county,
            serviceSlug: service.slug,
            service: service.name,
            intentClass: service.emergency || term.includes("emergency") || term.includes("24 hour") ? "urgent_service" : "service_local",
            template: template.label,
            targetPath: servicePage?.target_path ?? page?.target_path ?? `/${market.slug}-plumber`,
            targetUrl: servicePage?.target_url ?? page?.target_url ?? `${stackConfig.canonicalDomain}/${market.slug}-plumber`,
            demandProxyScore: marketScore + geo.weight + serviceWeight(service.slug, term) + templateWeight(template.label),
            searchVolumeMonthly: demand?.searchVolumeMonthly ?? demand?.volume ?? null,
            demandSource: demand?.source ?? null,
            competition: demand?.competition ?? null,
            serpSource: serp?.source ?? null,
            topRankingHosts: serp?.topHosts ?? [],
            tags: ["plumber", market.slug, service.slug],
          });
        }
      }
    }
  }

  for (const query of [`masterflow plumbing ${market.city}`, `masterflow plumber ${market.city}`, `master flow plumbing ${market.city}`]) {
    const normalized = normalizeQuery(query);
    const key = `${normalized}|${market.slug}|brand`;
    if (seen.has(key)) continue;
    seen.add(key);
    const demand = demandRecordFor(normalized, demandInput);
    const serp = serpCoverage(normalized, searchIntel);
    rows.push({
      query: normalized,
      market: market.slug,
      city: market.city,
      county: market.county,
      serviceSlug: null,
      service: "Brand Local",
      intentClass: "brand_local",
      template: "brand city",
      targetPath: page?.target_path ?? `/${market.slug}-plumber`,
      targetUrl: page?.target_url ?? `${stackConfig.canonicalDomain}/${market.slug}-plumber`,
      demandProxyScore: marketScore + 120,
      searchVolumeMonthly: demand?.searchVolumeMonthly ?? demand?.volume ?? null,
      demandSource: demand?.source ?? null,
      competition: demand?.competition ?? null,
      serpSource: serp?.source ?? null,
      topRankingHosts: serp?.topHosts ?? [],
      tags: ["masterflow", market.slug, "brand"],
    });
  }
}

rows.sort((a, b) => {
  const aVolume = Number(a.searchVolumeMonthly ?? -1);
  const bVolume = Number(b.searchVolumeMonthly ?? -1);
  if (aVolume !== bVolume) return bVolume - aVolume;
  return b.demandProxyScore - a.demandProxyScore || a.query.localeCompare(b.query);
});

const suggestErrors = [];
if (opts.suggest) {
  for (const row of rows.slice(0, opts.suggestLimit)) {
    try {
      const suggestions = await googleSuggest(row.query);
      row.googleAutocompleteSuggestions = suggestions;
      row.googleAutocompleteMatch = suggestions.includes(row.query);
      row.demandProxyScore += Math.min(40, suggestions.length * 4);
    } catch (error) {
      suggestErrors.push({ query: row.query, error: error.message });
    }
    await sleep(opts.delayMs);
  }
  rows.sort((a, b) => b.demandProxyScore - a.demandProxyScore || a.query.localeCompare(b.query));
}

const byMarket = Object.values(
  rows.reduce((acc, row) => {
    acc[row.market] ??= { market: row.market, queries: 0, withVolume: 0, withSerp: 0 };
    acc[row.market].queries += 1;
    if (row.searchVolumeMonthly !== null) acc[row.market].withVolume += 1;
    if (row.serpSource) acc[row.market].withSerp += 1;
    return acc;
  }, {}),
).sort((a, b) => b.queries - a.queries);

const payload = {
  generatedAt: new Date().toISOString(),
  client: "masterflow",
  marketScope: opts.marketScope,
  sourceModel: {
    keywordPermutationTool: "repo generator; compatible with the advertools kw_generate style of product/location/template expansion",
    demandTruth: "searchVolumeMonthly is null until keyword-demand.json is imported from Google Ads Keyword Planner, Google Trends, Search Console, or another demand source",
    autocompleteProxy: opts.suggest ? "Google autocomplete suggestions fetched for the highest-priority rows" : "not_fetched",
    serpTruth: "topRankingHosts is populated only where search-intel has scraped/imported SERP rows",
  },
  counts: {
    markets: marketList.length,
    services: services.length,
    keywordPermutations: rows.length,
    withSearchVolume: rows.filter((row) => row.searchVolumeMonthly !== null).length,
    withSerpTopPages: rows.filter((row) => row.serpSource).length,
    suggestErrors: suggestErrors.length,
  },
  byMarket,
  topPriority: rows.slice(0, 250),
  keywords: rows,
  suggestErrors,
};

await writeJson(outFile, payload);
await writeCsv(
  csvFile,
  rows.map((row) => ({
    query: row.query,
    market: row.market,
    service: row.service,
    intentClass: row.intentClass,
    targetPath: row.targetPath,
    demandProxyScore: row.demandProxyScore,
    searchVolumeMonthly: row.searchVolumeMonthly,
    demandSource: row.demandSource,
    serpSource: row.serpSource,
    topRankingHosts: row.topRankingHosts.join("|"),
  })),
);
await writeJson(reportFile, {
  generatedAt: payload.generatedAt,
  client: payload.client,
  marketScope: payload.marketScope,
  counts: payload.counts,
  byMarket: payload.byMarket,
  topPriority: payload.topPriority.slice(0, 25).map((row) => ({
    query: row.query,
    market: row.market,
    service: row.service,
    targetPath: row.targetPath,
    demandProxyScore: row.demandProxyScore,
    searchVolumeMonthly: row.searchVolumeMonthly,
    demandSource: row.demandSource,
    serpSource: row.serpSource,
  })),
  sourceModel: payload.sourceModel,
});

console.log(`wrote ${path.relative(siteDir, outFile)} with ${rows.length} keyword permutations`);
