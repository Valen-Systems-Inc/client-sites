import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { loadSeoData } from "./build.mjs";

const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const siteDir = path.dirname(seoDir);
const searchIntelFile = path.join(seoDir, "data", "search-intel.json");
const dataForSeoSerpDirs = [
  path.join(seoDir, "inputs", "google-page-grounded-serps"),
  path.join(seoDir, "inputs", "google-serps"),
];
const outJson = path.join(seoDir, "reports", "competitor-page-map.json");
const outMd = path.join(seoDir, "reports", "competitor-page-map.md");
const userAgent = "ValenSystems-MasterflowSEO/0.1 (competitor feature mapping; no content reuse)";

function parseArgs(argv = process.argv.slice(2)) {
  const opts = {
    limitCompetitors: 12,
    limitMasterflowPages: 36,
    timeoutMs: 16000,
    maxBytes: 1400000,
    force: false,
    maxAgeHours: 24,
  };
  for (const arg of argv) {
    if (arg === "--force") opts.force = true;
    else if (arg.startsWith("--limit-competitors=")) opts.limitCompetitors = Number(arg.slice("--limit-competitors=".length));
    else if (arg.startsWith("--limit-masterflow-pages=")) opts.limitMasterflowPages = Number(arg.slice("--limit-masterflow-pages=".length));
    else if (arg.startsWith("--timeout-ms=")) opts.timeoutMs = Number(arg.slice("--timeout-ms=".length));
    else if (arg.startsWith("--max-bytes=")) opts.maxBytes = Number(arg.slice("--max-bytes=".length));
    else if (arg.startsWith("--max-age-hours=")) opts.maxAgeHours = Number(arg.slice("--max-age-hours=".length));
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

async function pathExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function listJsonFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => path.join(dir, entry.name)).sort();
  } catch {
    return [];
  }
}

async function fileAgeMs(file) {
  try {
    const stat = await fs.stat(file);
    return Date.now() - stat.mtimeMs;
  } catch {
    return null;
  }
}

function hostFor(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizePathname(url) {
  try {
    return new URL(url, "https://masterflowplumbing.us").pathname.replace(/\/$/, "") || "/";
  } catch {
    return "/";
  }
}

function normalizeSerpResult(result) {
  if (!result?.url) return null;
  return {
    rank: Number(result.rank ?? result.rank_group ?? result.rankAbsolute ?? result.absoluteRank ?? 0),
    absoluteRank: Number(result.rankAbsolute ?? result.absoluteRank ?? result.rank_absolute ?? result.rank ?? 0),
    title: String(result.title ?? "").replace(/\s+/g, " ").trim(),
    url: result.url,
    host: String(result.host ?? result.domain ?? hostFor(result.url)).replace(/^www\./, "").toLowerCase(),
    snippet: String(result.snippet ?? result.description ?? "").replace(/\s+/g, " ").trim(),
  };
}

function dataForSeoSearchFromArtifact(file, payload) {
  const sourceFile = path.relative(siteDir, file).replaceAll(path.sep, "/");
  if (Array.isArray(payload?.topOrganic)) {
    return {
      query: payload.query,
      provider: "dataforseo",
      source: payload.source ?? "dataforseo-page-grounded-serp",
      sourceFile,
      targetPath: payload.targetPath ?? null,
      locationName: payload.locationName ?? null,
      device: payload.device ?? "desktop",
      fetchedAt: payload.fetchedAt ?? null,
      results: payload.topOrganic.map(normalizeSerpResult).filter(Boolean),
      localPack: (payload.topLocal ?? []).map(normalizeSerpResult).filter(Boolean),
    };
  }
  if (Array.isArray(payload?.results) && payload.provider === "dataforseo") {
    return {
      query: payload.query,
      provider: "dataforseo",
      source: payload.source ?? "google-dataforseo-live-advanced",
      sourceFile,
      targetPath: payload.expectedTargetPath ?? payload.targetPath ?? null,
      locationName: payload.dataforseo?.locationName ?? payload.locationName ?? null,
      device: payload.dataforseo?.device ?? payload.device ?? null,
      fetchedAt: payload.fetchedAt ?? null,
      results: payload.results.map(normalizeSerpResult).filter(Boolean),
      localPack: (payload.localPack ?? []).map(normalizeSerpResult).filter(Boolean),
    };
  }
  return null;
}

async function dataForSeoSearchIntel() {
  const files = (await Promise.all(dataForSeoSerpDirs.map(listJsonFiles))).flat();
  const rawSearches = [];
  const errors = [];
  for (const file of files) {
    const payload = await readJson(file, null);
    if (!payload) continue;
    try {
      const row = dataForSeoSearchFromArtifact(file, payload);
      if (row?.query && row.results.length) rawSearches.push(row);
    } catch (error) {
      errors.push({ file: path.relative(siteDir, file).replaceAll(path.sep, "/"), error: String(error?.message ?? error) });
    }
  }
  if (!rawSearches.length) return null;

  const competitors = new Map();
  const localPackCompetitors = new Map();
  const addCompetitor = (map, result, row, kind) => {
    if (!result?.host || result.host.includes("masterflowplumbing")) return;
    const existing = map.get(result.host) ?? {
      host: result.host,
      sampleUrl: result.url,
      mentions: 0,
      bestRank: Number.POSITIVE_INFINITY,
      sampleQueries: [],
      serpEvidence: [],
    };
    existing.mentions += 1;
    if (Number(result.rank) > 0 && Number(result.rank) < existing.bestRank) {
      existing.bestRank = Number(result.rank);
      existing.sampleUrl = result.url;
    }
    if (!existing.sampleQueries.includes(row.query)) existing.sampleQueries.push(row.query);
    existing.serpEvidence.push({
      kind,
      query: row.query,
      rank: result.rank,
      absoluteRank: result.absoluteRank,
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      sourceFile: row.sourceFile,
      locationName: row.locationName,
      device: row.device,
      fetchedAt: row.fetchedAt,
    });
    map.set(result.host, existing);
  };

  for (const row of rawSearches) {
    for (const result of row.results.slice(0, 10)) addCompetitor(competitors, result, row, "organic");
    for (const result of row.localPack.slice(0, 5)) addCompetitor(localPackCompetitors, result, row, "local_pack");
  }

  const competitorRows = [...competitors.values()]
    .map((row) => ({
      ...row,
      bestRank: Number.isFinite(row.bestRank) ? row.bestRank : null,
      opportunityPressure: row.mentions * (row.bestRank ? Math.max(1, 12 - row.bestRank) : 1),
      sampleQueries: row.sampleQueries.slice(0, 10),
      serpEvidence: row.serpEvidence.slice(0, 25),
    }))
    .sort((a, b) => b.opportunityPressure - a.opportunityPressure || (a.bestRank ?? 999) - (b.bestRank ?? 999));
  const localPackRows = [...localPackCompetitors.values()]
    .map((row) => ({
      ...row,
      bestRank: Number.isFinite(row.bestRank) ? row.bestRank : null,
      opportunityPressure: row.mentions * (row.bestRank ? Math.max(1, 8 - row.bestRank) : 1),
      sampleQueries: row.sampleQueries.slice(0, 10),
      serpEvidence: row.serpEvidence.slice(0, 25),
    }))
    .sort((a, b) => b.opportunityPressure - a.opportunityPressure || (a.bestRank ?? 999) - (b.bestRank ?? 999));

  return {
    generatedAt: new Date().toISOString(),
    provider: {
      requested: "dataforseo",
      engine: "google",
      products: ["serp.google.organic.live.advanced"],
    },
    sources: [...new Set(rawSearches.map((row) => row.source))],
    googleOrganicTop10: true,
    organicResultLimit: 10,
    rawSearches,
    competitors: competitorRows,
    localPackCompetitors: localPackRows,
    errors,
    counts: {
      queries: rawSearches.length,
      googleQueries: rawSearches.length,
      competitors: competitorRows.length,
      localPackCompetitors: localPackRows.length,
    },
  };
}

function textOf($, selector) {
  return $(selector).text().replace(/\s+/g, " ").trim();
}

function countMatches(text, terms) {
  const lower = String(text ?? "").toLowerCase();
  return terms.reduce((sum, term) => {
    const clean = String(term ?? "").toLowerCase().trim();
    if (!clean) return sum;
    return sum + (lower.match(new RegExp(`\\b${escapeRegex(clean)}\\b`, "g")) ?? []).length;
  }, 0);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function average(values) {
  const nums = values.filter((value) => Number.isFinite(value));
  if (!nums.length) return 0;
  return Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(1));
}

function schemaTypesFromJsonLd(value, out = new Set()) {
  if (!value) return out;
  if (Array.isArray(value)) {
    for (const item of value) schemaTypesFromJsonLd(item, out);
    return out;
  }
  if (typeof value !== "object") return out;
  const type = value["@type"];
  if (Array.isArray(type)) type.forEach((item) => out.add(String(item)));
  else if (type) out.add(String(type));
  for (const child of Object.values(value)) {
    if (child && typeof child === "object") schemaTypesFromJsonLd(child, out);
  }
  return out;
}

function schemaTypes($) {
  const types = new Set();
  $("script[type='application/ld+json']").each((_, node) => {
    const raw = $(node).contents().text();
    try {
      schemaTypesFromJsonLd(JSON.parse(raw), types);
    } catch {
      // Ignore malformed third-party JSON-LD. The feature map is best effort.
    }
  });
  return [...types].sort();
}

function featureProfile({ html, url, label, business, markets, services }) {
  const $ = cheerio.load(html);
  const schema = schemaTypes($);
  $("script, style, noscript, svg").remove();
  const bodyText = textOf($, "body");
  const words = bodyText.split(/\s+/).filter(Boolean);
  const host = hostFor(url);
  const links = $("a[href]")
    .map((_, node) => $(node).attr("href") ?? "")
    .get()
    .filter(Boolean);
  const internalLinks = links.filter((href) => {
    try {
      const target = new URL(href, url);
      return target.hostname.replace(/^www\./, "").toLowerCase() === host;
    } catch {
      return href.startsWith("/");
    }
  });
  const externalLinks = links.length - internalLinks.length;
  const h1 = $("h1")
    .map((_, node) => $(node).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);
  const h2 = $("h2")
    .map((_, node) => $(node).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);
  const h3 = $("h3")
    .map((_, node) => $(node).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);
  const lower = bodyText.toLowerCase();
  const marketTerms = markets.flatMap((market) => [market.city, market.slug.replace(/-/g, " ")]);
  const serviceTerms = services.flatMap((service) => [service.name, service.slug.replace(/-/g, " ")]);
  const ctaTerms = ["call", "schedule", "book", "quote", "estimate", "request service", "contact", "dispatch"];
  const trustTerms = ["licensed", "insured", "license", "cslb", "warranty", "guarantee", "family", "locally", "certified"];
  const reviewTerms = ["review", "reviews", "testimonial", "testimonials", "stars", "rating", "yelp", "google"];
  const emergencyTerms = ["24/7", "24 hour", "emergency", "same day", "after hours", "open 24"];
  const faqSelectors = $("details, .faq, [class*='faq' i], [id*='faq' i]").length;
  const questionHeadings = $("h2,h3,h4")
    .map((_, node) => $(node).text().trim())
    .get()
    .filter((text) => /\?$/.test(text)).length;
  const telLinks = links.filter((href) => /^tel:/i.test(href)).length;
  const profile = {
    label,
    url,
    host,
    path: normalizePathname(url),
    title: textOf($, "title"),
    description: $("meta[name='description']").attr("content")?.replace(/\s+/g, " ").trim() ?? "",
    h1,
    h2,
    h3Count: h3.length,
    wordCount: words.length,
    linkCount: links.length,
    internalLinkCount: internalLinks.length,
    externalLinkCount: externalLinks,
    imageCount: $("img").length,
    videoCount: $("video, iframe[src*='youtube' i], iframe[src*='vimeo' i]").length,
    formCount: $("form").length,
    mapEmbedCount: $("iframe[src*='google.com/maps' i], iframe[src*='maps.google' i]").length,
    telLinks,
    ctaScore: countMatches(lower, ctaTerms) + telLinks * 3,
    trustScore: countMatches(lower, trustTerms),
    reviewScore: countMatches(lower, reviewTerms),
    emergencyScore: countMatches(lower, emergencyTerms),
    localTermCount: countMatches(lower, marketTerms),
    serviceTermCount: countMatches(lower, serviceTerms),
    faqSignals: faqSelectors + questionHeadings + (schema.includes("FAQPage") ? 2 : 0),
    schema,
    hasLocalBusinessSchema: schema.some((type) => /LocalBusiness|Plumber|HomeAndConstructionBusiness/i.test(type)),
    hasFaqSchema: schema.includes("FAQPage"),
    hasReviewSchema: schema.some((type) => /Review|AggregateRating/i.test(type)),
    hasBreadcrumbSchema: schema.includes("BreadcrumbList"),
    hasSameAs: /"sameAs"|sameAs/i.test(html),
    hasOpeningHours: /openingHours|Open 24|24\/7|24 hour/i.test(html),
    hasLicenseLanguage: /CSLB|license|licensed/i.test(bodyText),
    hasReviewLanguage: /review|testimonial|rating|stars|yelp|google/i.test(bodyText),
    hasPhoneAction: telLinks > 0 || /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(bodyText),
  };
  profile.botParitySignals = {
    strongTitle: profile.title.length >= 35 && profile.title.length <= 70,
    h1Present: h1.length === 1,
    localIntentPresent: profile.localTermCount >= 8,
    serviceIntentPresent: profile.serviceTermCount >= 12,
    ctaPresent: profile.ctaScore >= 4,
    trustPresent: profile.trustScore >= 4 || profile.hasLicenseLanguage,
    reviewsPresent: profile.reviewScore >= 3 || profile.hasReviewLanguage || profile.hasReviewSchema,
    faqPresent: profile.faqSignals >= 3 || profile.hasFaqSchema,
    schemaPresent: profile.hasLocalBusinessSchema && profile.hasBreadcrumbSchema,
  };
  return profile;
}

async function fetchPage(url, opts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": userAgent,
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    const contentType = response.headers.get("content-type") ?? "";
    const arrayBuffer = await response.arrayBuffer();
    const bytes = Buffer.from(arrayBuffer);
    const html = bytes.slice(0, opts.maxBytes).toString("utf8");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!/text\/html|application\/xhtml/i.test(contentType) && !html.includes("<html")) {
      throw new Error(`non-html content type ${contentType || "unknown"}`);
    }
    return {
      ok: true,
      finalUrl: response.url,
      status: response.status,
      contentType,
      bytes: bytes.length,
      truncated: bytes.length > opts.maxBytes,
      html,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function competitorProfiles(searchIntel, data, opts) {
  const competitors = (searchIntel.competitors ?? []).slice(0, opts.limitCompetitors);
  const profiles = [];
  const errors = [];
  for (const competitor of competitors) {
    try {
      const fetched = await fetchPage(competitor.sampleUrl, opts);
      const profile = featureProfile({
        html: fetched.html,
        url: fetched.finalUrl || competitor.sampleUrl,
        label: competitor.host,
        business: data.business,
        markets: data.markets,
        services: data.services,
      });
      profiles.push({
        ...profile,
        source: "competitor-sample-page",
        searchPressure: {
          mentions: competitor.mentions,
          bestRank: competitor.bestRank,
          opportunityPressure: competitor.opportunityPressure,
          sampleQueries: competitor.sampleQueries ?? [],
          markets: competitor.markets ?? [],
          services: competitor.services ?? [],
          serpBacked: Array.isArray(competitor.serpEvidence) && competitor.serpEvidence.length > 0,
          serpEvidence: (competitor.serpEvidence ?? []).slice(0, 8),
        },
        fetch: {
          status: fetched.status,
          bytes: fetched.bytes,
          truncated: fetched.truncated,
        },
      });
    } catch (error) {
      errors.push({
        host: competitor.host,
        url: competitor.sampleUrl,
        error: String(error?.message ?? error),
      });
    }
  }
  return { profiles, errors };
}

async function masterflowProfiles(data, opts) {
  const pages = [
    {
      label: "homepage",
      url: `${data.business.primary_domain}/`,
      file: path.join(seoDir, "reports", "homepage-index-with-tracking.html"),
    },
  ];
  const productionRoot = path.join(seoDir, "reports", "production-root-pages");
  const entries = await fs.readdir(productionRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name)).slice(0, opts.limitMasterflowPages)) {
    pages.push({
      label: entry.name,
      url: `${data.business.primary_domain}/${entry.name}`,
      file: path.join(productionRoot, entry.name, "index.html"),
    });
  }
  const profiles = [];
  for (const page of pages) {
    if (!(await pathExists(page.file))) continue;
    const html = await fs.readFile(page.file, "utf8");
    profiles.push({
      ...featureProfile({
        html,
        url: page.url,
        label: page.label,
        business: data.business,
        markets: data.markets,
        services: data.services,
      }),
      source: "masterflow-generated-page",
      sourceFile: path.relative(siteDir, page.file),
    });
  }
  return profiles;
}

function benchmark(profiles) {
  const boolRate = (key) => Number((profiles.filter((profile) => profile[key]).length / Math.max(1, profiles.length)).toFixed(2));
  return {
    sampleCount: profiles.length,
    medianWordCount: median(profiles.map((profile) => profile.wordCount)),
    avgWordCount: average(profiles.map((profile) => profile.wordCount)),
    medianInternalLinks: median(profiles.map((profile) => profile.internalLinkCount)),
    medianH2Count: median(profiles.map((profile) => profile.h2.length)),
    medianImageCount: median(profiles.map((profile) => profile.imageCount)),
    medianFaqSignals: median(profiles.map((profile) => profile.faqSignals)),
    medianCtaScore: median(profiles.map((profile) => profile.ctaScore)),
    medianTrustScore: median(profiles.map((profile) => profile.trustScore)),
    medianReviewScore: median(profiles.map((profile) => profile.reviewScore)),
    localBusinessSchemaRate: boolRate("hasLocalBusinessSchema"),
    faqSchemaRate: boolRate("hasFaqSchema"),
    reviewLanguageRate: boolRate("hasReviewLanguage"),
    phoneActionRate: boolRate("hasPhoneAction"),
    licenseLanguageRate: boolRate("hasLicenseLanguage"),
    openingHoursRate: boolRate("hasOpeningHours"),
  };
}

function gapTasks(profile, competitorBenchmark) {
  const tasks = [];
  const targetWords = Math.max(900, Math.round(competitorBenchmark.medianWordCount * 0.85));
  const targetInternalLinks = Math.max(18, Math.round(competitorBenchmark.medianInternalLinks * 0.65));
  if (profile.wordCount < targetWords) {
    tasks.push({
      type: "content_depth",
      priority: "high",
      current: profile.wordCount,
      target: targetWords,
      task: "Add original service-area proof, job scenarios, neighborhoods, FAQs, and trust content without changing the visual system.",
    });
  }
  if (profile.internalLinkCount < targetInternalLinks) {
    tasks.push({
      type: "internal_authority",
      priority: "high",
      current: profile.internalLinkCount,
      target: targetInternalLinks,
      task: "Add contextual links to related city/service pages and homepage proof sections.",
    });
  }
  if (!profile.hasReviewLanguage || profile.reviewScore < Math.max(3, competitorBenchmark.medianReviewScore * 0.5)) {
    tasks.push({
      type: "review_trust",
      priority: "high",
      current: profile.reviewScore,
      target: Math.max(3, competitorBenchmark.medianReviewScore),
      task: "Add permissioned review proof or public-profile review links tied to the page's city/service intent.",
    });
  }
  if (profile.faqSignals < Math.max(3, competitorBenchmark.medianFaqSignals)) {
    tasks.push({
      type: "faq_coverage",
      priority: "medium",
      current: profile.faqSignals,
      target: Math.max(3, competitorBenchmark.medianFaqSignals),
      task: "Add concise FAQ coverage around urgency, pricing, timing, service boundaries, and license proof.",
    });
  }
  if (!profile.hasPhoneAction || profile.ctaScore < Math.max(4, competitorBenchmark.medianCtaScore * 0.5)) {
    tasks.push({
      type: "lead_action",
      priority: "high",
      current: profile.ctaScore,
      target: Math.max(4, competitorBenchmark.medianCtaScore),
      task: "Make the call/request-service action visible in the hero, body, and final CTA.",
    });
  }
  if (!profile.hasLocalBusinessSchema || !profile.hasBreadcrumbSchema) {
    tasks.push({
      type: "structured_data",
      priority: "medium",
      current: profile.schema,
      target: ["Plumber", "LocalBusiness", "BreadcrumbList"],
      task: "Keep LocalBusiness/Plumber and BreadcrumbList schema present on every promoted page.",
    });
  }
  if (!profile.hasLicenseLanguage) {
    tasks.push({
      type: "entity_trust",
      priority: "medium",
      current: false,
      target: true,
      task: "Include CSLB/license language near CTAs and review proof.",
    });
  }
  return tasks;
}

function compare(masterflow, competitorBenchmark) {
  return masterflow.map((profile) => ({
    path: profile.path,
    label: profile.label,
    url: profile.url,
    summary: {
      wordCount: profile.wordCount,
      internalLinkCount: profile.internalLinkCount,
      h2Count: profile.h2.length,
      faqSignals: profile.faqSignals,
      ctaScore: profile.ctaScore,
      trustScore: profile.trustScore,
      reviewScore: profile.reviewScore,
      schema: profile.schema,
    },
    botParitySignals: profile.botParitySignals,
    tasks: gapTasks(profile, competitorBenchmark),
  }));
}

function markdown(report) {
  const lines = [];
  lines.push("# Masterflow Competitor Page Map");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push("## Benchmark");
  lines.push("");
  lines.push(`Competitor pages profiled: ${report.competitors.profiles.length}`);
  lines.push(`Median competitor word count: ${report.competitors.benchmark.medianWordCount}`);
  lines.push(`Median competitor internal links: ${report.competitors.benchmark.medianInternalLinks}`);
  lines.push(`Median competitor FAQ signals: ${report.competitors.benchmark.medianFaqSignals}`);
  lines.push(`Phone action rate: ${report.competitors.benchmark.phoneActionRate}`);
  lines.push(`Review language rate: ${report.competitors.benchmark.reviewLanguageRate}`);
  lines.push("");
  lines.push("## Top Competitor Pages");
  lines.push("");
  for (const profile of report.competitors.profiles.slice(0, 10)) {
    lines.push(`- ${profile.host}: ${profile.url}`);
    lines.push(`  - words ${profile.wordCount}, internal links ${profile.internalLinkCount}, H2s ${profile.h2.length}, reviews ${profile.reviewScore}, CTAs ${profile.ctaScore}`);
  }
  lines.push("");
  lines.push("## Masterflow Gap Tasks");
  lines.push("");
  for (const page of report.masterflow.comparisons.filter((item) => item.tasks.length).slice(0, 20)) {
    lines.push(`- ${page.path}`);
    for (const task of page.tasks.slice(0, 5)) {
      lines.push(`  - [${task.priority}] ${task.type}: ${task.task}`);
    }
  }
  lines.push("");
  lines.push("## Guardrail");
  lines.push("");
  lines.push("Use this map to match local SEO feature depth and page usefulness. Do not copy competitor text, layouts, reviews, or proprietary assets.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

const opts = parseArgs();
const ageMs = await fileAgeMs(outJson);
if (!opts.force && ageMs !== null && ageMs < opts.maxAgeHours * 60 * 60 * 1000) {
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        cached: true,
        reportFile: path.relative(siteDir, outJson),
        ageHours: Number((ageMs / 60 / 60 / 1000).toFixed(2)),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const data = await loadSeoData();
const importedSearchIntel = await readJson(searchIntelFile, {});
const dataForSeoIntel = await dataForSeoSearchIntel();
const searchIntel = dataForSeoIntel ?? importedSearchIntel;
const competitors = await competitorProfiles(searchIntel, data, opts);
const masterflow = await masterflowProfiles(data, opts);
const competitorBenchmark = benchmark(competitors.profiles);
const masterflowBenchmark = benchmark(masterflow);
const comparisons = compare(masterflow, competitorBenchmark);
const priorityTasks = comparisons
  .flatMap((page) => page.tasks.map((task) => ({ path: page.path, url: page.url, ...task })))
  .sort((a, b) => {
    const score = { high: 0, medium: 1, low: 2 };
    return (score[a.priority] ?? 9) - (score[b.priority] ?? 9);
  });

const report = {
  generatedAt: new Date().toISOString(),
  ok: competitors.profiles.length > 0 && masterflow.length > 0,
  sourceSearchIntel: {
    generatedAt: searchIntel.generatedAt ?? null,
    sources: searchIntel.sources ?? [],
    provider: searchIntel.provider ?? null,
    realSerpBacked: dataForSeoIntel !== null,
    sourcePriority: dataForSeoIntel ? "dataforseo-serp-artifacts" : "imported-search-intel",
    googleOrganicTop10: searchIntel.googleOrganicTop10 === true,
    competitorCount: searchIntel.competitors?.length ?? 0,
    localPackCompetitorCount: searchIntel.localPackCompetitors?.length ?? 0,
  },
  notes: [
    "This maps competitor page features, not competitor copy.",
    "Competitor candidates must be backed by real SERP rows. DataForSEO SERP artifacts are preferred over imported/manual search-intel.",
    "Use the benchmark to improve visible user pages and Google-visible structure together; never cloak a separate bot page.",
    "Google organic top-10 quality depends on the upstream search-intel source. Manual Google imports or a real SERP provider are stronger than DuckDuckGo fallback.",
  ],
  competitors: {
    profiles: competitors.profiles,
    errors: competitors.errors,
    benchmark: competitorBenchmark,
    localPack: (searchIntel.localPackCompetitors ?? []).slice(0, 20),
  },
  masterflow: {
    benchmark: masterflowBenchmark,
    profiles: masterflow,
    comparisons,
  },
  priorityTasks: priorityTasks.slice(0, 80),
};

await fs.mkdir(path.dirname(outJson), { recursive: true });
await fs.writeFile(outJson, `${JSON.stringify(report, null, 2)}\n`);
await fs.writeFile(outMd, markdown(report));

console.log(
  JSON.stringify(
    {
      generatedAt: report.generatedAt,
      ok: report.ok,
      wrote: [path.relative(siteDir, outJson), path.relative(siteDir, outMd)],
      competitorProfiles: competitors.profiles.length,
      competitorErrors: competitors.errors.length,
      masterflowPages: masterflow.length,
      priorityTasks: report.priorityTasks.length,
      googleOrganicTop10: report.sourceSearchIntel.googleOrganicTop10,
    },
    null,
    2,
  ),
);
if (!report.ok) process.exitCode = 2;
