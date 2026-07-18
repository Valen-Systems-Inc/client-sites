import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import * as cheerio from "cheerio";
import { loadSeoData } from "./build.mjs";

const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const outFile = path.join(seoDir, "data", "search-intel.json");
const reportFile = path.join(seoDir, "reports", "search-intel-report.json");
const stackConfigFile = path.join(seoDir, "config", "stack.json");
const execFileAsync = promisify(execFile);

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
  const defaultOpenSerpBin = process.env.OPENSERP_BIN || resolveLocalOpenSerpBin() || "openserp";
  const opts = {
    full: false,
    goalQueries: false,
    fromUniverse: false,
    limitMarkets: 6,
    limitServices: 5,
    limitQueries: 80,
    delayMs: 1500,
    limitResults: 10,
    provider: process.env.SEO_SERP_PROVIDER || "auto",
    serpEngine: process.env.SEO_SERP_ENGINE || "google",
    region: process.env.SEO_SERP_REGION || "US",
    lang: process.env.SEO_SERP_LANG || "EN",
    openserpBin: defaultOpenSerpBin,
    openserpUrl: process.env.OPENSERP_URL || "",
    importFile: "",
    importDir: "",
    importQuery: "",
  };
  for (const arg of argv) {
    if (arg === "--full") opts.full = true;
    else if (arg === "--goal-queries") opts.goalQueries = true;
    else if (arg === "--from-universe") opts.fromUniverse = true;
    else if (arg.startsWith("--limit-markets=")) opts.limitMarkets = Number(arg.slice("--limit-markets=".length));
    else if (arg.startsWith("--limit-services=")) opts.limitServices = Number(arg.slice("--limit-services=".length));
    else if (arg.startsWith("--limit-queries=")) opts.limitQueries = Number(arg.slice("--limit-queries=".length));
    else if (arg.startsWith("--delay-ms=")) opts.delayMs = Number(arg.slice("--delay-ms=".length));
    else if (arg.startsWith("--limit-results=")) opts.limitResults = Number(arg.slice("--limit-results=".length));
    else if (arg.startsWith("--provider=")) opts.provider = arg.slice("--provider=".length);
    else if (arg.startsWith("--serp-engine=")) opts.serpEngine = arg.slice("--serp-engine=".length);
    else if (arg.startsWith("--region=")) opts.region = arg.slice("--region=".length);
    else if (arg.startsWith("--lang=")) opts.lang = arg.slice("--lang=".length);
    else if (arg.startsWith("--openserp-bin=")) opts.openserpBin = arg.slice("--openserp-bin=".length);
    else if (arg.startsWith("--openserp-url=")) opts.openserpUrl = arg.slice("--openserp-url=".length);
    else if (arg.startsWith("--import-file=")) opts.importFile = arg.slice("--import-file=".length);
    else if (arg.startsWith("--import-dir=")) opts.importDir = arg.slice("--import-dir=".length);
    else if (arg.startsWith("--file=")) opts.importFile = arg.slice("--file=".length);
    else if (arg.startsWith("--query=")) opts.importQuery = arg.slice("--query=".length);
  }
  opts.provider = String(opts.provider).toLowerCase();
  opts.serpEngine = String(opts.serpEngine).toLowerCase();
  return opts;
}

function resolveLocalOpenSerpBin() {
  const home = process.env.HOME || "";
  if (!home) return null;
  for (const candidate of [path.join(home, ".local", "bin", "openserp"), path.join(home, "go", "bin", "openserp")]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function classifyProviderError(message) {
  const text = String(message ?? "");
  if (/captcha/i.test(text)) return "captcha_or_google_access";
  if (/rate.?limited|too many requests|\b429\b/i.test(text)) return "rate_limited_or_google_access";
  if (/ENOENT|command not found|executable file not found|no such file or directory/i.test(text)) return "missing_binary";
  if (/parser/i.test(text)) return "parser_or_serp_layout";
  return "provider_error";
}

function summarizeProviderError(message) {
  const text = String(message ?? "").replace(/\s+/g, " ").trim();
  const captcha = text.match(/Captcha detected:\s*([^"'\s]+)/i);
  if (captcha) return `Captcha detected: ${captcha[1]}`;
  const firstError = text.match(/Error:\s*([^]+)$/i);
  return (firstError?.[1] ?? text).slice(0, 500);
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

function normalizeGoogleUrl(href) {
  if (!href) return "";
  try {
    const url = new URL(href, "https://www.google.com");
    const redirected = url.searchParams.get("q") || url.searchParams.get("url");
    const candidate = redirected || url.href;
    const parsed = new URL(candidate);
    if (/google\./i.test(parsed.hostname) && ["/search", "/preferences", "/setprefs", "/sorry"].includes(parsed.pathname)) return "";
    return parsed.href;
  } catch {
    return "";
  }
}

function parseJsonOutput(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new Error("empty JSON output");
  const firstObject = trimmed.search(/[\[{]/);
  if (firstObject < 0) throw new Error(`no JSON object in output: ${trimmed.slice(0, 160)}`);
  return JSON.parse(trimmed.slice(firstObject));
}

function normalizeOpenSerpPayload(query, payload, opts, sourceKind) {
  const rawResults = Array.isArray(payload) ? payload : payload.results ?? payload.organic ?? payload.items ?? [];
  const results = rawResults
    .filter((result) => !result.type || result.type === "organic")
    .slice(0, opts.limitResults)
    .map((result, index) => {
      const url = result.url ?? result.link ?? result.href ?? "";
      return {
        rank: Number(result.rank ?? result.position?.absolute ?? result.position ?? index + 1),
        title: String(result.title ?? "").replace(/\s+/g, " ").trim(),
        url,
        host: String(result.domain ?? hostFor(url)).replace(/^www\./, "").toLowerCase(),
        snippet: String(result.snippet ?? result.description ?? "").replace(/\s+/g, " ").trim(),
        type: result.type ?? "organic",
      };
    })
    .filter((result) => result.title && result.url);
  return {
    query,
    source: `${opts.serpEngine}-openserp-${sourceKind}`,
    serpEngine: opts.serpEngine,
    fetchedAt: new Date().toISOString(),
    resultCount: results.length,
    results,
  };
}

async function fetchOpenSerpApi(query, opts) {
  const base = opts.openserpUrl.replace(/\/$/, "");
  const url = new URL(`${base}/${opts.serpEngine}/search`);
  url.searchParams.set("text", query);
  url.searchParams.set("limit", String(opts.limitResults));
  url.searchParams.set("region", opts.region);
  url.searchParams.set("lang", opts.lang);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const text = await response.text();
  if (!response.ok) throw new Error(`OpenSERP API failed ${response.status}: ${text.slice(0, 200)}`);
  return normalizeOpenSerpPayload(query, parseJsonOutput(text), opts, "api");
}

async function fetchOpenSerpCli(query, opts) {
  const args = [
    "search",
    opts.serpEngine,
    query,
    "--limit",
    String(opts.limitResults),
    "--region",
    opts.region,
    "--lang",
    opts.lang,
    "--format",
    "json",
  ];
  const { stdout } = await execFileAsync(opts.openserpBin, args, {
    timeout: 45000,
    maxBuffer: 1024 * 1024 * 5,
  });
  return normalizeOpenSerpPayload(query, parseJsonOutput(stdout), opts, "cli");
}

async function fetchOpenSerpSearch(query, opts) {
  return opts.openserpUrl ? fetchOpenSerpApi(query, opts) : fetchOpenSerpCli(query, opts);
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

async function fetchDuckDuckGoSearch(query) {
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

let openSerpDisabledReason = null;

async function fetchSearch(query, opts) {
  if (opts.provider === "duckduckgo") return fetchDuckDuckGoSearch(query);
  if (opts.provider === "openserp") return fetchOpenSerpSearch(query, opts);
  if (opts.provider !== "auto") throw new Error(`Unknown search provider: ${opts.provider}`);
  if (openSerpDisabledReason) {
    const result = await fetchDuckDuckGoSearch(query);
    return { ...result, fallbackFrom: `${opts.serpEngine}-openserp`, providerWarning: openSerpDisabledReason };
  }
  try {
    return await fetchOpenSerpSearch(query, opts);
  } catch (error) {
    openSerpDisabledReason = error.message;
    const result = await fetchDuckDuckGoSearch(query);
    return { ...result, fallbackFrom: `${opts.serpEngine}-openserp`, providerWarning: error.message };
  }
}

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

function csvCell(value) {
  return String(value ?? "").trim();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(csvCell(cell));
      cell = "";
    } else if (char === "\n") {
      row.push(csvCell(cell));
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(csvCell(cell));
    rows.push(row);
  }
  const [headers = [], ...body] = rows.filter((line) => line.some((value) => value !== ""));
  return body.map((line) => Object.fromEntries(headers.map((header, index) => [header, line[index] ?? ""])));
}

function normalizeFieldName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function pick(row, names) {
  if (!row || typeof row !== "object") return null;
  const entries = new Map(Object.entries(row).map(([key, value]) => [normalizeFieldName(key), value]));
  for (const name of names) {
    const value = entries.get(normalizeFieldName(name));
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

async function readImportRecords(file) {
  const text = await fs.readFile(file, "utf8");
  const ext = path.extname(file).toLowerCase();
  if ([".html", ".htm"].includes(ext)) {
    return { html: text, container: { file } };
  }
  if (ext === ".json") {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return { records: parsed, container: {} };
    if (Array.isArray(parsed.rawSearches)) return { searches: parsed.rawSearches, container: parsed };
    if (Array.isArray(parsed.searches)) return { searches: parsed.searches, container: parsed };
    if (Array.isArray(parsed.rows)) return { records: parsed.rows, container: parsed };
    if (Array.isArray(parsed.results)) return { searches: [parsed], container: parsed };
    if (Array.isArray(parsed.items)) return { searches: [parsed], container: parsed };
    return { records: [parsed], container: parsed };
  }
  return { records: parseCsv(text), container: {} };
}

function number(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(String(value).replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeImportedResult(result, index) {
  const url = pick(result, ["url", "link", "href", "resultUrl"]);
  const title = pick(result, ["title", "name", "heading"]) ?? "";
  if (!url || !title) return null;
  return {
    rank: number(pick(result, ["rank", "position", "absolutePosition"]), index + 1),
    title: String(title).replace(/\s+/g, " ").trim(),
    url,
    host: String(pick(result, ["host", "domain"]) ?? hostFor(url)).replace(/^www\./, "").toLowerCase(),
    snippet: String(pick(result, ["snippet", "description", "summary"]) ?? "").replace(/\s+/g, " ").trim(),
    type: pick(result, ["type"]) ?? "organic",
  };
}

function plannedContextForQuery(query, plannedByQuery) {
  return plannedByQuery.get(String(query ?? "").toLowerCase()) ?? null;
}

function queryFromGoogleHtml($, opts, container = {}) {
  const explicit = opts.importQuery || pick(container, ["query", "keyword", "search", "searchTerm"]);
  if (explicit) return explicit;
  const fieldValue = $("textarea[name='q'], input[name='q']").first().val();
  if (fieldValue) return String(fieldValue).trim();
  const title = $("title").first().text().replace(/\s+/g, " ").trim();
  const match = title.match(/^(.*?)\s+-\s+Google(?: Search)?$/i);
  return (match?.[1] ?? "").trim() || queryFromImportFilename(container.file) || null;
}

function queryFromImportFilename(file) {
  if (!file) return null;
  const base = path.basename(file, path.extname(file));
  const cleaned = base
    .replace(/\b(google|serp|search|results|capture|html|csv|json)\b/gi, " ")
    .replace(/[-_+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

function snippetFromGoogleResult($, anchor, title) {
  const text = $(anchor)
    .closest("div")
    .parent()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  return text.replace(title, "").replace(/\s+/g, " ").trim().slice(0, 500);
}

function normalizeImportedHtml(html, opts, plannedByQuery, container = {}) {
  const $ = cheerio.load(html);
  const query = queryFromGoogleHtml($, opts, container);
  if (!query) return null;
  const seen = new Set();
  const results = [];
  $("a").each((_, anchor) => {
    const title = $(anchor).find("h3").first().text().replace(/\s+/g, " ").trim();
    if (!title) return;
    const url = normalizeGoogleUrl($(anchor).attr("href"));
    if (!url || seen.has(url)) return;
    seen.add(url);
    results.push({
      rank: results.length + 1,
      title,
      url,
      host: hostFor(url),
      snippet: snippetFromGoogleResult($, anchor, title),
      type: "organic",
    });
  });
  const limitedResults = results.slice(0, opts.limitResults);
  if (!limitedResults.length) return null;
  const context = plannedContextForQuery(query, plannedByQuery);
  return {
    query,
    source: "google-html-import",
    serpEngine: "google",
    fetchedAt: new Date().toISOString(),
    resultCount: limitedResults.length,
    results: limitedResults,
    market: context?.market ?? null,
    service: context?.service ?? null,
    goal: context?.goal ?? null,
    universe: context?.universe ?? null,
    importVerified: true,
  };
}

function normalizeImportedSearch(search, opts, plannedByQuery, container = {}) {
  const query = pick(search, ["query", "keyword", "search", "searchTerm"]) ?? opts.importQuery ?? pick(container, ["query", "keyword", "search", "searchTerm"]);
  if (!query) return null;
  const rawResults = search.results ?? search.organic ?? search.items ?? search.rows ?? [];
  const results = rawResults.map((result, index) => normalizeImportedResult(result, index)).filter(Boolean).slice(0, opts.limitResults);
  if (!results.length) return null;
  const context = plannedContextForQuery(query, plannedByQuery);
  return {
    query,
    source: "google-manual-import",
    serpEngine: "google",
    fetchedAt: pick(search, ["fetchedAt", "date", "capturedAt"]) ?? new Date().toISOString(),
    resultCount: results.length,
    results,
    market: context?.market ?? null,
    service: context?.service ?? null,
    goal: context?.goal ?? null,
    universe: context?.universe ?? null,
    importVerified: true,
  };
}

function normalizeImportedRecordRows(records, opts, plannedByQuery, container = {}) {
  const grouped = new Map();
  for (const record of records) {
    const query =
      pick(record, ["query", "keyword", "search", "searchTerm"]) ??
      opts.importQuery ??
      pick(container, ["query", "keyword", "search", "searchTerm"]) ??
      queryFromImportFilename(container.file);
    if (!query) continue;
    const result = normalizeImportedResult(record, Number(grouped.get(query)?.length ?? 0));
    if (!result) continue;
    if (!grouped.has(query)) grouped.set(query, []);
    grouped.get(query).push(result);
  }
  return [...grouped.entries()].map(([query, results]) => {
    const context = plannedContextForQuery(query, plannedByQuery);
    return {
      query,
      source: "google-manual-import",
      serpEngine: "google",
      fetchedAt: new Date().toISOString(),
      resultCount: results.length,
      results: results.slice(0, opts.limitResults),
      market: context?.market ?? null,
      service: context?.service ?? null,
      goal: context?.goal ?? null,
      universe: context?.universe ?? null,
      importVerified: true,
    };
  });
}

async function importedSearchRows(opts, plannedByQuery) {
  const file = path.resolve(process.cwd(), opts.importFile);
  const { records, searches, html, container } = await readImportRecords(file);
  const rows = html
    ? [normalizeImportedHtml(html, opts, plannedByQuery, container)].filter(Boolean)
    : searches
    ? searches.map((search) => normalizeImportedSearch(search, opts, plannedByQuery, container)).filter(Boolean)
    : normalizeImportedRecordRows(records ?? [], opts, plannedByQuery, container);
  return rows.map((row) => ({ ...row, importFile: path.relative(process.cwd(), file) }));
}

async function importFilesFromDir(dir) {
  const absDir = path.resolve(process.cwd(), dir);
  let entries = [];
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(absDir, entry.name))
    .filter((file) => [".csv", ".json", ".html", ".htm"].includes(path.extname(file).toLowerCase()))
    .sort();
}

async function importedSearchRowsFromDir(opts, plannedByQuery) {
  const files = await importFilesFromDir(opts.importDir);
  const allRows = [];
  for (const file of files) {
    allRows.push(...(await importedSearchRows({ ...opts, importFile: file }, plannedByQuery)));
  }
  return allRows;
}

function goalQueryRows(stackConfig) {
  return (stackConfig.visibilityGoals ?? []).flatMap((goal) =>
    (goal.queries ?? []).map((query) => ({
      query,
      market: {
        slug: goal.market,
        city: goal.market
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" "),
        county: null,
      },
      service: {
        slug: goal.id,
        name: goal.id,
      },
      goal: {
        id: goal.id,
        priority: goal.priority,
        targetPath: goal.targetPath,
        targetUrl: goal.targetUrl,
      },
    })),
  );
}

function aggregate(rows) {
  const competitors = new Map();
  const keywords = new Map();
  for (const row of rows) {
    const marketSlug = row.market?.slug ?? "imported";
    const serviceSlug = row.service?.slug ?? "imported";
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
      existing.markets.add(marketSlug);
      existing.services.add(serviceSlug);
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
const stackConfig = await readJson(stackConfigFile, {});
const keywordUniverse = await readJson(path.join(seoDir, "inputs", "keyword-universe.json"), {});
const selectedMarkets = opts.full ? markets : markets.slice(0, opts.limitMarkets);
const selectedServices = opts.full ? services : services.slice(0, opts.limitServices);
const queryCandidates = opts.fromUniverse
  ? (keywordUniverse.topPriority ?? keywordUniverse.keywords ?? []).map((row) => ({
      query: row.query,
      market: { slug: row.market, city: row.city ?? row.market, county: row.county ?? null },
      service: { slug: row.serviceSlug ?? "hub", name: row.service ?? "All Plumbing Services" },
      goal: null,
      universe: {
        targetPath: row.targetPath,
        targetUrl: row.targetUrl,
        intentClass: row.intentClass,
        demandProxyScore: row.demandProxyScore,
        searchVolumeMonthly: row.searchVolumeMonthly ?? null,
        demandSource: row.demandSource ?? null,
      },
    }))
  : opts.goalQueries
    ? goalQueryRows(stackConfig)
    : selectedMarkets.flatMap((market) =>
      selectedServices.flatMap((service) =>
        keywordSeeds(market, service).map((query) => ({
          query,
          market: { slug: market.slug, city: market.city, county: market.county },
          service: { slug: service.slug, name: service.name },
          goal: null,
        })),
      ),
    );
const plannedQueries = queryCandidates.slice(0, opts.limitQueries);
const universeContextRows = (keywordUniverse.topPriority ?? keywordUniverse.keywords ?? []).map((row) => ({
  query: row.query,
  market: { slug: row.market, city: row.city ?? row.market, county: row.county ?? null },
  service: { slug: row.serviceSlug ?? "hub", name: row.service ?? "All Plumbing Services" },
  goal: null,
  universe: {
    targetPath: row.targetPath,
    targetUrl: row.targetUrl,
    intentClass: row.intentClass,
    demandProxyScore: row.demandProxyScore,
    searchVolumeMonthly: row.searchVolumeMonthly ?? null,
    demandSource: row.demandSource ?? null,
  },
}));
const plannedByQuery = new Map();
for (const planned of [...queryCandidates, ...universeContextRows, ...goalQueryRows(stackConfig)]) {
  plannedByQuery.set(String(planned.query ?? "").toLowerCase(), planned);
}
let rows = [];
const errors = [];

if (opts.importDir) {
  rows = await importedSearchRowsFromDir(opts, plannedByQuery);
  if (!rows.length) errors.push({ query: opts.importQuery || null, market: null, service: null, goal: null, error: `No importable SERP rows found in ${opts.importDir}` });
} else if (opts.importFile) {
  rows = await importedSearchRows(opts, plannedByQuery);
  if (!rows.length) errors.push({ query: opts.importQuery || null, market: null, service: null, goal: null, error: `No importable SERP rows found in ${opts.importFile}` });
} else {
  for (const planned of plannedQueries) {
    try {
      const result = await fetchSearch(planned.query, opts);
      rows.push({
        ...result,
        resultCount: Math.min(result.resultCount, opts.limitResults),
        results: result.results.slice(0, opts.limitResults),
        market: planned.market,
        service: planned.service,
        goal: planned.goal,
        universe: planned.universe ?? null,
      });
    } catch (error) {
      errors.push({ query: planned.query, market: planned.market.slug, service: planned.service.slug, goal: planned.goal?.id ?? null, error: error.message });
    }
    await sleep(opts.delayMs);
  }
}

const aggregated = aggregate(rows);
const sources = [...new Set(rows.map((row) => row.source).filter(Boolean))].sort();
const providerWarnings = [
  ...new Map(
    rows
      .filter((row) => row.providerWarning)
      .map((row) => [
        `${row.fallbackFrom}:${row.providerWarning}`,
        {
          provider: row.fallbackFrom,
          warning: row.providerWarning,
          firstQuery: row.query,
        },
      ]),
  ).values(),
];
const isImportedGoogleEvidence = rows.some((row) => row.source === "google-manual-import" || row.source === "google-html-import");
const usingImport = Boolean(opts.importFile || opts.importDir);
const providerBlocker = usingImport
  ? null
  : openSerpDisabledReason
  ? {
      provider: `${opts.serpEngine}-openserp`,
      reason: summarizeProviderError(openSerpDisabledReason),
      category: classifyProviderError(openSerpDisabledReason),
    }
  : errors.find((error) => /captcha/i.test(error.error))
    ? {
        provider: `${opts.serpEngine}-openserp`,
        reason: summarizeProviderError(errors.find((error) => /captcha/i.test(error.error))?.error),
        category: "captcha_or_google_access",
      }
    : null;
const googleOrganicTop10 = rows.some((row) => row.source === "google-openserp-api" || row.source === "google-openserp-cli" || row.source === "google-manual-import" || row.source === "google-html-import");
const importFileForReport = opts.importFile ? path.relative(process.cwd(), opts.importFile) : null;
const importDirForReport = opts.importDir ? path.relative(process.cwd(), opts.importDir) : null;
const report = {
  generatedAt: new Date().toISOString(),
  ok: errors.length === 0 && (opts.provider !== "openserp" || googleOrganicTop10),
  mode: usingImport ? "google-serp-import" : opts.fromUniverse ? "keyword-universe-priority" : opts.goalQueries ? "visibility-goal-queries" : opts.full ? "full" : "sample",
  provider: {
    requested: usingImport ? "import" : opts.provider,
    engine: opts.serpEngine,
    region: opts.region,
    lang: opts.lang,
    openserpBin: opts.openserpBin,
    openserpUrl: opts.openserpUrl || null,
    openserpDisabledReason: usingImport ? null : openSerpDisabledReason,
    fallbackUsed: rows.some((row) => row.fallbackFrom),
    importFile: importFileForReport,
    importDir: importDirForReport,
  },
  counts: {
    markets: selectedMarkets.length,
    services: selectedServices.length,
    goalQueries: opts.goalQueries ? plannedQueries.length : 0,
    universeQueries: opts.fromUniverse ? plannedQueries.length : 0,
    queries: rows.length,
    googleQueries: rows.filter((row) => row.source === "google-openserp-api" || row.source === "google-openserp-cli" || row.source === "google-manual-import" || row.source === "google-html-import").length,
    competitors: aggregated.competitors.length,
    errors: errors.length,
    providerWarnings: providerWarnings.length,
  },
  organicResultLimit: opts.limitResults,
  googleOrganicTop10,
  sources,
  notes: [
    "Search intelligence is review-only and must not directly publish page claims.",
    isImportedGoogleEvidence
      ? "Google organic top-10 evidence came from a verified CSV, JSON, or HTML import; keep source capture metadata with the imported file for audit."
      : googleOrganicTop10
      ? "Google organic top-10 evidence came from OpenSERP; keep proxy/captcha health visible before treating it as durable rank truth."
      : "Google organic top-10 evidence is still missing; OpenSERP can provide it once Google access, proxy, or captcha solving is working.",
    "Competitor hosts are candidates for manual review, not assertions of market rank.",
    "Public publish, ads, outreach, and contact writes remain approval-gated.",
  ],
  providerWarnings,
  providerBlocker,
  errors,
};
const previousData = await readJson(outFile, null);
const preservePreviousData = opts.provider === "auto" && rows.length === 0 && Array.isArray(previousData?.rawSearches) && previousData.rawSearches.length > 0;
const outputData = preservePreviousData
  ? {
      ...previousData,
      generatedAt: report.generatedAt,
      googleOrganicTop10: false,
      staleDueToProviderFailure: true,
      latestProviderFailure: report,
      notes: [
        ...(previousData.notes ?? []),
        "Latest auto provider pass returned no rows; previous search-intel data is preserved to avoid deleting competitor context.",
      ],
    }
  : { ...report, ...aggregated, rawSearches: rows };
if (preservePreviousData) {
  report.preservedPreviousData = {
    rawSearches: previousData.rawSearches.length,
    competitors: previousData.competitors?.length ?? 0,
    previousGeneratedAt: previousData.generatedAt ?? null,
  };
}

await fs.mkdir(path.dirname(reportFile), { recursive: true });
await fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
await fs.writeFile(outFile, `${JSON.stringify(outputData, null, 2)}\n`);

console.log(`wrote ${path.relative(process.cwd(), outFile)} with ${aggregated.competitors.length} competitor candidates from ${rows.length} searches`);
if (!report.ok && (opts.provider === "openserp" || rows.length === 0)) process.exitCode = 2;
