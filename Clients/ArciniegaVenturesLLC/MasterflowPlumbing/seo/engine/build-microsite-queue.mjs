import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const siteDir = path.dirname(seoDir);
const reportsDir = path.join(seoDir, "reports");

const targetDomain = process.env.MASTERFLOW_TARGET_DOMAIN || "https://masterflowplumbing.us";
const previewBase = process.env.MASTERFLOW_PREVIEW_BASE || "https://masterflowplumbing.us/seo-preview";

const serviceSlugMap = {
  "emergency-plumbing": "emergency-plumber",
  "drain-cleaning": "drain-cleaning",
  "hydro-jetting": "hydro-jetting",
  "water-heater-repair-install": "water-heater-repair",
  "sewer-line-repair": "sewer-line-repair",
  "leak-detection": "leak-detection",
  "slab-leak-repair": "slab-leak-repair",
  repiping: "repiping",
  "gas-line-services": "gas-line-services",
  "fixture-install-repair": "fixture-repair",
};

const servicePriority = [
  "emergency-plumbing",
  "drain-cleaning",
  "leak-detection",
  "sewer-line-repair",
  "water-heater-repair-install",
  "hydro-jetting",
  "slab-leak-repair",
  "fixture-install-repair",
  "gas-line-services",
  "repiping",
];

// Source of truth: the live/current site service-area section, not the older invoice region text.
const siteLaunchWaves = [
  {
    wave: 1,
    region: "Corona & Norco",
    source: "site area card: Corona & Norco",
    markets: ["corona", "norco"],
  },
  {
    wave: 2,
    region: "Riverside & Moreno Valley",
    source: "site area card: Riverside & Moreno Valley",
    markets: ["riverside", "moreno-valley", "perris", "jurupa-valley"],
  },
  {
    wave: 3,
    region: "Rancho, Ontario & Claremont",
    source: "site area card: Rancho, Ontario & Claremont",
    markets: ["rancho-cucamonga", "ontario", "claremont"],
  },
  {
    wave: 4,
    region: "Foothill / Inland Empire Support",
    source: "site FAQ supporting cities: Fontana, Upland, Pomona",
    markets: ["fontana", "upland", "pomona"],
  },
  {
    wave: 5,
    region: "Murrieta & Surrounding",
    source: "site area card: Murrieta & surrounding communities",
    markets: ["murrieta", "temecula", "wildomar"],
  },
  {
    wave: 6,
    region: "Southwest Riverside Support",
    source: "site chips/supporting cities: Menifee, Perris, Moreno Valley, Wildomar",
    markets: ["menifee", "perris", "moreno-valley", "wildomar"],
  },
];

function cleanSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function rootServiceSlug(serviceSlug) {
  return serviceSlugMap[serviceSlug] || cleanSlug(serviceSlug);
}

function previewUrlFor(urlPath) {
  const rel = String(urlPath || "").replace(/^\/seo-preview\/?/, "").replace(/^\/+/, "");
  return `${previewBase.replace(/\/$/, "")}/${rel}`;
}

function sourceFileFor(urlPath) {
  const rel = String(urlPath || "").replace(/^\/seo-preview\/?/, "").replace(/^\/+/, "");
  if (!rel) return path.join(siteDir, "seo-preview", "index.html");
  return path.join(siteDir, "seo-preview", rel.endsWith("/") ? rel : `${rel}/`, "index.html");
}

function words(text) {
  return String(text || "").replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean);
}

async function readSeoJson(file) {
  return JSON.parse(await fs.readFile(path.join(seoDir, "data", file), "utf8"));
}

async function loadQueueData() {
  const [markets, services] = await Promise.all([readSeoJson("markets.json"), readSeoJson("services.json")]);
  return { markets, services };
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function firstHtmlMatch(html, pattern) {
  return String(html).match(pattern)?.[1]?.trim() ?? "";
}

function titleFromHtml(html) {
  return firstHtmlMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i);
}

function metaContent(html, name) {
  const tags = String(html).match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const tagName = firstHtmlMatch(tag, /\bname=["']?([^"'\s>]+)["']?/i).toLowerCase();
    if (tagName !== name.toLowerCase()) continue;
    return firstHtmlMatch(tag, /\bcontent=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
      || tag.match(/\bcontent=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find(Boolean)
      || "";
  }
  return "";
}

function mainTextFromHtml(html) {
  const main = firstHtmlMatch(html, /<main\b[^>]*>([\s\S]*?)<\/main>/i) || html;
  return stripHtml(main.replace(/<script\b[\s\S]*?<\/script>/gi, " "));
}

function jsonLdBlockCount(html) {
  return (String(html).match(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>/gi) ?? []).length;
}

async function htmlMeta(urlPath) {
  const file = sourceFileFor(urlPath);
  const html = await fs.readFile(file, "utf8");
  return {
    sourceFile: path.relative(siteDir, file),
    title: titleFromHtml(html),
    description: metaContent(html, "description"),
    robots: metaContent(html, "robots"),
    h1: firstHtmlMatch(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i),
    wordCount: words(mainTextFromHtml(html)).length,
    hasPhone: html.includes("951-612-7912"),
    hasLicense: html.includes("CSLB #1156577"),
    jsonLdBlocks: jsonLdBlockCount(html),
  };
}

function cityHubCandidate(market) {
  const rootSlug = `${market.slug}-plumber`;
  const sourcePath = `/seo-preview/locations/${market.slug}/`;
  return {
    kind: "city_hub",
    market_slug: market.slug,
    city: market.city,
    service_slug: null,
    service: "All Plumbing Services",
    root_slug: rootSlug,
    target_path: `/${rootSlug}`,
    target_url: `${targetDomain}/${rootSlug}`,
    source_path: sourcePath,
    preview_url: previewUrlFor(sourcePath),
    intent: `${market.city} plumber`,
    priority_class: market.priority || "candidate",
  };
}

function cityServiceCandidate(market, service) {
  const rootSlug = `${market.slug}-${rootServiceSlug(service.slug)}`;
  const sourcePath = `/seo-preview/locations/${market.slug}/${service.slug}/`;
  return {
    kind: "city_service",
    market_slug: market.slug,
    city: market.city,
    service_slug: service.slug,
    service: service.name,
    root_slug: rootSlug,
    target_path: `/${rootSlug}`,
    target_url: `${targetDomain}/${rootSlug}`,
    source_path: sourcePath,
    preview_url: previewUrlFor(sourcePath),
    intent: `${service.name} ${market.city} CA`,
    priority_class: service.emergency ? "urgent" : "standard",
  };
}

function serviceHubCandidate(service) {
  const rootSlug = `southern-california-${rootServiceSlug(service.slug)}`;
  const sourcePath = `/seo-preview/services/${service.slug}/`;
  return {
    kind: "service_hub",
    market_slug: null,
    city: "Southern California",
    service_slug: service.slug,
    service: service.name,
    root_slug: rootSlug,
    target_path: `/${rootSlug}`,
    target_url: `${targetDomain}/${rootSlug}`,
    source_path: sourcePath,
    preview_url: previewUrlFor(sourcePath),
    intent: `${service.name} Southern California`,
    priority_class: "supporting",
  };
}

function pickWaveAssets({ wave, candidatesByKey, usedKeys }) {
  const picks = [];
  const waveMarkets = wave.markets;
  const marketCursor = [...waveMarkets];

  for (const marketSlug of marketCursor) {
    const key = `${marketSlug}:city_hub`;
    if (picks.length >= 12) break;
    if (usedKeys.has(key)) continue;
    const candidate = candidatesByKey.get(key);
    if (candidate) {
      picks.push({ ...candidate, launch_wave: wave.wave, launch_region: wave.region, launch_source: wave.source });
      usedKeys.add(key);
    }
  }

  for (const serviceSlug of servicePriority) {
    for (const marketSlug of marketCursor) {
      if (picks.length >= 12) break;
      const key = `${marketSlug}:${serviceSlug}`;
      if (usedKeys.has(key)) continue;
      const candidate = candidatesByKey.get(key);
      if (candidate) {
        picks.push({ ...candidate, launch_wave: wave.wave, launch_region: wave.region, launch_source: wave.source });
        usedKeys.add(key);
      }
    }
    if (picks.length >= 12) break;
  }

  return picks;
}

async function enrichCandidate(candidate) {
  const meta = await htmlMeta(candidate.source_path);
  const proof = {
    noindex_private_preview: meta.robots.includes("noindex"),
    direct_phone_present: meta.hasPhone,
    license_present: meta.hasLicense,
    structured_data_blocks: meta.jsonLdBlocks,
    word_count: meta.wordCount,
    title_length: meta.title.length,
    description_length: meta.description.length,
  };
  const ready =
    proof.noindex_private_preview &&
    proof.direct_phone_present &&
    proof.license_present &&
    proof.structured_data_blocks >= 2 &&
    proof.word_count >= (candidate.kind === "city_service" ? 520 : 300);

  return {
    ...candidate,
    ...meta,
    proof,
    deployment_state: ready ? "ready_for_audos_microsite_bind" : "blocked_by_quality_gate",
    publish_gate:
      "Bind root-path microsite first, verify live HTML and bundle/app id, then explicitly approve indexable robots/sitemap inclusion.",
  };
}

async function main() {
  const { markets, services } = await loadQueueData();
  const marketMap = new Map(markets.map((market) => [market.slug, market]));
  const serviceMap = new Map(services.map((service) => [service.slug, service]));
  const candidatesByKey = new Map();

  for (const market of markets) {
    candidatesByKey.set(`${market.slug}:city_hub`, cityHubCandidate(market));
    for (const service of services) {
      candidatesByKey.set(`${market.slug}:${service.slug}`, cityServiceCandidate(market, service));
    }
  }

  const allCandidates = [
    ...markets.map(cityHubCandidate),
    ...markets.flatMap((market) => services.map((service) => cityServiceCandidate(market, service))),
    ...services.map(serviceHubCandidate),
  ];

  const usedKeys = new Set();
  const firstWave = [];
  for (const wave of siteLaunchWaves) {
    const picks = pickWaveAssets({ wave, candidatesByKey, usedKeys });
    firstWave.push(...picks);
  }

  const firstWaveKeys = new Set(firstWave.map((candidate) => candidate.root_slug));
  const enrichedFirstWave = await Promise.all(firstWave.map(enrichCandidate));
  const enrichedBacklog = await Promise.all(
    allCandidates
      .filter((candidate) => !firstWaveKeys.has(candidate.root_slug))
      .map((candidate) => enrichCandidate(candidate)),
  );

  const launchWaveCounts = siteLaunchWaves.map((wave) => ({
    wave: wave.wave,
    region: wave.region,
    assets: enrichedFirstWave.filter((item) => item.launch_wave === wave.wave).length,
  }));

  const queue = {
    generatedAt: new Date().toISOString(),
    target_domain: targetDomain,
    source_preview_base: previewBase,
    contract: {
      first_90_days_assets: 72,
      ongoing_monthly_capacity: 25,
      lead_flow: "direct-to-phone / preferred inbox, no AI phone middleman",
      quality_guardrail:
        "Hyper-localized useful pages only. Noindex private preview until root-path bind and explicit indexable publish approval.",
    },
    site_source_of_truth: {
      description:
        "Launch regions come from the current Masterflow site service-area section and FAQ, not the older invoice region text.",
      launch_waves: siteLaunchWaves,
    },
    summary: {
      first_wave_assets: enrichedFirstWave.length,
      backlog_assets: enrichedBacklog.length,
      total_root_path_candidates: enrichedFirstWave.length + enrichedBacklog.length,
      ready_first_wave_assets: enrichedFirstWave.filter((item) => item.deployment_state === "ready_for_audos_microsite_bind").length,
      blocked_first_wave_assets: enrichedFirstWave.filter((item) => item.deployment_state !== "ready_for_audos_microsite_bind").length,
      launch_wave_counts: launchWaveCounts,
      candidate_counts: {
        city_hubs: markets.length,
        city_service_pages: markets.length * services.length,
        service_hubs: services.length,
      },
    },
    first_wave: enrichedFirstWave,
    backlog: enrichedBacklog,
    otto_next_hook:
      "Create/prove one Audos root-path microsite bind hook that takes one queue item and makes masterflowplumbing.us/{root_slug} serve the compiled page.",
  };

  await fs.mkdir(reportsDir, { recursive: true });
  await fs.writeFile(path.join(reportsDir, "microsite-deployment-queue.json"), `${JSON.stringify(queue, null, 2)}\n`);
  await fs.writeFile(
    path.join(reportsDir, "microsite-deployment-queue.csv"),
    [
      "wave,region,state,kind,city,service,root_slug,target_url,source_path,word_count,title",
      ...[...enrichedFirstWave, ...enrichedBacklog].map((item) =>
        [
          item.launch_wave || "",
          item.launch_region || "",
          item.deployment_state,
          item.kind,
          item.city,
          item.service,
          item.root_slug,
          item.target_url,
          item.source_path,
          item.proof.word_count,
          `"${String(item.title || "").replaceAll('"', '""')}"`,
        ].join(","),
      ),
    ].join("\n") + "\n",
  );

  console.log(
    `wrote ${path.relative(siteDir, path.join(reportsDir, "microsite-deployment-queue.json"))}: ${queue.summary.first_wave_assets} first-wave assets, ${queue.summary.backlog_assets} backlog assets`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
