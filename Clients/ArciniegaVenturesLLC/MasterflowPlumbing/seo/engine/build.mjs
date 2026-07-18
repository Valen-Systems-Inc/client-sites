import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv from "ajv";
import { Eta } from "eta";
import {
  COPY_LASTMOD,
  CORE_COPY,
  OFFICIAL_GUIDANCE,
  PUBLIC_COPY_FORBIDDEN,
  SERVICE_COPY,
} from "../content/site-copy.mjs";
import {
  COMMERCIAL_CORE_COPY,
  COMMERCIAL_SERVICE_COPY,
} from "../content/site-copy-commercial.mjs";
import { BLOG_CATEGORIES } from "../content/blog-categories.mjs";
import { BLOG_POSTS } from "../content/blog-posts.mjs";
import {
  COMMERCIAL_BLOG_CATEGORIES,
  COMMERCIAL_BLOG_POSTS,
} from "../content/commercial-blog.mjs";
import { COMMERCIAL_INDUSTRIES } from "../content/commercial-industries.mjs";

const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const siteDir = path.dirname(seoDir);
const reportsDir = path.join(seoDir, "reports");
const generatedBaseDir = path.join(siteDir, ".generated.nosync");
const maintainer = {
  name: "Valen Systems",
  domain: "valen-systems.com",
  url: "https://www.valen-systems.com/",
};
const sitemapStylesheetFilename = "sitemap.xsl";
const sitemapPresentationAssets = [
  {
    output: "sitemap-assets/valen-systems-logo.png",
    source: path.join(seoDir, "assets", "sitemap", "valen-systems-logo.png"),
  },
  {
    output: "sitemap-assets/squarish-sans-ct-regular.woff2",
    source: path.join(seoDir, "assets", "sitemap", "squarish-sans-ct-regular.woff2"),
  },
  {
    output: "sitemap-assets/SQUARISH-SANS-CT-NOTICE.txt",
    source: path.join(seoDir, "assets", "sitemap", "SQUARISH-SANS-CT-NOTICE.txt"),
  },
];
const sitemapFamilies = [
  { id: "page", filename: "page-sitemap.xml", label: "Core pages" },
  { id: "services", filename: "services-sitemap.xml", label: "Services" },
  { id: "areas_we_serve", filename: "areas_we_serve-sitemap.xml", label: "Areas we serve" },
  { id: "industries", filename: "industries-sitemap.xml", label: "Industries" },
  { id: "post", filename: "post-sitemap.xml", label: "Posts" },
  { id: "category", filename: "category-sitemap.xml", label: "Categories" },
  { id: "admin", filename: "admin-sitemap.xml", label: "Developer routes", searchFacing: false },
];

const serviceTitleMap = new Map([
  ["emergency-plumbing", "Emergency Plumber"],
  ["water-heater-repair-install", "Water Heater Services"],
  ["fixture-install-repair", "Fixture Plumbing"],
  ["gas-line-services", "Gas Line Plumbing"],
]);

const badStrings = [
  "951.555",
  "555.0123",
  "458-1734",
  "1085831",
  "First Division",
  "Valor",
  "firstdivision",
  "storage.googleapis",
  "masterflowplumbing.com",
  "masterflow-plumbing-murrieta-2",
  "909-272-5456",
  "masterflow-truck-wrap",
];

const dataSchemas = {
  business: {
    type: "object",
    required: ["legal_name", "phone", "phone_display", "license_no", "primary_domain", "preview_prefix", "address", "geo", "media"],
    properties: {
      legal_name: { type: "string", minLength: 2 },
      phone: { type: "string", minLength: 10 },
      phone_display: { type: "string", minLength: 10 },
      license_no: { type: "string", minLength: 6 },
      primary_domain: { type: "string", pattern: "^https://" },
      preview_prefix: { type: "string", pattern: "^/" },
      address: { type: "object" },
      offers: {
        type: "object",
        properties: {
          emergency_service_24_7: { type: "boolean" },
          same_day_service_available: { type: "boolean" },
          financing_available: { type: "boolean" },
          upfront_pricing: { type: "boolean" },
          service_guarantee: { type: "boolean" },
        },
      },
      geo: {
        type: "object",
        required: ["lat", "lng"],
        properties: { lat: { type: "number" }, lng: { type: "number" } },
      },
      media: {
        type: "object",
        required: ["hero", "proof", "gallery"],
        properties: {
          hero: { type: "string" },
          proof: { type: "string" },
          gallery: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
  service: {
    type: "object",
    required: ["slug", "name", "schema_service_type", "short_desc", "long_desc"],
    properties: {
      slug: { type: "string", pattern: "^[a-z0-9-]+$" },
      name: { type: "string", minLength: 3 },
      schema_service_type: { type: "string", minLength: 3 },
      short_desc: { type: "string", minLength: 20 },
      long_desc: { type: "string", minLength: 120 },
      emergency: { type: "boolean" },
      price_band: { type: "string" },
    },
  },
  market: {
    type: "object",
    required: ["slug", "city", "county", "state", "zip_primary", "zips", "geo", "population", "neighborhoods", "nearby_slugs", "local_signals"],
    properties: {
      slug: { type: "string", pattern: "^[a-z0-9-]+$" },
      city: { type: "string", minLength: 2 },
      county: { type: "string", minLength: 4 },
      state: { const: "CA" },
      zip_primary: { type: "string", minLength: 5 },
      zips: { type: "array", minItems: 1, items: { type: "string" } },
      geo: {
        type: "object",
        required: ["lat", "lng"],
        properties: { lat: { type: "number" }, lng: { type: "number" } },
      },
      population: { type: "number", minimum: 1 },
      neighborhoods: { type: "array", minItems: 2, items: { type: "string" } },
      nearby_slugs: { type: "array", items: { type: "string" } },
      local_signals: { type: "array", minItems: 2, items: { type: "string" } },
    },
  },
};

function parseArgs(argv = process.argv.slice(2)) {
  const opts = {
    full: false,
    validateOnly: false,
    out: "seo-preview",
    limitMarkets: null,
    limitServices: null,
    indexable: false,
    routePrefix: null,
    omitIndex: false,
    marketSlugs: null,
    serviceSlugs: null,
    variant: "residential",
  };
  for (const arg of argv) {
    if (arg === "--full") opts.full = true;
    else if (arg === "--validate-only") opts.validateOnly = true;
    else if (arg === "--indexable") opts.indexable = true;
    else if (arg === "--production") {
      opts.indexable = true;
      opts.routePrefix = "/";
      opts.out = "seo-production";
      opts.omitIndex = false;
    }
    else if (arg === "--omit-index") opts.omitIndex = true;
    else if (arg.startsWith("--out=")) opts.out = arg.slice("--out=".length);
    else if (arg.startsWith("--route-prefix=")) opts.routePrefix = arg.slice("--route-prefix=".length);
    else if (arg.startsWith("--markets=")) opts.marketSlugs = arg.slice("--markets=".length).split(",").map((item) => item.trim()).filter(Boolean);
    else if (arg.startsWith("--services=")) opts.serviceSlugs = arg.slice("--services=".length).split(",").map((item) => item.trim()).filter(Boolean);
    else if (arg.startsWith("--variant=")) opts.variant = arg.slice("--variant=".length).trim();
    else if (arg.startsWith("--limit-markets=")) opts.limitMarkets = Number(arg.slice("--limit-markets=".length));
    else if (arg.startsWith("--limit-services=")) opts.limitServices = Number(arg.slice("--limit-services=".length));
    else if (arg.startsWith("--milestone=")) {
      const value = Number(arg.slice("--milestone=".length));
      if (value === 1) {
        opts.limitMarkets = 1;
        opts.limitServices = 3;
      }
    }
  }
  return opts;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(path.join(seoDir, file), "utf8"));
}

function mergeObjects(base, overlay) {
  if (Array.isArray(overlay)) return [...overlay];
  if (!overlay || typeof overlay !== "object") return overlay;

  const output = {
    ...(base && typeof base === "object" && !Array.isArray(base) ? base : {}),
  };
  for (const [key, value] of Object.entries(overlay)) {
    output[key] = value && typeof value === "object" && !Array.isArray(value)
      ? mergeObjects(output[key], value)
      : Array.isArray(value)
        ? [...value]
        : value;
  }
  return output;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stripHtml(value) {
  return String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function sentenceJoin(items) {
  const clean = items.filter(Boolean);
  if (clean.length <= 1) return clean.join("");
  return `${clean.slice(0, -1).join(", ")} and ${clean.at(-1)}`;
}

function marketCommunityLine(market) {
  if (market.slug !== "lake-elsinore") return "";
  return `<p><strong>Communities in Lake Elsinore:</strong> ${escapeHtml(sentenceJoin(market.neighborhoods))}.</p>`;
}

function customerFacingSignal(signal) {
  return String(signal ?? "")
    .replace(/\brouting\b/gi, "service access")
    .replace(/\s+/g, " ")
    .trim();
}

function smartTrim(value, limit) {
  const text = String(value).replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : limit - 1).trim()}.`;
}

function serviceSeoName(service) {
  return serviceTitleMap.get(service.slug) ?? service.name;
}

function makeUrl(prefix, parts = []) {
  const cleaned = parts.filter(Boolean).map((part) => String(part).replace(/^\/+|\/+$/g, ""));
  const normalized = normalizePrefix(prefix);
  if (normalized === "/" && cleaned.length) return `/${cleaned.join("/")}/`;
  const base = normalized === "/" ? "" : normalized.replace(/\/$/, "");
  return `${base}/${cleaned.join("/")}${cleaned.length ? "/" : ""}`;
}

function outputFileForUrl(outputRoot, prefix, urlPath) {
  const rel = urlPath.replace(prefix, "").replace(/^\/+/, "");
  if (!rel) return path.join(outputRoot, "index.html");
  return path.join(outputRoot, rel, "index.html");
}

export function generatedOutputRoot(out = "seo-preview") {
  const normalized = String(out || "seo-preview").replace(/^\/+/, "");
  const resolved = path.resolve(generatedBaseDir, normalized);
  if (!resolved.startsWith(`${generatedBaseDir}${path.sep}`)) {
    throw new Error(`generated output must stay inside ${path.relative(siteDir, generatedBaseDir)}`);
  }
  return resolved;
}

function normalizePrefix(prefix) {
  const raw = String(prefix || "/").trim();
  if (!raw || raw === "/") return "/";
  return `/${raw.replace(/^\/+|\/+$/g, "")}`;
}

function isCommercialSite(business) {
  return business.site_variant === "commercial";
}

function coreCopy(business) {
  return isCommercialSite(business) ? COMMERCIAL_CORE_COPY : CORE_COPY;
}

function blogCategoriesFor(business) {
  return isCommercialSite(business) ? COMMERCIAL_BLOG_CATEGORIES : BLOG_CATEGORIES;
}

function blogPostsFor(business) {
  return isCommercialSite(business) ? COMMERCIAL_BLOG_POSTS : BLOG_POSTS;
}

function isProductionRouteMode(business) {
  return normalizePrefix(business.preview_prefix) === "/";
}

function templatePrefix(prefix) {
  return normalizePrefix(prefix) === "/" ? "" : normalizePrefix(prefix);
}

function serviceRouteSlug(service) {
  return new Map([
    ["emergency-plumbing", "emergency-plumber"],
    ["drain-cleaning", "drain-cleaning"],
    ["hydro-jetting", "hydro-jetting"],
    ["water-heater-repair-install", "water-heater-repair"],
    ["sewer-line-repair", "sewer-line-repair"],
    ["leak-detection", "leak-detection"],
    ["slab-leak-repair", "slab-leak-repair"],
    ["repiping", "repiping"],
    ["gas-line-services", "gas-line-services"],
    ["fixture-install-repair", "fixture-repair"],
  ]).get(service.slug) ?? service.slug;
}

function cityHubUrl(business, market) {
  if (isProductionRouteMode(business)) return makeUrl("/", [`${market.slug}-plumber`]);
  return makeUrl(business.preview_prefix, ["locations", market.slug]);
}

function serviceHubUrl(business, service) {
  if (isProductionRouteMode(business)) return makeUrl("/", ["services", serviceRouteSlug(service)]);
  return makeUrl(business.preview_prefix, ["services", service.slug]);
}

function cityServiceUrl(business, market, service) {
  if (isProductionRouteMode(business)) return makeUrl("/", [`${market.slug}-${serviceRouteSlug(service)}`]);
  return makeUrl(business.preview_prefix, ["locations", market.slug, service.slug]);
}

function breadcrumbRoot(business) {
  return { name: "Home", urlPath: isProductionRouteMode(business) ? "/" : makeUrl(business.preview_prefix) };
}

function absoluteMedia(business, mediaPath) {
  return `${business.primary_domain}${mediaPath}`;
}

function businessEntityId(business) {
  return business.entity_id ?? `${business.primary_domain}/#business`;
}

function nearbyMarkets(market, marketMap) {
  return (market.nearby_slugs ?? []).map((slug) => marketMap.get(slug)).filter(Boolean);
}

function clientHeroCopy(business, market) {
  const communities = sentenceJoin(market.neighborhoods.slice(0, 3));
  return `Need a plumber in ${market.city}? Masterflow works on drains, sewer lines, leaks, water heaters, fixtures, and plumbing emergencies in ${communities} and nearby areas. Call ${business.phone_display}. Same-day service is available.`;
}

function cityServiceHeroCopy(business, market, service) {
  const copy = serviceCopy(service, business);
  return `Need ${serviceSeoName(service).toLowerCase()} in ${market.city}? ${copy.hero} Call ${business.phone_display}. Same-day service is available.`;
}

function displayLicenseNo(business) {
  return business.trust_copy?.headline ?? "Lic #1156577";
}

function reviewsUrl(business) {
  return makeUrl(business.preview_prefix, ["reviews"]);
}

function aboutUrl(business) {
  return makeUrl(business.preview_prefix, ["about"]);
}

function servicesIndexUrl(business) {
  return makeUrl(business.preview_prefix, ["services"]);
}

function serviceAreaIndexUrl(business) {
  return makeUrl(business.preview_prefix, ["service-area"]);
}

function contactUrl(business) {
  return makeUrl(business.preview_prefix, ["contact"]);
}

function requestServiceUrl(business) {
  return `${contactUrl(business)}#request-service`;
}

function commercialUrl() {
  return makeUrl("/", ["commercial"]);
}

function residentialUrl() {
  return "/";
}

function industriesIndexUrl(business) {
  return makeUrl(business.preview_prefix, ["industries"]);
}

function industryUrl(business, industry) {
  return makeUrl(business.preview_prefix, ["industries", industry.slug]);
}

function blogUrl(business) {
  return makeUrl(business.preview_prefix, ["blog"]);
}

function blogPostUrl(business, post) {
  return makeUrl(business.preview_prefix, ["blog", post.slug]);
}

function blogCategoryUrl(business, category) {
  return makeUrl(business.preview_prefix, ["category", category.slug]);
}

function yelpProfileUrl(business) {
  const urls = [...(business.same_as ?? []), ...(business.social ?? [])].filter(Boolean);
  return urls.find((url) => /(^|\/\/)(www\.)?yelp\.com\//i.test(url)) ?? "https://www.yelp.com/biz/masterflow-plumbing-lake-elsinore";
}

function adminUrl(business) {
  return makeUrl(business.preview_prefix, ["admin"]);
}

function phoneHref(business) {
  return `tel:${business.phone.replace(/\D/g, "")}`;
}

function serviceCopy(service, business = null) {
  const copySource = business && isCommercialSite(business) ? COMMERCIAL_SERVICE_COPY : SERVICE_COPY;
  return copySource[service.slug] ?? {
    title: serviceSeoName(service),
    eyebrow: "Plumbing service",
    hero: service.short_desc,
    intro: service.long_desc,
    signs: [],
    checks: service.long_desc,
    options: service.short_desc,
    prepare: "Share the affected fixture or line, the symptoms, and any access or prior repair information.",
  };
}

function orderedMarketsForNavigation(business, markets) {
  const priority = business.service_area?.priority_markets ?? [];
  const byCity = new Map(markets.map((market) => [market.city, market]));
  const selected = [];
  for (const city of priority) {
    const market = byCity.get(city);
    if (market && !selected.includes(market)) selected.push(market);
  }
  for (const market of markets) {
    if (!selected.includes(market)) selected.push(market);
  }
  return selected;
}

function serviceNavigationGroups(business, services) {
  const bySlug = new Map(services.map((service) => [service.slug, service]));
  const groups = isCommercialSite(business) ? [
    {
      title: "Priority calls",
      slugs: ["emergency-plumbing", "drain-cleaning", "leak-detection", "water-heater-repair-install"],
    },
    {
      title: "Drain and sewer",
      slugs: ["drain-cleaning", "hydro-jetting", "sewer-line-repair"],
    },
    {
      title: "Building plumbing",
      slugs: ["water-heater-repair-install", "repiping", "gas-line-services", "fixture-install-repair"],
    },
    {
      title: "Larger projects",
      slugs: ["sewer-line-repair", "slab-leak-repair", "repiping", "leak-detection"],
    },
  ] : [
    {
      title: "Priority calls",
      slugs: ["emergency-plumbing", "drain-cleaning", "leak-detection", "water-heater-repair-install"],
    },
    {
      title: "Drain and sewer",
      slugs: ["drain-cleaning", "hydro-jetting", "sewer-line-repair"],
    },
    {
      title: "Repairs and installs",
      slugs: ["water-heater-repair-install", "slab-leak-repair", "repiping", "gas-line-services", "fixture-install-repair"],
    },
    {
      title: "Commercial services",
      slugs: ["emergency-plumbing", "hydro-jetting", "sewer-line-repair", "leak-detection"],
    },
  ];
  return groups
    .map((group) => ({
      title: group.title,
      links: group.slugs
        .map((slug) => bySlug.get(slug))
        .filter(Boolean)
        .map((service) => ({
          href: serviceHubUrl(business, service),
          label: serviceSeoName(service),
        })),
    }))
    .filter((group) => group.links.length);
}

function footerServiceLinks(business, services) {
  return services.map((service) => ({
    href: serviceHubUrl(business, service),
    label: serviceSeoName(service),
  }));
}

function footerAreaLinks(business, markets) {
  if (isCommercialSite(business)) return [];
  return orderedMarketsForNavigation(business, markets).slice(0, 14).map((market) => ({
    href: cityHubUrl(business, market),
    label: `${market.city} plumber`,
  }));
}

function epoxyLinerMedia(business) {
  return Array.isArray(business.media?.epoxy_liner) ? business.media.epoxy_liner.filter(Boolean) : [];
}

function pageMediaForService(business, market, service, variant = "") {
  const assigned = business.media?.service_media?.[service?.slug] ?? [];
  const gallery = assigned.length ? assigned : business.media.gallery ?? [];
  const key = `${market?.slug ?? "service"}:${service?.slug ?? "general"}:${variant}`;
  const index = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) % Math.max(1, gallery.length);
  return gallery[index] ?? business.media.proof;
}

function mediaByFilename(business, filename, fallback = business.media.hero) {
  const serviceMedia = Object.values(business.media?.service_media ?? {}).flat();
  const candidates = [
    business.media?.hero,
    business.media?.proof,
    ...(business.media?.gallery ?? []),
    ...serviceMedia,
  ].filter(Boolean);
  return candidates.find((mediaPath) => String(mediaPath).endsWith(`/${filename}`)) ?? fallback;
}

function blogCategoryService(categorySlug, services) {
  const serviceSlug = new Map([
    ["drains-and-sewers", "sewer-line-repair"],
    ["repiping-and-pipe-materials", "repiping"],
    ["leaks-and-slab-leaks", "leak-detection"],
    ["water-heaters", "water-heater-repair-install"],
    ["emergency-and-maintenance", "emergency-plumbing"],
    ["commercial-and-trenchless", "sewer-line-repair"],
    ["property-operations", "drain-cleaning"],
    ["commercial-drains-and-sewers", "hydro-jetting"],
    ["trenchless-and-capital-projects", "sewer-line-repair"],
    ["commercial-emergency-planning", "emergency-plumbing"],
  ]).get(categorySlug);
  return services.find((service) => service.slug === serviceSlug) ?? services[0];
}

function mediaAltText(mediaPath, service) {
  const known = new Map([
    ["img-0617.jpg", "Masterflow technician using a sewer camera in a commercial restroom"],
    ["img-0634.jpg", "Commercial plumbing service truck staged for after-hours work"],
    ["img-0637.jpg", "Commercial drain and sewer cleaning equipment at an open manhole"],
    ["img-1059-poster.jpg", "Masterflow technician completing an outdoor water-line repair"],
    ["img-1070-poster.jpg", "Marked outdoor utility work area before excavation"],
    ["img-1072.jpg", "Plumbing service truck beside a protected outdoor utility work area"],
    ["img-1619.jpg", "New sewer cleanout and drain piping installed in an excavation"],
    ["img-1633.jpg", "Existing drain piping inspected during a commercial repair"],
    ["img-1669.jpg", "Repaired commercial drain piping and branch connection"],
    ["img-4824.jpg", "Failed copper water line exposed during leak repair"],
    ["80220303036-84fc15af-5fea-4bf1-ac12-f732cbea3924.jpg", "Outdoor backflow and water-service piping under repair"],
    ["dc1a645d-e617-4475-ad94-ccf3bb26cc00.jpg", "Rebuilt outdoor backflow and water-service assembly"],
  ]);
  const filename = String(mediaPath).split("/").at(-1)?.split("?")[0];
  if (known.has(filename)) return known.get(filename);
  if (String(mediaPath).includes("epoxy-sewer-liner-prep")) {
    return "Masterflow Plumbing epoxy sewer liner preparation for trenchless commercial sewer work";
  }
  if (String(mediaPath).includes("dan-cutter")) {
    return "Masterflow Plumbing Dan Cutter sewer liner reinstatement tool for one-hole sewer line access";
  }
  if (service?.slug === "sewer-line-repair") {
    return "Masterflow Plumbing sewer line repair and access work";
  }
  return "Masterflow Plumbing work vehicle and field proof";
}

function mediaTitle(mediaPath, service) {
  return mediaAltText(mediaPath, service);
}

function cityHubHeading(business, market) {
  return `Plumber in ${market.city}, CA`;
}

function cityHubMetaTitle(business, market) {
  const heading = cityHubHeading(business, market);
  const title = `${heading} | Masterflow`;
  return title.length <= 60 ? title : `Emergency Plumber ${market.city}, CA | Masterflow`;
}

function cityHubMetaDescription(business, market) {
  return metaDescriptionWithPhone(
    `${cityHubHeading(business, market)} for emergency plumbing, drains, sewer repair, hydro jetting, leaks, water heaters, and commercial plumbing.`,
    business.phone_display,
  );
}

function cityHubEyebrow(market) {
  if (["Riverside County", "San Bernardino County"].includes(market.county)) return "Inland Empire Plumber";
  return `${market.county} Plumber`;
}

function secondaryCtaLabel(market) {
  return "See Areas We Serve";
}

function metaDescriptionWithPhone(intro, phone, limit = 155) {
  const call = ` Call ${phone}.`;
  return `${smartTrim(intro, limit - call.length)}${call}`;
}

function cityServiceMetaDescription(business, market, service) {
  const city = market.city;
  const phone = business.phone_display;
  const descriptions = {
    "emergency-plumbing": `Need an emergency plumber in ${city}? Masterflow responds 24/7 for leaks, burst pipes, sewer backups, drains, and urgent repairs.`,
    "drain-cleaning": `Clogged drain in ${city}? Masterflow handles kitchen, bathroom, laundry, and main sewer line blockages.`,
    "sewer-line-repair": `Sewer problem in ${city}? Masterflow handles camera inspections, sewer repair, trenchless options, liner prep, and sewer replacement.`,
    "water-heater-repair-install": `No hot water in ${city}? Masterflow repairs and installs tank and tankless water heaters. Same-day service is available.`,
    "leak-detection": `Water leak in ${city}? Masterflow checks visible and hidden leak clues, valves, meter movement, pressure, and accessible lines before recommending work.`,
    "hydro-jetting": `Need hydro jetting in ${city}? Masterflow clears grease, roots, sludge, and heavy drain buildup when jetting is the right solution.`,
  };
  return metaDescriptionWithPhone(descriptions[service.slug] ?? `${serviceSeoName(service)} in ${city}, CA from Masterflow Plumbing. Same-day service, upfront pricing, and financing are available.`, phone);
}

function cityServiceMetaTitle(market, service) {
  const name = serviceSeoName(service);
  if (service.slug === "emergency-plumbing") {
    return `24/7 ${name} in ${market.city}, CA | Masterflow`;
  }
  return `${name} in ${market.city}, CA | Masterflow`;
}

function pageShell({
  kind,
  urlPath,
  metaTitle,
  metaDescription,
  h1,
  heroCopy,
  eyebrow,
  body,
  business,
  markets,
  services,
  market,
  service,
  schema,
  options,
  heroMedia = business.media.hero,
  searchIndexable = null,
  lastmod = COPY_LASTMOD,
}) {
  const primaryMarket = markets.find((item) => item.slug === "corona") ?? markets[0];
  const primaryService = services.find((item) => item.slug === "emergency-plumbing") ?? services[0];
  const shouldIndex = searchIndexable ?? (options.indexable && !["admin", "city-service"].includes(kind));
  const robots = shouldIndex ? "index,follow" : options.indexable ? "noindex,follow" : "noindex,nofollow";
  const normalizedPrefix = normalizePrefix(business.preview_prefix);
  return {
    kind,
    urlPath,
    outFile: outputFileForUrl(generatedOutputRoot(options.out), normalizedPrefix, urlPath),
    meta: {
      title: smartTrim(metaTitle, 60),
      description: smartTrim(metaDescription, 155),
      robots,
      canonical: `${business.primary_domain}${urlPath}`,
      lastmod,
    },
    h1,
    heroCopy,
    eyebrow,
    body,
    heroMedia,
    business,
    isCommercial: isCommercialSite(business),
    prefix: templatePrefix(normalizedPrefix),
    navHomeHref: makeUrl(normalizedPrefix),
    navResidentialHref: residentialUrl(),
    navCommercialHref: commercialUrl(),
    navAboutHref: aboutUrl(business),
    navPrimaryMarketHref: cityHubUrl(business, primaryMarket),
    navPrimaryMarketLabel: "Serving Corona & the Inland Empire",
    navServicesHref: servicesIndexUrl(business),
    navServiceAreaHref: serviceAreaIndexUrl(business),
    navIndustriesHref: industriesIndexUrl(business),
    navBlogHref: blogUrl(business),
    reviewsHref: reviewsUrl(business),
    contactHref: contactUrl(business),
    requestServiceHref: requestServiceUrl(business),
    adminHref: adminUrl(business),
    secondaryCtaLabel: secondaryCtaLabel(market),
    sitemapHref: makeUrl(normalizedPrefix, ["sitemap.xml"]).replace(/\/$/, ""),
    sitemapBrandLogoHref: makeUrl(normalizedPrefix, ["sitemap-assets", "valen-systems-logo.png"]).replace(/\/$/, ""),
    sitemapBrandFontHref: makeUrl(normalizedPrefix, ["sitemap-assets", "squarish-sans-ct-regular.woff2"]).replace(/\/$/, ""),
    locationLabel: isCommercialSite(business) ? "Southern California" : market?.city ?? "Corona",
    primaryMarket,
    primaryService,
    serviceNavGroups: serviceNavigationGroups(business, services),
    footerServiceLinks: footerServiceLinks(business, services),
    footerAreaLinks: footerAreaLinks(business, markets),
    licenseDisplay: displayLicenseNo(business),
    absoluteMedia: (mediaPath) => absoluteMedia(business, mediaPath),
    maintainer,
    schema,
  };
}

function openingHoursSpecification(hours) {
  if (hours !== "Mo-Su 00:00-23:59") return null;
  return {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    opens: "00:00",
    closes: "23:59",
  };
}

function localBusinessSchema(business, markets, services = []) {
  const sameAs = [...new Set([...(business.same_as ?? []), ...(business.social ?? [])].filter(Boolean))];
  const areaServed = isCommercialSite(business)
    ? (business.commercial_reputation?.markets ?? []).map((market) => ({
      "@type": "AdministrativeArea",
      name: market,
    }))
    : markets.map((market) => ({
      "@type": "City",
      name: `${market.city}, ${market.state}`,
      containedInPlace: {
        "@type": "AdministrativeArea",
        name: market.county,
      },
    }));
  const hoursSpec = openingHoursSpecification(business.hours);
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "Plumber"],
    "@id": businessEntityId(business),
    name: business.name ?? business.dba ?? business.legal_name,
    alternateName: business.alternate_names ?? [business.legal_name, business.dba].filter(Boolean),
    legalName: business.legal_name,
    description: business.description,
    slogan: business.tagline,
    telephone: business.phone,
    url: business.primary_domain,
    image: absoluteMedia(business, business.media.hero),
    priceRange: business.price_range,
    openingHours: business.hours,
    ...(hoursSpec ? { openingHoursSpecification: [hoursSpec] } : {}),
    sameAs,
    identifier: [
      {
        "@type": "PropertyValue",
        name: "California Contractors State License Board license",
        value: business.license_no,
      },
    ],
    hasCredential: {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "contractor license",
      name: business.license_no,
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: business.phone,
      contactType: "customer service",
      areaServed: "Southern California",
      availableLanguage: "English",
    },
    knowsAbout: business.knows_about ?? services.map((service) => service.name),
    address: {
      "@type": "PostalAddress",
      addressLocality: business.address.city,
      addressRegion: business.address.state,
      addressCountry: business.address.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: business.geo.lat,
      longitude: business.geo.lng,
    },
    areaServed,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Masterflow Plumbing services",
      itemListElement: services.map((service) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: service.name,
          serviceType: service.schema_service_type,
        },
      })),
    },
  };
}

function breadcrumbSchema(business, crumbs) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: new URL(crumb.urlPath, business.primary_domain).href,
    })),
  };
}

function serviceSchema(business, market, service) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: service.schema_service_type,
    name: `${service.name} in ${market.city}, CA`,
    provider: { "@id": businessEntityId(business) },
    areaServed: {
      "@type": "City",
      name: `${market.city}, CA`,
      containedInPlace: market.county,
    },
    description: service.short_desc,
  };
}

function faqSchema(faqs) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };
}

function webPageSchema(business, { name, urlPath, description }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    url: `${business.primary_domain}${urlPath}`,
    description,
    isPartOf: { "@type": "WebSite", url: business.primary_domain },
    about: { "@id": businessEntityId(business) },
  };
}

function articleSchema(business, post) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: COPY_LASTMOD,
    dateModified: COPY_LASTMOD,
    mainEntityOfPage: `${business.primary_domain}${blogPostUrl(business, post)}`,
    author: {
      "@type": "Organization",
      name: business.name ?? business.dba ?? business.legal_name,
      url: business.primary_domain,
    },
    publisher: {
      "@type": "Organization",
      name: business.name ?? business.dba ?? business.legal_name,
      url: business.primary_domain,
      logo: {
        "@type": "ImageObject",
        url: absoluteMedia(business, business.media.logo),
      },
    },
    image: absoluteMedia(business, business.media.social || business.media.hero),
    about: { "@id": businessEntityId(business) },
  };
}

function applyFaqTokens(faqs, market, service) {
  const tokenMap = {
    "{{city}}": market.city,
    "{{service}}": service.name,
    "{{service_lower}}": service.name.toLowerCase(),
    "{{neighborhoods}}": sentenceJoin(market.neighborhoods.slice(0, 3)),
  };
  return faqs.map((faq) => {
    let q = faq.q;
    let a = faq.a;
    for (const [token, value] of Object.entries(tokenMap)) {
      q = q.replaceAll(token, value);
      a = a.replaceAll(token, value);
    }
    return { q, a };
  });
}

function cardGrid(items) {
  return `<div class="grid">${items
    .map(
      (item) => `<article class="card">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.text)}</p>
        ${item.href ? `<p><a href="${escapeHtml(item.href)}">${escapeHtml(item.linkText ?? "Open")}</a></p>` : ""}
      </article>`,
    )
    .join("")}</div>`;
}

function relatedList(items) {
  return `<div class="related-list">${items
    .map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`)
    .join("")}</div>`;
}

function sewerLinePhotoSection(business) {
  const photos = epoxyLinerMedia(business);
  if (!photos.length) return "";
  const captions = [
    {
      title: "Commercial liner prep",
      text: "Epoxy sewer liner preparation for trenchless repair planning.",
    },
    {
      title: "After-hours access",
      text: "Commercial sewer work staged to limit client and tenant disruption.",
    },
    {
      title: "Trenchless technology",
      text: "Liner material prepared for trenchless sewer work when the pipe and access are suitable.",
    },
    {
      title: "Repair and install support",
      text: "Crew support for commercial sewer repairs, replacements, and installs.",
    },
  ];
  return `
    <section>
      <span class="section-kicker">Field proof</span>
      <h2>Epoxy sewer liner prep with minimal intrusion</h2>
      <p class="lede">These field photos show Masterflow preparing trenchless epoxy sewer liner work. The liner process can reduce digging, and the robot cutter can reopen branch tie-ins afterward so commercial and residential properties avoid unnecessary mess.</p>
      <div class="media-grid">
        ${photos
          .map((photo, index) => {
            const caption = captions[index] ?? captions.at(-1);
            return `<figure class="media-card">
              <img src="${escapeHtml(photo)}" width="1200" height="1600" alt="${escapeHtml(mediaAltText(photo, { slug: "sewer-line-repair" }))}" title="${escapeHtml(mediaTitle(photo, { slug: "sewer-line-repair" }))}" loading="lazy" decoding="async">
              <figcaption><strong>${escapeHtml(caption.title)}</strong><span>${escapeHtml(caption.text)}</span></figcaption>
            </figure>`;
          })
          .join("")}
      </div>
    </section>
  `;
}

const promotedRootLinks = [
  ["/corona-plumber", "Corona plumber"],
  ["/corona-emergency-plumber", "Corona emergency plumber"],
  ["/corona-drain-cleaning", "Corona drain cleaning"],
  ["/corona-leak-detection", "Corona leak detection"],
  ["/corona-sewer-line-repair", "Corona sewer line repair"],
  ["/corona-water-heater-repair", "Corona water heater repair"],
  ["/lake-elsinore-plumber", "Lake Elsinore plumber"],
  ["/lake-elsinore-emergency-plumber", "Lake Elsinore emergency plumber"],
  ["/lake-elsinore-drain-cleaning", "Lake Elsinore drain cleaning"],
  ["/lake-elsinore-leak-detection", "Lake Elsinore leak detection"],
  ["/lake-elsinore-sewer-line-repair", "Lake Elsinore sewer line repair"],
  ["/lake-elsinore-water-heater-repair", "Lake Elsinore water heater repair"],
  ["/norco-plumber", "Norco plumber"],
  ["/norco-emergency-plumber", "Norco emergency plumber"],
  ["/norco-drain-cleaning", "Norco drain cleaning"],
  ["/riverside-plumber", "Riverside plumber"],
  ["/riverside-emergency-plumber", "Riverside emergency plumber"],
  ["/riverside-drain-cleaning", "Riverside drain cleaning"],
  ["/moreno-valley-plumber", "Moreno Valley plumber"],
  ["/moreno-valley-emergency-plumber", "Moreno Valley emergency plumber"],
  ["/moreno-valley-drain-cleaning", "Moreno Valley drain cleaning"],
  ["/perris-plumber", "Perris plumber"],
  ["/perris-emergency-plumber", "Perris emergency plumber"],
  ["/perris-drain-cleaning", "Perris drain cleaning"],
  ["/calabasas-emergency-plumber", "Calabasas emergency plumber"],
  ["/san-fernando-valley-plumber", "San Fernando Valley plumber"],
  ["/hollywood-plumber", "Hollywood plumber"],
  ["/studio-city-plumber", "Studio City plumber"],
  ["/topanga-plumber", "Topanga plumber"],
  ["/glendale-plumber", "Glendale plumber"],
  ["/malibu-emergency-plumber", "Malibu emergency plumber"],
  ["/pasadena-drain-cleaning", "Pasadena drain cleaning"],
];

function promotedRootLinkSection(currentPath = "") {
  const normalized = String(currentPath || "").replace(/\/$/, "") || "/";
  const items = promotedRootLinks
    .filter(([href]) => href !== normalized)
    .slice(0, 32)
    .map(([href, label]) => ({ href, label }));
  return `
    <section>
      <span class="section-kicker">More service areas</span>
      <h2>Need plumbing help in another area?</h2>
      <p class="lede">Find your city below, then open the plumbing service you need.</p>
      ${relatedList(items)}
    </section>
  `;
}

function faqDetails(faqs) {
  return faqs
    .map(
      (faq) => `<details>
        <summary>${escapeHtml(faq.q)}</summary>
        <p>${escapeHtml(faq.a)}</p>
      </details>`,
    )
    .join("");
}

function categoryBySlug(slug, categories = BLOG_CATEGORIES) {
  return categories.find((category) => category.slug === slug) ?? null;
}

function blogSourceLabel(key) {
  return new Map([
    ["cslbLicenseCheck", "California contractor license check"],
    ["epaLeakMonitoring", "EPA WaterSense leak detection guidance"],
    ["epaHomeMaintenance", "EPA WaterSense home maintenance guidance"],
    ["doeWaterHeaterSelection", "U.S. Department of Energy water-heater guidance"],
    ["socalGasEmergency", "SoCalGas gas-emergency guidance"],
  ]).get(key) ?? key;
}

function blogIndexBody({ business, posts, categories }) {
  const featured = posts.slice(0, 6);
  const commercial = isCommercialSite(business);
  return `
    <section id="local-proof" class="local-panel">
      <div>
        <span class="section-kicker">${commercial ? "Masterflow commercial guides" : "Masterflow plumbing guides"}</span>
        <h2>${commercial ? "Useful plumbing guides for people running properties." : "Answers to common plumbing questions."}</h2>
        <p>${commercial ? "Read about maintenance records, recurring drains, emergency planning, due diligence, after-hours work, downtime, and larger sewer projects." : "Learn why drains gurgle, what can cause a high water bill, when a water heater may need replacement, and what to do during a plumbing emergency."}</p>
        ${commercial ? "<p>Use the guides to prepare access, compare service history, brief ownership, and keep useful plumbing records with each property.</p>" : ""}
        <p>${commercial ? "For an active leak, sewage backup, failed shutoff, or loss of essential hot water at an occupied property, " : "If water is spreading, sewage is backing up, you smell gas, a shutoff has failed, or the water heater is leaking, "}call ${escapeHtml(business.phone_display)} now.</p>
      </div>
      <div class="media-proof"><img src="${escapeHtml(business.media.hero)}" alt="Masterflow Plumbing service van" title="Masterflow Plumbing service van"></div>
    </section>
    <section>
      <span class="section-kicker">Browse by topic</span>
      <h2>${commercial ? "Choose a commercial plumbing topic." : "Pick a plumbing topic."}</h2>
      ${cardGrid(categories.map((category) => ({
        title: category.name,
        text: category.description,
        href: blogCategoryUrl(business, category),
        linkText: `Browse ${category.name}`,
      })))}
    </section>
    <section>
      <span class="section-kicker">Featured guides</span>
      <h2>${commercial ? "Commercial plumbing guides" : "Popular plumbing guides"}</h2>
      ${cardGrid(featured.map((post) => ({
        title: post.title,
        text: post.description,
        href: blogPostUrl(business, post),
        linkText: "Read guide",
      })))}
    </section>
    <section>
      <span class="section-kicker">All plumbing guides</span>
      <h2>All ${posts.length} Masterflow ${commercial ? "commercial " : ""}plumbing guides</h2>
      ${relatedList(posts.map((post) => ({ href: blogPostUrl(business, post), label: post.title })))}
    </section>
    ${requestServicePanel({ business })}
  `;
}

function blogCategoryBody({ business, category, posts, categories = blogCategoriesFor(business) }) {
  const commercial = isCommercialSite(business);
  return `
    <section>
      <span class="section-kicker">Masterflow plumbing guides</span>
      <h2>${escapeHtml(category.name)}</h2>
      <p class="lede">${escapeHtml(category.description)}</p>
      ${commercial ? "<p>Share these guides with the manager, onsite contact, facilities team, or owner responsible for access and approval.</p>" : ""}
      ${cardGrid(posts.map((post) => ({
        title: post.title,
        text: post.description,
        href: blogPostUrl(business, post),
        linkText: "Read guide",
      })))}
    </section>
    <section>
      <span class="section-kicker">More topics</span>
      <h2>More plumbing topics</h2>
      ${relatedList(categories
        .filter((item) => item.slug !== category.slug)
        .map((item) => ({ href: blogCategoryUrl(business, item), label: item.name })))}
    </section>
    ${requestServicePanel({ business })}
  `;
}

function blogPostBody({ business, post, posts, services, categories = blogCategoriesFor(business) }) {
  const category = categoryBySlug(post.category, categories);
  const service = services.find((item) => item.slug === post.serviceSlug);
  const related = posts
    .filter((item) => item.slug !== post.slug && (item.category === post.category || item.serviceSlug === post.serviceSlug))
    .slice(0, 6);
  const sources = (post.sources ?? [])
    .map((key) => ({ key, url: OFFICIAL_GUIDANCE[key] }))
    .filter((source) => source.url);
  return `
    <article class="article-body">
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="${blogUrl(business)}">Blog</a>
        ${category ? `<span>/</span><a href="${blogCategoryUrl(business, category)}">${escapeHtml(category.name)}</a>` : ""}
      </nav>
      <p class="article-intro">${escapeHtml(post.lede)}</p>
      ${post.sections.map((section) => `
        <section>
          <h2>${escapeHtml(section.heading)}</h2>
          ${(section.paragraphs ?? []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
        </section>`).join("")}
      ${post.checklist?.length ? `
        <section class="article-checklist">
          <span class="section-kicker">Before you call</span>
          <h2>Have these details ready</h2>
          <ul>${post.checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </section>` : ""}
      ${post.faq?.length ? `
        <section>
          <span class="section-kicker">FAQ</span>
          <h2>Frequently asked question</h2>
          ${faqDetails(post.faq)}
        </section>` : ""}
      ${sources.length ? `
        <section class="article-sources">
          <span class="section-kicker">Public guidance</span>
          <h2>Safety and consumer sources</h2>
          <ul>${sources.map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(blogSourceLabel(source.key))}</a></li>`).join("")}</ul>
        </section>` : ""}
      <section>
        <span class="section-kicker">Related Masterflow guides</span>
        <h2>Keep reading</h2>
        ${relatedList(related.map((item) => ({ href: blogPostUrl(business, item), label: item.title })))}
        ${service ? `<p><a class="button text-button" href="${serviceHubUrl(business, service)}">View ${escapeHtml(serviceCopy(service, business).title)}</a></p>` : ""}
      </section>
    </article>
    ${requestServicePanel({ business, service })}
  `;
}

function processGrid(market, service) {
  return `<div class="process">
    <div class="step"><strong>Call or request service</strong><p>Tell us which fixture or line is affected, whether water or sewage is moving, and whether the ${escapeHtml(market.city)} property is a home or business.</p></div>
    <div class="step"><strong>We inspect the plumbing</strong><p>We check the affected plumbing, shutoffs, access points, water or drain behavior, and signs that the trouble extends beyond one fixture.</p></div>
    <div class="step"><strong>You see the price first</strong><p>We explain the recommended repair and give you upfront pricing before work starts. Financing is available.</p></div>
    <div class="step"><strong>We test the completed work</strong><p>After the repair, we test it and tell you what was fixed and what to watch for.</p></div>
  </div>`;
}

function emergencySignalCards(market, service) {
  const serviceName = service.name.toLowerCase();
  const emergencyLead = service.emergency
    ? `Call right away when ${serviceName} is tied to active water, sewage, gas odor, no hot water, or a fixture that cannot be shut down safely.`
    : `Schedule service when ${serviceName} is starting to repeat, affecting multiple fixtures, or creating risk before it turns urgent.`;
  return [
    {
      title: "When to call now",
      text: emergencyLead,
    },
    {
      title: "What helps dispatch",
      text: `Tell Masterflow the nearest cross streets or ZIP, whether the issue is inside or outside, what fixture or line is affected, and whether water is actively moving.`,
    },
    {
      title: "Details that affect the repair",
      text: `${market.city} calls can involve ${sentenceJoin(market.local_signals.map((signal) => customerFacingSignal(signal).toLowerCase()))}, so access, pipe age, cleanouts, water pressure, and prior repair history matter.`,
    },
  ];
}

function serviceDepthCards(market, service) {
  const city = market.city;
  const generic = [
    {
      title: "Stop active damage first",
      text: `We check the fixture, shutoff, access point, and active damage to see whether the ${service.name.toLowerCase()} call in ${city} needs emergency service.`,
    },
    {
      title: "We inspect the plumbing",
      text: "We explain what failed, what we recommend repairing, and any work you do not need.",
    },
    {
      title: "We test the work",
      text: "We check the completed repair and tell you what to watch after the visit.",
    },
  ];
  const byService = {
    "emergency-plumbing": [
      {
        title: "Active water and fixture failures",
        text: `Emergency calls in ${city} usually start with active water, an overflowing fixture, a failed shutoff, a burst line, or a room that cannot be used until the plumbing is stabilized.`,
      },
      {
        title: "Drain and sewer emergencies",
        text: `Backups, sewage smells, main-line symptoms, and repeated clogged drains get checked for branch-line versus main-line behavior before work is recommended.`,
      },
      {
        title: "After-hours response signals",
        text: `On a 24/7 call, we focus on stopping active damage, making the plumbing safe to use, and explaining the price before work starts.`,
      },
      {
        title: "Commercial emergency coverage",
        text: `For businesses, Masterflow can plan around customer access, tenant disruption, restrooms, drains, sewer lines, and service continuity when plumbing failure threatens operations.`,
      },
    ],
    "drain-cleaning": [
      {
        title: "Fixture, branch, and main-line symptoms",
        text: `Drain cleaning in ${city} can mean one slow sink, multiple affected fixtures, laundry line trouble, kitchen grease, bathroom stoppages, or main-line backup behavior.`,
      },
      {
        title: "When a camera helps",
        text: `A cable or rooter pass may clear the clog. If it keeps coming back, a camera inspection or hydro jetting can show why another basic clearing did not last.`,
      },
      {
        title: "Grease, roots, sludge, and scale",
        text: `The blockage and condition of the pipe determine whether the line needs a cable, rooter equipment, camera inspection, or hydro jetting.`,
      },
      {
        title: "Commercial drain support",
        text: `High-use commercial drains need cleanup, access, timing, and follow-up planning that keeps restrooms, kitchens, salons, offices, and tenant spaces functioning.`,
      },
    ],
    "sewer-line-repair": [
      {
        title: "Evidence before excavation",
        text: `Sewer repair starts with backup patterns, cleanout behavior, camera findings, access, pipe age, and whether the failure can be solved without opening more of the property than needed.`,
      },
      {
        title: "Epoxy liner prep",
        text: `Masterflow can prepare sewer lines for epoxy liner work when the line condition, branch connections, and access support that method.`,
      },
      {
        title: "Dan Cutter reinstatement",
        text: `The Dan Cutter sewer liner reinstatement tool lets the crew reopen branch tie-ins after liner work from one access point, reducing mess inside homes and commercial properties.`,
      },
      {
        title: "Commercial repairs and installs",
        text: `Masterflow handles commercial sewer repairs, replacements, and installs where downtime, tenant access, cleanup, and minimal intrusion matter.`,
      },
    ],
    "leak-detection": [
      {
        title: "Visible and hidden leak clues",
        text: `Leak detection in ${city} can start with meter movement, wet flooring, wall staining, pressure change, noise, warm spots, valve behavior, or an unexplained water bill.`,
      },
      {
        title: "Find the line before opening the wall",
        text: `Masterflow narrows the fixture, valve, slab, or service-line area before opening walls, floors, or concrete.`,
      },
      {
        title: "Stop active water first",
        text: `The plumber identifies what can be shut off, what needs repair now, and what water damage may need separate cleanup.`,
      },
    ],
    "water-heater-repair-install": [
      {
        title: "No hot water and leaking tanks",
        text: `Water heater calls in ${city} often involve no hot water, tank leaks, pilot or ignition issues, corrosion, valve problems, venting concerns, or capacity mismatch.`,
      },
      {
        title: "Repair versus replacement",
        text: `Masterflow checks whether the unit can be repaired before recommending replacement. The visit also covers shutoffs, drainage, venting, power or gas, and startup.`,
      },
      {
        title: "Tank and tankless planning",
        text: `Masterflow services tank and tankless water heaters. The plumber checks the unit, utilities, venting, drainage, capacity, and the source of the failure.`,
      },
    ],
  };
  return byService[service.slug] ?? generic;
}

function serviceCallPreparationSection(market, service) {
  const copy = serviceCopy(service);
  const symptomLabels = copy.signs.slice(0, 3).map(([label]) => label.toLowerCase());
  return `
    <section>
      <span class="section-kicker">Before you call</span>
      <h2>Three things to mention about the ${escapeHtml(service.name.toLowerCase())} problem</h2>
      <p class="lede">You do not need to diagnose it. Tell us where the trouble is, whether water or sewage is moving, and what the plumber can reach.</p>
      ${cardGrid([
        {
          title: "Where is the problem?",
          text: `Tell Masterflow whether the call involves ${sentenceJoin(symptomLabels)}, or another change at a fixture, drain, heater, wall, floor, yard, or sewer cleanout.`,
        },
        {
          title: "Is anything active?",
          text: `Note whether water is spreading, sewage is backing up, hot water is unavailable, a gas odor is present, several fixtures are affected, or a shutoff will not close.`,
        },
        {
          title: "What is easy to reach?",
          text: `Mention cleanouts, shutoffs, crawlspace or attic access, prior repairs, camera footage, pipe material, tenant restrictions, and the best way to reach the affected area in ${market.city}.`,
        },
      ])}
    </section>
  `;
}

function businessTrustCopy(business) {
  const explicit = business.trust_copy ?? {};
  const offerReasons = [
    business.offers?.emergency_service_24_7 && "24/7 Emergency Service",
    business.offers?.same_day_service_available && "Same-Day Service Available",
    business.offers?.financing_available && "Financing Available",
    business.offers?.upfront_pricing && "Upfront Pricing",
    business.offers?.service_guarantee && "Work Backed by Masterflow",
  ].filter(Boolean);
  const reasons = [
    displayLicenseNo(business),
    "Bonded & Insured",
    ...offerReasons,
    "Real Customer Reviews",
    ...(explicit.reasons ?? []),
  ];
  return {
    eyebrow: "Licensed Bonded & Insured",
    headline: displayLicenseNo(business),
    summary:
      `Masterflow is a California licensed plumbing contractor for homes and businesses. Call ${business.phone_display} anytime. Same-day service, upfront pricing, and financing are available.`,
    why_choose_heading: "Why customers call Masterflow",
    cta: `Call ${business.phone_display} for service, an estimate, or current availability.`,
    ...explicit,
    reasons: [...new Set(reasons)],
  };
}

function businessServiceAreaCopy(business) {
  return {
    eyebrow: "Service Areas",
    headline: "Serving Southern California",
    summary:
      `Masterflow serves Riverside County, the Inland Empire, and selected communities in Orange and Los Angeles counties. Call ${business.phone_display} to check same-day availability for your city.`,
    cards: [
      {
        title: "Corona & Norco",
        text: "Emergency plumbing, drain cleaning, hydro jetting, sewer repair, water-heater service, leak detection, and commercial plumbing.",
      },
      {
        title: "Riverside & Moreno Valley",
        text: "Residential and commercial plumbing, trenchless sewer repair, sewer camera inspections, drain cleaning, hydro jetting, repiping, and emergency plumbing.",
      },
      {
        title: "Lake Elsinore & Menifee",
        text: "24/7 emergency plumbing, sewer line repair, drain cleaning, water heater installation, leak detection, and trenchless sewer solutions.",
      },
    ],
    ...(business.service_area_copy ?? {}),
  };
}

function businessEstimateCopy(business) {
  return {
    eyebrow: "Estimates & Financing",
    headline: "Honest Estimates. No Surprises.",
    summary:
      "Masterflow gives you upfront pricing before work starts. Financing is available. Ask which warranty or guarantee applies to your repair.",
    button: "Request Service",
    ...(business.estimate_copy ?? {}),
  };
}

function trustReasonText(reason, business) {
  const lookup = new Map([
    [displayLicenseNo(business), `Masterflow Plumbing is a California licensed plumbing contractor. Verify ${displayLicenseNo(business)} before booking.`],
    ["Bonded & Insured", "Bonding and insurance help protect homeowners, businesses, and commercial property managers when plumbing work is underway."],
    ["24/7 Emergency Service", `Call ${business.phone_display} anytime for leaks, backups, burst pipes, failed shutoffs, or no hot water.`],
    ["Same-Day Service Available", "Same-day appointments are available. Call to check the schedule for your city and service."],
    ["Financing Available", "Ask about financing for plumbing, sewer, repiping, and water-heater work."],
    ["Upfront Pricing", "The plumber explains the recommended repair and price before starting the work."],
    ["Work Backed by Masterflow", "Masterflow stands behind its work. Ask which warranty or guarantee applies to your repair."],
    ["Real Customer Reviews", "Read approved customer excerpts and open the Masterflow Yelp profile before booking."],
  ]);
  return lookup.get(reason) ?? reason;
}

function licenseTrustSection(business, market = null, service = null) {
  const trust = businessTrustCopy(business);
  const contextualCards = [];
  if (market && service) {
    contextualCards.push({
      title: `${serviceSeoName(service)} in ${market.city}`,
      text: `Call Masterflow for licensed ${serviceSeoName(service).toLowerCase()} in ${market.city}. Same-day service, upfront pricing, and financing are available.`,
    });
  } else if (market) {
    contextualCards.push({
      title: `${market.city} service coverage`,
      text: `For ${market.city} homes and businesses, Masterflow connects emergency plumbing, drain cleaning, sewer repair, hydro jetting, water heater service, leak detection, and commercial plumbing to one licensed company.`,
    });
  }
  return `
    <section>
      <span class="section-kicker">${escapeHtml(trust.eyebrow)}</span>
      <h2>${escapeHtml(trust.headline)}</h2>
      <p class="lede">${escapeHtml(trust.summary)}</p>
      <p><strong>${escapeHtml(trust.why_choose_heading)}</strong></p>
      ${cardGrid(
        [
          ...contextualCards,
          ...trust.reasons.map((reason) => ({
            title: reason,
            text: trustReasonText(reason, business),
          })),
        ],
      )}
      <p class="lede">${escapeHtml(trust.cta)}</p>
    </section>
  `;
}

function serviceAreaSummarySection(business, market = null, service = null) {
  const serviceArea = businessServiceAreaCopy(business);
  const contextualCards = [];
  if (market && service) {
    contextualCards.push({
      title: `${market.city} ${serviceSeoName(service).toLowerCase()} service`,
      text: `${service.short_desc} Masterflow adapts the call for ${market.city} neighborhoods such as ${sentenceJoin(market.neighborhoods.slice(0, 4))}, nearby ZIPs ${market.zips.slice(0, 4).join(", ")}, and the property's access, urgency, and plumbing condition.`,
    });
  } else if (market) {
    contextualCards.push({
      title: `${market.city} plumbing coverage`,
      text: `Masterflow serves ${market.city} neighborhoods such as ${sentenceJoin(market.neighborhoods.slice(0, 4))} with emergency plumbing, drain cleaning, sewer repair, hydro jetting, water heater services, leak detection, and commercial plumbing support.`,
    });
  }
  return `
    <section>
      <span class="section-kicker">${escapeHtml(serviceArea.eyebrow)}</span>
      <h2>${escapeHtml(serviceArea.headline)}</h2>
      <p class="lede">${escapeHtml(serviceArea.summary)}</p>
      ${cardGrid([...contextualCards, ...serviceArea.cards])}
    </section>
  `;
}

function estimateSection(business, market = null, service = null) {
  const estimate = businessEstimateCopy(business);
  const contextualCards = [];
  if (market && service) {
    contextualCards.push({
      title: `${serviceSeoName(service)} estimates in ${market.city}`,
      text: `After inspecting the ${serviceSeoName(service).toLowerCase()} problem in ${market.city}, Masterflow will explain the repair and price before starting.`,
    });
  } else if (market) {
    contextualCards.push({
      title: `${market.city} plumbing estimates`,
      text: `Masterflow gives ${market.city} homeowners and businesses upfront pricing for plumbing, drain, sewer, water-heater, leak, hydro-jetting, and commercial work.`,
    });
  } else if (service) {
    contextualCards.push({
      title: `${serviceSeoName(service)} estimates`,
      text: `Masterflow gives upfront pricing for the recommended ${serviceSeoName(service).toLowerCase()} repair. Financing is available.`,
    });
  }
  return `
    <section>
      <span class="section-kicker">${escapeHtml(estimate.eyebrow)}</span>
      <h2>${escapeHtml(estimate.headline)}</h2>
      <p class="lede">${escapeHtml(estimate.summary)}</p>
      ${contextualCards.length ? cardGrid(contextualCards) : ""}
      <p><a class="button primary" href="tel:${business.phone.replace(/\D/g, "")}">${escapeHtml(estimate.button)}</a></p>
    </section>
  `;
}

function customerProofSection(business, market, service) {
  return licenseTrustSection(business, market, service);
}

function commercialReputationSection(business, market, service = null) {
  const reputation = business.commercial_reputation ?? {};
  const propertyTypes = reputation.property_types ?? [];
  return `
    <section>
      <span class="section-kicker">${escapeHtml(reputation.eyebrow ?? "Commercial Plumbing & Trenchless Sewer Services")}</span>
      <h2>${escapeHtml(reputation.headline ?? "Commercial Plumbing, Sewer Repair & Trenchless Solutions")}</h2>
      <p class="lede">${escapeHtml(reputation.summary ?? "Masterflow handles commercial plumbing, drain and sewer work, hydro jetting, camera inspections, trenchless preparation, leak detection, and larger repair projects for managed and operating properties.")}</p>
      ${cardGrid([
        {
          title: "Commercial plumbing",
          text: reputation.commercial_plumbing ?? "From restaurants and retail centers to apartment communities, office buildings, industrial facilities, and HOAs, Masterflow provides commercial plumbing repairs, installations, maintenance, and emergency service.",
        },
        {
          title: "Trenchless sewer repair",
          text: reputation.trenchless_sewer_repair ?? "Camera evidence, pipe condition, access, branch connections, and the location of the failure determine whether trenchless preparation, lining support, targeted repair, or replacement fits the property.",
        },
        {
          title: "Minimal disruption",
          text: market ? `For ${market.city} properties, the work is planned around access, excavation, downtime, cleanup, and customer disruption.` : "The work is planned around access, excavation, downtime, cleanup, and customer disruption.",
        },
      ])}
      ${propertyTypes.length ? `<div class="chips">${propertyTypes.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
    </section>
  `;
}

function cityHubCoverageSection(business, market, services) {
  const serviceMap = new Map(services.map((service) => [service.slug, service]));
  const serviceCards = [
    {
      slug: "emergency-plumbing",
      title: "Emergency Plumbing",
      text: `24/7 emergency plumbing for burst pipes, active leaks, overflowing fixtures, sewer backups, and urgent repairs throughout ${market.city} and surrounding communities.`,
    },
    {
      slug: "drain-cleaning",
      title: "Drain Cleaning",
      text: "Drain cleaning for kitchen, bathroom, laundry, and main sewer line clogs, with the method chosen around the blockage, access, and pipe condition.",
    },
    {
      slug: "water-heater-repair-install",
      title: "Water Heater Services",
      text: "Repair, replacement, and installation for tank and tankless water heaters, including no-hot-water calls, leaking units, and new installations.",
    },
    {
      slug: "hydro-jetting",
      title: "Hydro Jetting",
      text: "Hydro jetting clears grease, roots, sludge, and heavy buildup when the pipe is in condition to be jetted safely.",
    },
    {
      slug: "sewer-line-repair",
      title: "Sewer Line Repair",
      text: "Camera inspections, trenchless repairs, CIPP pipe lining support, sewer line replacement, and reliable sewer solutions built to last.",
    },
  ];
  return `
    <section>
      <span class="section-kicker">Plumbing Services</span>
      <h2>Plumbing help for ${escapeHtml(market.city)} homes and businesses</h2>
      <p class="lede">Masterflow handles emergency plumbing, drain cleaning, water heaters, hydro jetting, sewer repair, leak detection, and commercial trenchless sewer work in ${escapeHtml(market.city)}.</p>
      ${cardGrid(
        serviceCards.map((card) => {
          const linkedService = serviceMap.get(card.slug);
          return {
            title: card.title,
            text: card.text,
            href: linkedService ? serviceHubUrl(business, linkedService) : cityHubUrl(business, market),
            linkText: "Learn More",
          };
        }),
      )}
    </section>
  `;
}

function cityHubIntroCopy(business, market) {
  const phone = business.phone_display ?? "951-612-7912";
  const serviceList = "emergency plumbing, drain cleaning, hydro jetting, sewer line repair, water heater services, leak detection, and trenchless sewer solutions";
  const exact = {
    perris: {
      eyebrow: "Perris Plumbing Services",
      headline: "Emergency Plumber in Perris, CA",
      paragraphs: [
        `Masterflow serves Perris homes, rentals, businesses, and managed properties for ${serviceList}. Calls come from neighborhoods such as ${sentenceJoin(market.neighborhoods.slice(0, 5))}.`,
        "Tell us which fixture or line is giving you trouble and whether water, sewage, gas odor, or no hot water is involved.",
      ],
      cta: `24/7 Emergency Service | Residential & Commercial | Call ${phone}`,
    },
    "moreno-valley": {
      eyebrow: "Moreno Valley Plumbing Services",
      headline: "Emergency Plumber in Moreno Valley, CA",
      paragraphs: [
        `Masterflow serves Moreno Valley homes, rentals, businesses, and managed properties, including ${sentenceJoin(market.neighborhoods.slice(0, 5))}.`,
        `Call for ${serviceList}. Tell us which fixture or line is giving you trouble and whether the problem is active.`,
      ],
      cta: `24/7 Emergency Service | Residential & Commercial | Call ${phone}`,
    },
    riverside: {
      eyebrow: "Serving Riverside & the Inland Empire",
      headline: "Emergency Plumber in Riverside, CA",
      paragraphs: [
        `Masterflow serves Riverside homes, rentals, businesses, HOAs, and managed properties, including ${sentenceJoin(market.neighborhoods.slice(0, 7))}.`,
        `Call for ${serviceList}. Tell us whether one fixture is affected, several drains are reacting together, water is active, or the property has prior plumbing or sewer work.`,
      ],
      cta: `Call ${phone} | View Services`,
    },
  };
  if (exact[market.slug]) return exact[market.slug];
  const communities = sentenceJoin(market.neighborhoods.slice(0, 5));
  return {
    eyebrow: `${market.city} Plumbing Services`,
    headline: `Emergency Plumber in ${market.city}, ${market.state}`,
    paragraphs: [
      `Masterflow serves ${market.city} homes, rentals, businesses, HOAs, and managed properties for ${serviceList}. Calls come from areas such as ${communities}.`,
      "Tell us which fixture or line is giving you trouble and whether water, sewage, gas odor, or no hot water is involved.",
    ],
    cta: `24/7 Emergency Service | Residential & Commercial | Call ${phone}`,
  };
}

function cityHubIntroSection(business, market) {
  const copy = cityHubIntroCopy(business, market);
  const phoneHref = `tel:${business.phone_display.replace(/\D/g, "")}`;
  return `
    <section id="local-proof" class="local-panel">
      <div>
        <span class="section-kicker">${escapeHtml(copy.eyebrow)}</span>
        <h2>${escapeHtml(copy.headline)}</h2>
        ${copy.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
        <p class="lede">${escapeHtml(copy.cta).replace(`Call ${escapeHtml(business.phone_display)}`, `<a href="${phoneHref}">Call ${escapeHtml(business.phone_display)}</a>`)}</p>
        ${marketCommunityLine(market)}
        <div class="chips">${[...market.neighborhoods, ...market.zips].map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
      </div>
      <div class="media-proof"><img src="${escapeHtml(business.media.proof)}" alt="Masterflow Plumbing field service proof" title="Masterflow Plumbing field service proof"></div>
    </section>
  `;
}

function cityHubScenarioSection(market) {
  const neighborhoods = sentenceJoin(market.neighborhoods.slice(0, 5));
  const nearby = sentenceJoin((market.nearby_slugs ?? []).slice(0, 4).map((slug) => slug.split("-").map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(" ")));
  return `
    <section>
      <span class="section-kicker">Local plumbing situations</span>
      <h2>Common ${escapeHtml(market.city)} plumbing calls Masterflow handles</h2>
      <p class="lede">Masterflow handles urgent leaks, drain backups, sewer failures, water-heater trouble, camera inspections, hydro jetting, and commercial plumbing across ${escapeHtml(market.city)} and nearby communities.</p>
      ${cardGrid([
        {
          title: "Homes, rentals, and older lines",
          text: `${market.city} calls can involve ${neighborhoods}, ZIPs ${market.zips.join(", ")}, older plumbing, tract-home layouts, rentals, remodels, and busy households where the same symptom can have more than one cause.`,
        },
        {
          title: "Restaurants, offices, salons, and retail",
          text: `Commercial calls need a different plan: keep restrooms usable when possible, manage drain and sewer access, protect customer areas, reduce after-hours disruption, and finish with cleanup the business can live with.`,
        },
        {
          title: "Nearby communities",
          text: `Masterflow also helps nearby service areas such as ${nearby || "Corona, Lake Elsinore, Riverside, and surrounding Southern California communities"} when the schedule, job type, and route make sense.`,
        },
        {
          title: "License, hours, and services",
          text: "Masterflow lists its direct phone number, 24/7 emergency service, California contractor license #1156577, drain and sewer equipment, hydro jetting, camera inspections, water-heater service, leak detection, and commercial plumbing.",
        },
      ])}
    </section>
  `;
}

function reviewStars(rating = 5) {
  const count = Math.max(1, Math.min(5, Number.parseInt(rating, 10) || 5));
  return "★★★★★".slice(0, count);
}

function reviewsPageBody({ business, reviews }) {
  const approvedReviews = reviews.filter((review) => review.consented === true);
  const reviewCards = approvedReviews.map((review) => `
          <article class="review-card">
            <div class="review-card-stars" aria-label="${escapeHtml(review.rating || 5)} out of 5 stars">${reviewStars(review.rating)}</div>
            <p>${escapeHtml(review.text)}</p>
            <strong>${escapeHtml(review.first_name)}</strong>
            <span>${escapeHtml(review.date ?? "Customer review")}</span>
          </article>`).join("");
  return `
    <section id="local-proof">
      <span class="section-kicker">Customer Reviews</span>
      <h2>Real Masterflow customer feedback</h2>
      <p class="lede">These are real customer review excerpts provided from Masterflow's Yelp review history. Customers mention response time, clear communication, fair pricing, emergency help, water heaters, leaks, drains, and clean work.</p>
      <div class="review-list">
${reviewCards}
      </div>
    </section>
    <section id="customer-submitted-reviews" hidden>
      <span class="section-kicker">Approved customer reviews</span>
      <h2>More feedback from Masterflow customers</h2>
      <div class="review-list" id="approvedReviewList"></div>
    </section>
    <section id="leave-review">
      <span class="section-kicker">Leave a Review</span>
      <h2>Share your Masterflow experience</h2>
      <p class="lede">Your review goes to Masterflow for verification first. It will not appear on the site unless you allow public display and the review is approved.</p>
      <form class="review-form site-form js-api-form" action="${business.primary_domain}/api/reviews" method="post" data-form-kind="review">
        <div class="form-grid">
          <label>
            Your name
            <input name="reviewerName" autocomplete="name" required minlength="2" maxlength="80">
          </label>
          <label>
            Email for verification
            <input name="reviewerEmail" type="email" autocomplete="email" required maxlength="160">
          </label>
          <label>
            Phone (optional)
            <input name="reviewerPhone" type="tel" autocomplete="tel" maxlength="40">
          </label>
          <label>
            Rating
            <select name="rating" required>
              <option value="5">5 stars</option>
              <option value="4">4 stars</option>
              <option value="3">3 stars</option>
              <option value="2">2 stars</option>
              <option value="1">1 star</option>
            </select>
          </label>
          <label class="form-wide">
            Your review
            <textarea name="reviewText" required minlength="20" maxlength="2000" rows="6"></textarea>
          </label>
        </div>
        <label class="check-row">
          <input type="checkbox" name="consentIpCollection" required>
          <span>I allow Masterflow to save my email, review, timestamp, internet address, and browser details for private verification and moderation.</span>
        </label>
        <label class="check-row">
          <input type="checkbox" name="consentDisplay">
          <span>Masterflow may display my name and review publicly after approval. My email, phone, and internet address stay private.</span>
        </label>
        <label class="form-trap" aria-hidden="true">
          Company website
          <input name="companyWebsite" tabindex="-1" autocomplete="off">
        </label>
        <input type="hidden" name="sourcePath" value="${escapeHtml(reviewsUrl(business))}">
        <button class="button primary" type="submit">Send Review</button>
        <p class="form-status" data-form-status aria-live="polite"></p>
      </form>
      <p class="lede">Prefer to use Yelp? <a href="${escapeHtml(yelpProfileUrl(business))}" target="_blank" rel="noopener">Open the Masterflow Yelp profile</a>.</p>
    </section>
  `;
}

function adminPageBody({ business }) {
  const commercial = isCommercialSite(business);
  const namespacePath = commercial ? "masterflow-plumbing/commercial/" : "masterflow-plumbing/";
  const siteLabel = commercial ? "commercial" : "residential";
  const homeHref = makeUrl(business.preview_prefix);
  const sitemapHref = makeUrl(business.preview_prefix, ["sitemap.xml"]).replace(/\/$/, "");
  return `
    <section>
      <span class="eyebrow">Website control plane</span>
      <h2>The domain stays canonical. The site payload stays under Valen control.</h2>
      <p>This record describes the ${siteLabel} Masterflow website surface. Visitors and search engines use <a href="${business.primary_domain}${homeHref}">${business.primary_domain.replace("https://", "")}${homeHref}</a>, while the page content is served from the Valen-controlled CDN namespace <strong>${namespacePath}</strong>. The customer domain does not store a second copy of the site.</p>
      <div class="admin-grid">
        <article class="admin-card">
          <h3>What Valen maintains</h3>
          <p>Valen Systems maintains the website source, generated routes, structured data, sitemap families, controlled CDN objects, release checks, and the proxy path that presents those files on the canonical Masterflow hostname.</p>
        </article>
        <article class="admin-card">
          <h3>What stays with Masterflow</h3>
          <p>Masterflow owns its customer-facing domain and plumbing operations. Service requests go to Masterflow at ${business.phone_display}; contractor identity remains tied to ${displayLicenseNo(business)}.</p>
        </article>
      </div>
    </section>
    <section>
      <span class="eyebrow">Published references</span>
      <h2>Inspect the live surface.</h2>
      <p>The sitemap XML is stored in Valen's controlled sitemap namespace and delivered through the canonical domain. Styling is a human-facing XSL presentation only; the underlying sitemap entries remain standard crawler-readable XML.</p>
      <div class="action-row">
        <a href="${homeHref}">Open Masterflow</a>
        <a href="${sitemapHref}">View sitemap index</a>
        <a href="${maintainer.url}" rel="author noopener">Visit ${maintainer.domain}</a>
      </div>
    </section>
  `;
}

function quickActionSection({ business }) {
  if (isCommercialSite(business)) {
    return `
      <section>
        <span class="section-kicker">Commercial service</span>
        <h2>Emergency call, planned work, or portfolio coverage?</h2>
        <p class="lede">Call for active damage or send the property details for scheduled work, maintenance, due diligence, and larger projects.</p>
        ${cardGrid([
          {
            title: "Active property emergency",
            text: `Call ${business.phone_display} for leaks, sewage backups, failed shutoffs, burst lines, loss of essential hot water, or a plumbing problem affecting tenants, customers, or operations.`,
            href: phoneHref(business),
            linkText: "Call commercial service",
          },
          {
            title: "Planned repair or maintenance",
            text: "Send the address, property type, scope, access window, affected fixtures or line, and any camera footage or prior repair history.",
            href: requestServiceUrl(business),
            linkText: "Request service",
          },
          {
            title: "Portfolio or regional coverage",
            text: `Masterflow serves commercial properties across the ${business.commercial_site?.corridor ?? "Southern California service corridor"}. Call to confirm the property and scope.`,
            href: serviceAreaIndexUrl(business),
            linkText: "View coverage",
          },
        ])}
      </section>
    `;
  }
  return `
    <section>
      <span class="section-kicker">Need help?</span>
      <h2>Need a plumber, a price, or a coverage check?</h2>
      <p class="lede">Call now for a leak, backup, burst pipe, gas odor, failed shutoff, or no hot water. For planned work, browse the services or check your city.</p>
      ${cardGrid([
        {
          title: "Call a plumber now",
          text: `Call ${business.phone_display} for active leaks, sewer backups, overflowing fixtures, burst pipes, no hot water, and urgent drain or plumbing service.`,
          href: phoneHref(business),
          linkText: "Call now",
        },
        {
          title: "Browse plumbing services",
          text: "See drain cleaning, sewer repair, leak detection, water-heater service, hydro jetting, repiping, fixture, gas-line, and commercial plumbing pages.",
          href: servicesIndexUrl(business),
          linkText: "See services",
        },
        {
          title: "Check your city",
          text: "See whether Masterflow serves Corona, Lake Elsinore, Riverside, Norco, Ontario, or another Southern California community.",
          href: serviceAreaIndexUrl(business),
          linkText: "See service areas",
        },
      ])}
    </section>
  `;
}

function serviceCatalogSection({ business, services }) {
  const copy = coreCopy(business);
  return `
    <section id="services">
      <span class="section-kicker">Plumbing services</span>
      <h2>${escapeHtml(copy.services.heading)}</h2>
      <p class="lede">${escapeHtml(copy.services.body)}</p>
      ${cardGrid(
        services.map((service) => {
          const copy = serviceCopy(service, business);
          return {
            title: copy.title,
            text: copy.hero,
            href: serviceHubUrl(business, service),
            linkText: "View service",
          };
        }),
      )}
    </section>
  `;
}

function serviceAreaDirectorySection({ business, markets, limit = 18 }) {
  const copy = coreCopy(business);
  if (isCommercialSite(business)) {
    return `
      <section id="service-area">
        <span class="section-kicker">Commercial coverage</span>
        <h2>${escapeHtml(copy.areas.heading)}</h2>
        <p class="lede">${escapeHtml(copy.areas.body)}</p>
        ${cardGrid((business.commercial_site?.regions ?? []).map((region) => ({
          title: region.title,
          text: region.text,
        })))}
        <p><a class="button text-button" href="${serviceAreaIndexUrl(business)}">View commercial coverage</a></p>
      </section>
    `;
  }
  const orderedMarkets = orderedMarketsForNavigation(business, markets);
  return `
    <section id="service-area">
      <span class="section-kicker">Areas we serve</span>
      <h2>${escapeHtml(copy.areas.heading)}</h2>
      <p class="lede">${escapeHtml(copy.areas.body)}</p>
      ${relatedList(
        orderedMarkets.slice(0, limit).map((market) => ({
          href: cityHubUrl(business, market),
          label: `${market.city}, ${market.state}`,
        })),
      )}
    </section>
  `;
}

function commercialIndustryDirectorySection({ business, limit = COMMERCIAL_INDUSTRIES.length }) {
  return `
    <section id="industries">
      <span class="section-kicker">Properties we serve</span>
      <h2>Commercial plumbing for the way the property actually operates</h2>
      <p class="lede">Choose the property type closest to the building, portfolio, or project.</p>
      ${cardGrid(COMMERCIAL_INDUSTRIES.slice(0, limit).map((industry) => ({
        title: industry.name,
        text: industry.description,
        href: industryUrl(business, industry),
        linkText: "View property service",
      })))}
    </section>
  `;
}

function commercialIndustriesIndexBody({ business, services }) {
  return `
    <section id="local-proof" class="local-panel">
      <div>
        <span class="section-kicker">Commercial properties</span>
        <h2>Plumbing service shaped around the building and the people using it</h2>
        <p>Masterflow works with property managers, facility teams, owners, investors, HOA managers, general contractors, and onsite staff across Southern California.</p>
        <p>The property type changes access, shutoffs, notice, cleanup, service windows, and the fixtures or operations that must stay available.</p>
        <div class="chips"><span>${escapeHtml(displayLicenseNo(business))}</span><span>24/7 emergency service</span><span>Same-day availability</span><span>Upfront pricing</span></div>
      </div>
      <div class="media-proof"><img src="${escapeHtml(mediaByFilename(business, "epoxy-sewer-liner-prep-commercial-2.jpg"))}" alt="Masterflow commercial sewer work" title="Masterflow commercial sewer work"></div>
    </section>
    ${commercialIndustryDirectorySection({ business })}
    ${serviceCatalogSection({ business, services })}
    ${serviceAreaDirectorySection({ business, markets: [] })}
    ${requestServicePanel({ business })}
  `;
}

function commercialIndustryBody({ business, industry, services }) {
  const related = COMMERCIAL_INDUSTRIES.filter((item) => item.slug !== industry.slug).slice(0, 5);
  return `
    <section id="local-proof" class="local-panel">
      <div>
        <span class="section-kicker">${escapeHtml(industry.name)}</span>
        <h2>${escapeHtml(industry.h1)}</h2>
        <p>${escapeHtml(industry.lede)}</p>
        <div class="chips"><span>${escapeHtml(displayLicenseNo(business))}</span><span>24/7 response</span><span>Same-day service available</span><span>Southern California coverage</span></div>
      </div>
      <div class="media-proof"><img src="${escapeHtml(mediaByFilename(business, "epoxy-sewer-liner-prep-commercial-3.jpg"))}" alt="Masterflow Plumbing commercial field work" title="Masterflow Plumbing commercial field work"></div>
    </section>
    <section>
      <span class="section-kicker">Property priorities</span>
      <h2>What matters on this kind of property</h2>
      ${cardGrid(industry.priorities.map(([title, text]) => ({ title, text })))}
    </section>
    ${serviceCatalogSection({ business, services })}
    <section>
      <span class="section-kicker">Other commercial properties</span>
      <h2>More Masterflow commercial work</h2>
      ${relatedList(related.map((item) => ({ href: industryUrl(business, item), label: item.name })))}
    </section>
    ${serviceAreaDirectorySection({ business, markets: [] })}
    ${requestServicePanel({ business })}
  `;
}

function commercialServiceAreaBody({ business, services }) {
  const copy = coreCopy(business).areas;
  return `
    <section id="local-proof" class="local-panel">
      <div>
        <span class="section-kicker">${escapeHtml(copy.eyebrow)}</span>
        <h2>${escapeHtml(copy.heading)}</h2>
        <p>${escapeHtml(copy.body)}</p>
        <p>For a new property, call with the address, property type, scope, access window, and timing. Masterflow will confirm whether the call fits emergency dispatch, scheduled service, or project planning.</p>
        <div class="chips"><span>Santa Barbara</span><span>Greater Los Angeles</span><span>Orange County</span><span>Inland Empire</span><span>San Diego</span></div>
      </div>
      <div class="media-proof"><img src="${escapeHtml(business.media.hero)}" alt="Masterflow Plumbing commercial service vehicle" title="Masterflow Plumbing commercial service vehicle"></div>
    </section>
    <section>
      <span class="section-kicker">Commercial service corridor</span>
      <h2>Regional coverage for operating properties and portfolios</h2>
      ${cardGrid((business.commercial_site?.regions ?? []).map((region) => ({
        title: region.title,
        text: region.text,
      })))}
    </section>
    <section>
      <span class="section-kicker">Before dispatch</span>
      <h2>What Masterflow needs from the property team</h2>
      ${cardGrid([
        {
          title: "Property and access",
          text: "Address, property type, onsite contact, gates, security, loading areas, keys, escorts, and the service window.",
        },
        {
          title: "Plumbing and impact",
          text: "Affected fixtures or line, active water or sewage, tenants or operations involved, shutoffs, cleanouts, and prior repair history.",
        },
        {
          title: "Approval and records",
          text: "The person authorized to approve work, camera footage, plans, proposals, invoices, and any requirements for photos or closeout documents.",
        },
      ])}
    </section>
    ${commercialIndustryDirectorySection({ business, limit: 6 })}
    ${serviceCatalogSection({ business, services })}
    ${requestServicePanel({ business })}
  `;
}

function commercialIndexBody({ business, markets, services }) {
  const copy = coreCopy(business).home;
  return `
    <section id="local-proof" class="local-panel">
      <div>
        <span class="section-kicker">Masterflow commercial plumbing</span>
        <h2>${escapeHtml(copy.intro.heading)}</h2>
        <p>${escapeHtml(copy.intro.body)}</p>
        <p>Emergency response, planned maintenance, drain and sewer work, hydro jetting, cameras, trenchless preparation, leaks, water heaters, repiping, fixtures, gas lines, and larger repairs all run through the same direct number.</p>
        <div class="chips"><span>${escapeHtml(displayLicenseNo(business))}</span><span>24/7 emergency service</span><span>Same-day service available</span><span>Upfront pricing</span><span>Financing available</span></div>
      </div>
      <div class="media-proof"><img src="${escapeHtml(mediaByFilename(business, "epoxy-sewer-liner-prep-commercial-1.jpg"))}" alt="Masterflow commercial sewer work" title="Masterflow commercial sewer work"></div>
    </section>
    ${quickActionSection({ business })}
    <section>
      <span class="section-kicker">One commercial call</span>
      <h2>Tell us what failed and what the property needs to keep running.</h2>
      <p class="lede">A useful first call covers the plumbing problem, the occupied areas, the access window, and who can approve work.</p>
      ${cardGrid([
        {
          title: "The plumbing problem",
          text: "Which fixtures, drains, lines, heaters, units, floors, or tenant spaces are affected? Is water, sewage, gas odor, or hot-water loss active?",
        },
        {
          title: "The property conditions",
          text: "Share operating hours, access, security, parking, customers, residents, equipment, cleanup requirements, and any area that must stay available.",
        },
        {
          title: "The approval path",
          text: "Name the onsite contact and the manager, owner, or project lead who can approve a repair if the inspection finds more damage.",
        },
      ])}
    </section>
    ${serviceCatalogSection({ business, services })}
    ${commercialIndustryDirectorySection({ business, limit: 6 })}
    ${commercialReputationSection(business, markets[0])}
    ${reviewProofBand({ business })}
    <section>
      <span class="section-kicker">Property risk</span>
      <h2>${escapeHtml(copy.consequences.heading)}</h2>
      <p class="lede">${escapeHtml(copy.consequences.body)}</p>
      ${cardGrid([
        {
          title: "Recurring drains and sewers",
          text: "Repeated clearing without camera evidence or a line history can hide roots, damage, poor transitions, heavy buildup, or a branch problem.",
        },
        {
          title: "Leaks across occupied space",
          text: "Water can move through slabs, walls, ceilings, cabinets, and neighboring tenant areas before the source is obvious.",
        },
        {
          title: "Hot water and building operations",
          text: "A failed commercial water heater or plumbing shutdown can affect residents, sanitation, kitchens, cleaning, staff, and customer service.",
        },
      ])}
    </section>
    ${serviceAreaDirectorySection({ business, markets })}
    <section>
      <span class="section-kicker">Commercial resources</span>
      <h2>Guides for property and facility teams</h2>
      <p class="lede">Read about maintenance plans, recurring lines, downtime, due diligence, after-hours work, and larger sewer projects.</p>
      ${cardGrid(COMMERCIAL_BLOG_POSTS.slice(0, 3).map((post) => ({
        title: post.title,
        text: post.description,
        href: blogPostUrl(business, post),
        linkText: "Read guide",
      })))}
      <p><a class="button text-button" href="${blogUrl(business)}">View commercial guides</a></p>
    </section>
    ${requestServicePanel({ business })}
  `;
}

function requestServicePanel({ business, market = null, service = null }) {
  const serviceLabel = service ? serviceSeoName(service).toLowerCase() : "plumbing";
  const place = market ? `${market.city} ` : "";
  if (isCommercialSite(business)) {
    return `
      <section class="request-panel">
        <div>
          <span class="section-kicker">Commercial service</span>
          <h2>Call Masterflow about the property.</h2>
          <p class="lede">For ${escapeHtml(place)}${escapeHtml(serviceLabel)}, call ${escapeHtml(business.phone_display)}. Share the address, property type, affected line or fixtures, operating impact, access window, and the person authorized to approve work.</p>
        </div>
        <div class="request-card">
          <strong>Have these details ready</strong>
          <ul>
            <li>Property address and onsite contact</li>
            <li>Property type, affected tenants, units, fixtures, or operations</li>
            <li>Whether water, sewage, gas odor, or hot-water loss is active</li>
            <li>Access instructions, service window, camera footage, and prior repair records</li>
          </ul>
          <p class="button-row">
            <a class="button primary" href="${phoneHref(business)}">Call ${escapeHtml(business.phone_display)}</a>
            <a class="button secondary" href="${requestServiceUrl(business)}">Request Commercial Service</a>
          </p>
        </div>
      </section>
    `;
  }
  return `
    <section class="request-panel">
      <div>
        <span class="section-kicker">Request service</span>
        <h2>Call Masterflow for plumbing service.</h2>
        <p class="lede">For ${escapeHtml(place)}${escapeHtml(serviceLabel)}, call ${escapeHtml(business.phone_display)}. Tell us which fixture or line is affected and whether water or sewage is moving. Photos and access to the shutoff or cleanout can help.</p>
      </div>
      <div class="request-card">
        <strong>A few details help</strong>
        <ul>
          <li>City or nearest cross streets</li>
          <li>Fixture, line, heater, valve, or drain affected</li>
          <li>Whether water, sewage, gas odor, or no hot water is active</li>
          <li>Photos, cleanout access, shutoff access, and prior repair history if available</li>
        </ul>
        <p class="button-row">
          <a class="button primary" href="${phoneHref(business)}">Call ${escapeHtml(business.phone_display)}</a>
          <a class="button secondary" href="${requestServiceUrl(business)}">Send a Request</a>
        </p>
      </div>
    </section>
  `;
}

function requestServiceForm({ business, services }) {
  const commercialFields = isCommercialSite(business) ? `
          <label>
            Company or property
            <input name="companyName" autocomplete="organization" required minlength="2" maxlength="120">
          </label>
          <label>
            Property type
            <select name="propertyType" required>
              <option value="">Choose a property type</option>
              <option value="Multifamily or apartments">Multifamily or apartments</option>
              <option value="Retail or restaurant">Retail or restaurant</option>
              <option value="Office or industrial">Office or industrial</option>
              <option value="HOA or managed community">HOA or managed community</option>
              <option value="Commercial portfolio">Commercial portfolio</option>
              <option value="Construction or due diligence">Construction or due diligence</option>
              <option value="Other commercial property">Other commercial property</option>
            </select>
          </label>
          <label>
            Access or service window
            <input name="accessWindow" maxlength="160" placeholder="For example: after 8 PM, check in with security">
          </label>` : "";
  const heading = isCommercialSite(business)
    ? "Send the commercial property details."
    : "Tell us where you need a plumber.";
  const intro = isCommercialSite(business)
    ? `Send the address, property type, access window, operating impact, and known scope. For active water, sewage, gas odor, a failed shutoff, or loss of essential hot water, call <a href="${phoneHref(business)}">${escapeHtml(business.phone_display)}</a> now.`
    : `Send the details below and Masterflow will follow up. If water or sewage is spreading, you smell gas, or a shutoff has failed, call <a href="${phoneHref(business)}">${escapeHtml(business.phone_display)}</a> now.`;
  return `
    <section id="request-service">
      <span class="section-kicker">Request service</span>
      <h2>${heading}</h2>
      <p class="lede">${intro}</p>
      <form class="service-request-form site-form js-api-form" action="${business.primary_domain}/api/request-service" method="post" data-form-kind="request">
        <div class="form-grid">
          <label>
            Your name
            <input name="customerName" autocomplete="name" required minlength="2" maxlength="80">
          </label>
          <label>
            Phone
            <input name="phone" type="tel" autocomplete="tel" required maxlength="40">
          </label>
          <label>
            Email (optional)
            <input name="email" type="email" autocomplete="email" maxlength="160">
          </label>
          <label>
            City or nearest cross streets
            <input name="serviceLocation" autocomplete="address-level2" required maxlength="160">
          </label>
          ${commercialFields}
          <label>
            What do you need help with?
            <select name="serviceNeeded" required>
              <option value="">Choose a service</option>
              ${services.map((service) => `<option value="${escapeHtml(serviceSeoName(service))}">${escapeHtml(serviceSeoName(service))}</option>`).join("")}
              <option value="Not sure">Not sure</option>
            </select>
          </label>
          <label>
            How soon do you need service?
            <select name="urgency" required>
              <option value="Emergency - call now">Emergency - call now</option>
              <option value="Today if available">Today if available</option>
              <option value="Next available appointment" selected>Next available appointment</option>
              <option value="Planning or estimate">Planning or estimate</option>
            </select>
          </label>
          <label>
            Best way to reach you
            <select name="preferredContact" required>
              <option value="Phone">Phone call</option>
              <option value="Text">Text message</option>
              <option value="Email">Email</option>
            </select>
          </label>
          <label class="form-wide">
            What is going on?
            <textarea name="details" required minlength="10" maxlength="2500" rows="6" placeholder="Tell us which fixture, drain, pipe, or heater is affected and whether water or sewage is active."></textarea>
          </label>
        </div>
        <label class="check-row">
          <input type="checkbox" name="consentContact" required>
          <span>Masterflow may contact me about this service request by phone, text, or email.</span>
        </label>
        <label class="form-trap" aria-hidden="true">
          Company website
          <input name="companyWebsite" tabindex="-1" autocomplete="off">
        </label>
        <input type="hidden" name="sourcePath" value="${escapeHtml(contactUrl(business))}">
        <input type="hidden" name="siteVariant" value="${isCommercialSite(business) ? "commercial" : "residential"}">
        <button class="button primary" type="submit">Send Request</button>
        <p class="form-status" data-form-status aria-live="polite"></p>
      </form>
    </section>
  `;
}

function reviewProofBand({ business }) {
  return `
    <section>
      <span class="section-kicker">Proof</span>
      <h2>Check Masterflow's license and reviews.</h2>
      <p class="lede">You can verify the California contractor license, read customer reviews, see emergency and same-day availability, and call the phone number shown across the site.</p>
      ${cardGrid([
        {
          title: "Customer feedback",
          text: "Read approved customer excerpts or open the Masterflow Yelp profile.",
          href: reviewsUrl(business),
          linkText: "Read reviews",
        },
        {
          title: displayLicenseNo(business),
          text: "Use the listed California contractor license to verify Masterflow before booking.",
        },
        {
          title: "24/7 emergency response",
          text: `Call ${business.phone_display} anytime for active leaks, sewage backups, failed shutoffs, burst pipes, or no hot water.`,
        },
        {
          title: "Same-day service and financing",
          text: "Same-day service is available. Ask about financing when you call.",
        },
      ])}
    </section>
  `;
}

function aboutPageBody({ business, markets, services }) {
  const copy = coreCopy(business).about;
  if (isCommercialSite(business)) {
    return `
      <section id="local-proof" class="local-panel">
        <div>
          <span class="section-kicker">${escapeHtml(copy.eyebrow)}</span>
          <h2>${escapeHtml(copy.heading)}</h2>
          ${copy.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
          <div class="chips"><span>${escapeHtml(displayLicenseNo(business))}</span><span>24/7 emergency service</span><span>${escapeHtml(business.commercial_site?.corridor ?? "Southern California")}</span></div>
        </div>
        <div class="media-proof"><img src="${escapeHtml(mediaByFilename(business, "dan-cutter-sewer-liner-reinstatement-2.jpg"))}" alt="Masterflow commercial sewer equipment" title="Masterflow commercial sewer equipment"></div>
      </section>
      ${quickActionSection({ business })}
      ${licenseTrustSection(business)}
      ${commercialReputationSection(business, markets[0])}
      ${commercialIndustryDirectorySection({ business, limit: 6 })}
      ${serviceCatalogSection({ business, services })}
      ${serviceAreaDirectorySection({ business, markets })}
      ${requestServicePanel({ business })}
    `;
  }
  return `
    <section id="local-proof" class="local-panel">
      <div>
        <span class="section-kicker">${escapeHtml(copy.eyebrow)}</span>
        <h2>${escapeHtml(copy.heading)}</h2>
        ${copy.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
        <div class="chips"><span>${escapeHtml(displayLicenseNo(business))}</span><span>24/7 emergency service</span><span>Residential and commercial</span></div>
      </div>
      <div class="media-proof"><img src="${escapeHtml(business.media.proof)}" alt="Masterflow Plumbing field service proof" title="Masterflow Plumbing field service proof"></div>
    </section>
    ${quickActionSection({ business })}
    ${licenseTrustSection(business)}
    ${commercialReputationSection(business, markets[0])}
    ${serviceCatalogSection({ business, services })}
    ${serviceAreaDirectorySection({ business, markets, limit: 12 })}
    ${requestServicePanel({ business })}
  `;
}

function servicesIndexBody({ business, markets, services }) {
  const emergencyService = services.find((service) => service.slug === "emergency-plumbing") ?? services[0];
  const copy = coreCopy(business).services;
  if (isCommercialSite(business)) {
    return `
      <section id="local-proof" class="local-panel">
        <div>
          <span class="section-kicker">${escapeHtml(copy.eyebrow)}</span>
          <h2>${escapeHtml(copy.heading)}</h2>
          <p>${escapeHtml(copy.body)}</p>
          <p>Use the service pages to compare warning signs, inspection points, access needs, and the records that help a manager plan the work.</p>
          <div class="chips"><span>24/7 emergency response</span><span>Drain and sewer</span><span>Building plumbing</span><span>Capital projects</span></div>
        </div>
        <div class="media-proof"><img src="${escapeHtml(pageMediaForService(business, markets[0], emergencyService))}" alt="Masterflow commercial plumbing equipment" title="Masterflow commercial plumbing equipment"></div>
      </section>
      ${quickActionSection({ business })}
      ${serviceCatalogSection({ business, services })}
      <section>
        <span class="section-kicker">Commercial call details</span>
        <h2>The property details matter as much as the fixture.</h2>
        ${cardGrid([
          {
            title: "Scope",
            text: "Affected fixtures or line, active water or sewage, service history, camera footage, shutoffs, cleanouts, and known damage.",
          },
          {
            title: "Operations",
            text: "Tenants, customers, units, restrooms, kitchens, equipment, opening hours, security, traffic, and any area that must stay available.",
          },
          {
            title: "Approval",
            text: "Onsite contact, decision-maker, proposal requirements, not-to-exceed limits, photos, closeout documents, and invoicing details.",
          },
        ])}
      </section>
      ${commercialIndustryDirectorySection({ business, limit: 6 })}
      ${commercialReputationSection(business, markets[0])}
      ${reviewProofBand({ business })}
      ${serviceAreaDirectorySection({ business, markets })}
      ${requestServicePanel({ business })}
    `;
  }
  return `
    <section id="local-proof" class="local-panel">
      <div>
        <span class="section-kicker">${escapeHtml(copy.eyebrow)}</span>
        <h2>${escapeHtml(copy.heading)}</h2>
        <p>${escapeHtml(copy.body)}</p>
        <p>Emergency plumbing, drain cleaning, hydro jetting, water heaters, sewer lines, leaks, repiping, gas lines, and fixture work each have a dedicated page with a direct call path.</p>
        <div class="chips"><span>Drain and sewer</span><span>Leak and water heater</span><span>Commercial support</span><span>Emergency response</span></div>
      </div>
      <div class="media-proof"><img src="${escapeHtml(pageMediaForService(business, markets[0], emergencyService))}" alt="Masterflow Plumbing service vehicle and equipment proof" title="Masterflow Plumbing service vehicle and equipment proof"></div>
    </section>
    ${quickActionSection({ business })}
    ${serviceCatalogSection({ business, services })}
    <section>
      <span class="section-kicker">Not sure what to book?</span>
      <h2>Tell us where it is leaking, clogged, or backing up.</h2>
      <p class="lede">You do not need the name of the repair. Tell us which fixture, drain, pipe, or heater is giving you trouble.</p>
      ${cardGrid([
        {
          title: "Call for urgent service",
          text: "Say whether water or sewage is moving, you smell gas, the hot water is out, or a shutoff will not close.",
        },
        {
          title: "We inspect the plumbing",
          text: "We check the fixture or line, valves, cleanouts, access, pipe condition, and signs of a larger plumbing issue.",
        },
        {
          title: "You see the price first",
          text: "We give you upfront pricing before work starts. Financing is available, and Masterflow stands behind its work.",
        },
      ])}
    </section>
    ${commercialReputationSection(business, markets[0])}
    ${reviewProofBand({ business })}
    ${serviceAreaDirectorySection({ business, markets, limit: 12 })}
    ${requestServicePanel({ business })}
  `;
}

function serviceAreaIndexBody({ business, markets, services }) {
  if (isCommercialSite(business)) return commercialServiceAreaBody({ business, services });
  const orderedMarkets = orderedMarketsForNavigation(business, markets);
  const primaryMarkets = orderedMarkets.slice(0, 10);
  const remainingMarkets = orderedMarkets.slice(10);
  const copy = coreCopy(business).areas;
  return `
    <section id="local-proof" class="local-panel">
      <div>
        <span class="section-kicker">${escapeHtml(copy.eyebrow)}</span>
        <h2>${escapeHtml(copy.heading)}</h2>
        <p>${escapeHtml(copy.body)}</p>
        <p>Corona, Lake Elsinore, Norco, Riverside, Ontario, Calabasas, San Fernando Valley, Studio City, Glendale, and Pasadena are among the priority communities listed below.</p>
        <div class="chips"><span>${markets.length} city pages</span><span>${services.length} plumbing services</span><span>${escapeHtml(displayLicenseNo(business))}</span></div>
      </div>
      <div class="media-proof"><img src="${escapeHtml(business.media.hero)}" alt="Masterflow Plumbing company van" title="Masterflow Plumbing company van"></div>
    </section>
    ${quickActionSection({ business })}
    <section>
      <span class="section-kicker">Priority markets</span>
      <h2>High-priority service areas</h2>
      ${cardGrid(
        primaryMarkets.map((market) => ({
          title: `${market.city}, ${market.state}`,
          text: `Masterflow provides emergency plumbing, drain cleaning, sewer repair, leak detection, and water-heater service in ${market.city} neighborhoods including ${sentenceJoin(market.neighborhoods.slice(0, 4))}.`,
          href: cityHubUrl(business, market),
          linkText: "Open city",
        })),
      )}
    </section>
    <section>
      <span class="section-kicker">More coverage</span>
      <h2>More communities served by Masterflow</h2>
      <p class="lede">Choose a city below to see the same verified phone number, license, reviews, and plumbing service links.</p>
      ${relatedList(
        remainingMarkets.map((market) => ({
          href: cityHubUrl(business, market),
          label: `${market.city} plumber`,
        })),
      )}
    </section>
    ${serviceCatalogSection({ business, services })}
    ${reviewProofBand({ business })}
    ${requestServicePanel({ business })}
  `;
}

function contactPageBody({ business, markets, services }) {
  const copy = coreCopy(business).contact;
  if (isCommercialSite(business)) {
    return `
      <section id="local-proof" class="local-panel">
        <div>
          <span class="section-kicker">${escapeHtml(copy.eyebrow)}</span>
          <h2>${escapeHtml(copy.heading)}</h2>
          <p>${escapeHtml(copy.body)}</p>
          <p>For a portfolio, planned project, due-diligence inspection, or recurring property issue, include the best manager or facility contact and any existing records.</p>
          <div class="chips"><span>Phone ${escapeHtml(business.phone_display)}</span><span>${escapeHtml(displayLicenseNo(business))}</span><span>${escapeHtml(business.commercial_site?.corridor ?? "Southern California")}</span></div>
        </div>
        <div class="media-proof"><img src="${escapeHtml(business.media.hero)}" alt="Masterflow Plumbing commercial service vehicle" title="Masterflow Plumbing commercial service vehicle"></div>
      </section>
      ${requestServiceForm({ business, services })}
      ${quickActionSection({ business })}
      ${commercialIndustryDirectorySection({ business, limit: 6 })}
      ${reviewProofBand({ business })}
      ${serviceAreaDirectorySection({ business, markets })}
    `;
  }
  return `
    <section id="local-proof" class="local-panel">
      <div>
        <span class="section-kicker">${escapeHtml(copy.eyebrow)}</span>
        <h2>${escapeHtml(copy.heading)}</h2>
        <p>${escapeHtml(copy.body)}</p>
        <p>Use the service pages when you are still comparing the symptom, or check the areas page when the address is the main question.</p>
        <div class="chips"><span>Phone ${escapeHtml(business.phone_display)}</span><span>${escapeHtml(displayLicenseNo(business))}</span><span>Corona-centered service area</span></div>
      </div>
      <div class="media-proof"><img src="${escapeHtml(business.media.hero)}" alt="Masterflow Plumbing company van" title="Masterflow Plumbing company van"></div>
    </section>
    ${requestServiceForm({ business, services })}
    <section>
      <span class="section-kicker">Contact Masterflow</span>
      <h2>Call now or find the service you need.</h2>
      ${cardGrid([
        {
          title: "Urgent call",
          text: `Call ${business.phone_display} if there is active water, sewage backup, gas odor, no hot water, a burst line, an overflowing fixture, or a commercial plumbing issue that could affect operations.`,
          href: phoneHref(business),
          linkText: "Call now",
        },
        {
          title: "Browse services",
          text: "See drain cleaning, sewer repair, leak detection, water-heater work, hydro jetting, repiping, gas-line service, fixtures, and commercial plumbing.",
          href: servicesIndexUrl(business),
          linkText: "View services",
        },
        {
          title: "Check your city",
          text: "Open the areas page to see whether Masterflow serves your Southern California community.",
          href: serviceAreaIndexUrl(business),
          linkText: "Check area",
        },
      ])}
    </section>
    ${reviewProofBand({ business })}
    ${serviceCatalogSection({ business, services })}
    ${serviceAreaDirectorySection({ business, markets, limit: 12 })}
  `;
}

function cityServiceBody({ business, market, service, marketMap, services, faqs, reviews }) {
  const near = nearbyMarkets(market, marketMap);
  const citySignals = market.local_signals.map((signal) => customerFacingSignal(signal).toLowerCase());
  const selectedFaqs = applyFaqTokens(faqs, market, service);
  const media = pageMediaForService(business, market, service);
  const mediaAlt = mediaAltText(media, service);
  const sewerPhotos = service.slug === "sewer-line-repair" ? sewerLinePhotoSection(business) : "";
  const cityServiceCards = [
    {
      title: `${market.city} homes and businesses`,
      text: `${service.name} calls in ${market.city} often involve ${sentenceJoin(citySignals)}. Masterflow checks access, water or drain behavior, and pipe condition before recommending a repair.`,
    },
    {
      title: `${market.zip_primary} and nearby ZIPs`,
      text: `Masterflow serves ZIPs ${market.zips.join(", ")} with special attention to neighborhoods such as ${sentenceJoin(market.neighborhoods.slice(0, 4))}.`,
    },
    {
      title: "Licensed California plumbing",
      text: `${displayLicenseNo(business)} and direct phone ${business.phone_display} stay visible so customers can verify Masterflow before they book.`,
    },
  ];
  if (service.slug === "sewer-line-repair") {
    cityServiceCards.splice(2, 0, {
      title: "Epoxy liner prep and tie-ins",
      text: "For trenchless sewer liner work, Masterflow can prep the line, support epoxy liner installation, then use a robotic cutter to reopen branch tie-ins after the liner cures.",
    });
    cityServiceCards.splice(3, 0, {
      title: "Commercial repairs and installs",
      text: "Masterflow handles commercial sewer repairs, replacements, and installs for properties where downtime, access control, cleanup, and minimal intrusion matter.",
    });
  }
  return `
    <section id="local-proof" class="local-panel">
      <div>
        <span class="section-kicker">Areas we serve</span>
        <h2>${escapeHtml(serviceSeoName(service))} for ${escapeHtml(market.city)} homes and businesses</h2>
        <p>${escapeHtml(service.long_desc)}</p>
        <p>In ${escapeHtml(market.city)}, calls can involve ${escapeHtml(sentenceJoin(citySignals))}. Masterflow checks the property type, fixture or line, cleanout and shutoff access, plumbing age, and urgency before recommending a repair.</p>
        ${marketCommunityLine(market)}
        <div class="chips">
          ${market.neighborhoods.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          ${market.zips.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
        </div>
      </div>
      <div class="media-proof"><img src="${escapeHtml(media)}" alt="${escapeHtml(mediaAlt)}" title="${escapeHtml(mediaTitle(media, service))}"></div>
    </section>
    ${serviceCallPreparationSection(market, service)}
    <section>
      <span class="section-kicker">Service detail</span>
      <h2>What the plumber checks for ${escapeHtml(service.name.toLowerCase())} in ${escapeHtml(market.city)}</h2>
      <p class="lede">${escapeHtml(service.short_desc)} Masterflow checks the fixture or line, access, pipe condition, and damage before recommending a repair.</p>
      ${cardGrid(cityServiceCards)}
    </section>
    <section>
      <span class="section-kicker">Repair depth</span>
      <h2>Common ${escapeHtml(service.name.toLowerCase())} calls in ${escapeHtml(market.city)}</h2>
      <p class="lede">See the warning signs, equipment, access needs, and repair choices that commonly come up with this service.</p>
      ${cardGrid(serviceDepthCards(market, service))}
    </section>
    ${commercialReputationSection(business, market, service)}
    ${sewerPhotos}
    <section>
      <span class="section-kicker">Urgency signals</span>
      <h2>When to call about ${escapeHtml(service.name.toLowerCase())} in ${escapeHtml(market.city)}</h2>
      <p class="lede">Call right away for active water, sewage, gas odor, a failed shutoff, a burst pipe, or damage that is spreading.</p>
      ${cardGrid(emergencySignalCards(market, service))}
    </section>
    ${customerProofSection(business, market, service)}
    ${serviceAreaSummarySection(business, market, service)}
    <section>
      <span class="section-kicker">Your service call</span>
      <h2>What to expect from Masterflow</h2>
      <p class="lede">Tell us what is leaking, clogged, backed up, or not working. After the inspection, the plumber will explain the repair and price.</p>
      ${processGrid(market, service)}
    </section>
    ${estimateSection(business, market, service)}
    ${promotedRootLinkSection(cityServiceUrl(business, market, service))}
    <section>
      <span class="section-kicker">Nearby options</span>
      <h2>Related Masterflow pages</h2>
      ${relatedList([
        ...near.slice(0, 4).map((item) => ({
          href: cityServiceUrl(business, item, service),
          label: `${serviceSeoName(service)} in ${item.city}`,
        })),
        ...services
          .filter((item) => item.slug !== service.slug)
          .slice(0, 4)
          .map((item) => ({
            href: cityServiceUrl(business, market, item),
            label: `${item.name} in ${market.city}`,
          })),
      ])}
    </section>
    <section>
      <span class="section-kicker">FAQ</span>
      <h2>Questions about ${escapeHtml(service.name.toLowerCase())} in ${escapeHtml(market.city)}</h2>
      ${faqDetails(selectedFaqs)}
    </section>
  `;
}

function cityHubBody({ business, market, marketMap, services }) {
  const near = nearbyMarkets(market, marketMap);
  return `
    ${cityHubIntroSection(business, market)}
    ${serviceAreaSummarySection(business, market)}
    ${licenseTrustSection(business, market)}
    ${cityHubCoverageSection(business, market, services)}
    <section>
      <span class="section-kicker">Calling Masterflow</span>
      <h2>Need a plumber in ${escapeHtml(market.city)}?</h2>
      <p class="lede">Tell us where the trouble is and whether water, sewage, gas odor, or no hot water is involved.</p>
      ${cardGrid([
        {
          title: "Tell us where the trouble is",
          text: `Say which fixture or line is affected, whether water or sewage is moving, and whether the ${market.city} property is a home, rental, restaurant, office, salon, or another business.`,
        },
        {
          title: "The plumber checks it",
          text: "The plumber inspects the affected plumbing, explains the repair, and gives you the price before starting.",
        },
        {
          title: "Residential and commercial work",
          text: `Masterflow handles home plumbing calls, rental-property issues, restaurants, retail spaces, offices, salons, HOAs, and commercial sewer work.`,
        },
      ])}
    </section>
    <section>
      <span class="section-kicker">Services in ${escapeHtml(market.city)}</span>
      <h2>Plumbing services in ${escapeHtml(market.city)}</h2>
      ${cardGrid(
        services.map((service) => ({
          title: service.name,
          text: service.short_desc,
          href: serviceHubUrl(business, service),
          linkText: "View service",
        })),
      )}
    </section>
    ${commercialReputationSection(business, market)}
    ${estimateSection(business, market)}
    ${cityHubScenarioSection(market)}
    <section>
      <span class="section-kicker">Nearby service areas</span>
      <h2>Nearby areas we serve</h2>
      ${relatedList(near.map((item) => ({ href: cityHubUrl(business, item), label: `${item.city} plumber` })))}
    </section>
  `;
}

function serviceHubBody({ business, service, markets, posts = blogPostsFor(business) }) {
  const priorityMarkets = markets.slice(0, 12);
  const copy = serviceCopy(service, business);
  const media = pageMediaForService(business, markets[0], service);
  if (isCommercialSite(business)) {
    return `
      <section id="local-proof" class="local-panel">
        <div>
          <span class="section-kicker">${escapeHtml(copy.eyebrow)}</span>
          <h2>${escapeHtml(copy.title)} for occupied and managed properties</h2>
          <p>${escapeHtml(copy.intro)}</p>
          <p>Call ${escapeHtml(business.phone_display)} for an active property emergency or send the site details for scheduled work and project planning.</p>
        </div>
        <div class="media-proof"><img src="${escapeHtml(media)}" alt="${escapeHtml(mediaAltText(media, service))}" title="${escapeHtml(mediaTitle(media, service))}"></div>
      </section>
      <section>
        <span class="section-kicker">Common warning signs</span>
        <h2>What property teams usually notice first</h2>
        ${cardGrid(copy.signs.map(([title, text]) => ({ title, text })))}
      </section>
      <section>
        <span class="section-kicker">Service planning</span>
        <h2>What the plumber reviews before work begins</h2>
        ${cardGrid([
          { title: "Inspection", text: copy.checks },
          { title: "Possible work", text: copy.options },
          { title: "Property preparation", text: copy.prepare },
        ])}
      </section>
      ${commercialIndustryDirectorySection({ business, limit: 6 })}
      ${serviceAreaDirectorySection({ business, markets })}
      <section>
        <span class="section-kicker">Commercial guides</span>
        <h2>Read about this work before the call</h2>
        ${relatedList(posts
          .filter((post) => post.serviceSlug === service.slug)
          .slice(0, 8)
          .map((post) => ({ href: blogPostUrl(business, post), label: post.title })))}
      </section>
      ${commercialReputationSection(business, markets[0], service)}
      ${estimateSection(business, null, service)}
      ${requestServicePanel({ business, service })}
    `;
  }
  return `
    <section id="local-proof" class="local-panel">
      <div>
        <span class="section-kicker">${escapeHtml(copy.eyebrow)}</span>
        <h2>${escapeHtml(copy.title)} across Corona and nearby Southern California communities</h2>
        <p>${escapeHtml(copy.intro)}</p>
        <p>Call ${escapeHtml(business.phone_display)} for active water, sewage, gas odor, a failed shutoff, a burst pipe, or damage that is spreading.</p>
      </div>
      <div class="media-proof"><img src="${escapeHtml(media)}" alt="${escapeHtml(mediaAltText(media, service))}" title="${escapeHtml(mediaTitle(media, service))}"></div>
    </section>
    ${licenseTrustSection(business)}
    <section>
      <span class="section-kicker">Common warning signs</span>
      <h2>What customers usually notice first</h2>
      ${cardGrid(copy.signs.map(([title, text]) => ({ title, text })))}
    </section>
    <section>
      <span class="section-kicker">What the plumber checks</span>
      <h2>What the plumber will inspect</h2>
      ${cardGrid([
        { title: "Inspection", text: copy.checks },
        { title: "Possible repairs", text: copy.options },
        { title: "Before the visit", text: copy.prepare },
      ])}
    </section>
    <section>
      <span class="section-kicker">Areas we serve</span>
      <h2>Check Masterflow coverage by city</h2>
      ${cardGrid(
        priorityMarkets.map((market) => ({
          title: `${market.city}, ${market.state}`,
          text: `Check coverage for ${market.city} neighborhoods including ${sentenceJoin(market.neighborhoods.slice(0, 3))}.`,
          href: cityHubUrl(business, market),
          linkText: `View ${market.city}`,
        })),
      )}
      ${relatedList(
        markets.slice(12).map((market) => ({
          href: cityHubUrl(business, market),
          label: `${market.city}, ${market.state}`,
        })),
      )}
    </section>
    <section>
      <span class="section-kicker">Related plumbing guides</span>
      <h2>Read about this plumbing problem</h2>
      ${relatedList(posts
        .filter((post) => post.serviceSlug === service.slug)
        .slice(0, 8)
        .map((post) => ({ href: blogPostUrl(business, post), label: post.title })))}
    </section>
    ${commercialReputationSection(business, markets[0], service)}
    ${estimateSection(business, null, service)}
    ${requestServicePanel({ business, service })}
  `;
}

function indexBody({ business, markets, services }) {
  if (isCommercialSite(business)) {
    return commercialIndexBody({ business, markets, services });
  }
  const copy = coreCopy(business).home;
  return `
    <section id="local-proof" class="local-panel">
      <div>
        <span class="section-kicker">Masterflow Plumbing</span>
        <h2>${escapeHtml(copy.intro.heading)}</h2>
        <p>${escapeHtml(copy.intro.body)}</p>
        <p>Masterflow handles emergency plumbing, drains, sewer lines, leaks, water heaters, fixtures, gas lines, repiping, and commercial work.</p>
        <div class="chips"><span>${escapeHtml(displayLicenseNo(business))}</span><span>24/7 emergency service</span><span>Same-day service available</span><span>Financing available</span></div>
      </div>
      <div class="media-proof"><img src="${escapeHtml(business.media.hero)}" alt="Masterflow Plumbing truck proof" title="Masterflow Plumbing truck proof"></div>
    </section>
    ${quickActionSection({ business })}
    <section>
      <span class="section-kicker">Calling Masterflow</span>
      <h2>Tell us where the trouble is.</h2>
      <p class="lede">Say which fixture or line is affected and whether water, sewage, gas odor, or no hot water is involved.</p>
      ${cardGrid([
        {
          title: "Where is it?",
          text: `Call ${business.phone_display} and tell us which drain, fixture, pipe, heater, wall, floor, yard, or sewer line is giving you trouble.`,
        },
        {
          title: "We inspect the plumbing",
          text: "We check the affected plumbing, shutoffs, access, water or drain behavior, prior repairs, and signs of a larger issue.",
        },
        {
          title: "You see the price first",
          text: "We give you upfront pricing before work starts. Financing is available, and Masterflow stands behind its work.",
        },
      ])}
    </section>
    ${serviceCatalogSection({ business, services })}
    ${commercialReputationSection(business, markets[0])}
    ${reviewProofBand({ business })}
    <section>
      <span class="section-kicker">What waiting can cost</span>
      <h2>${escapeHtml(copy.consequences.heading)}</h2>
      <p class="lede">${escapeHtml(copy.consequences.body)}</p>
      ${cardGrid([
        {
          title: "Drain and sewer repeats",
          text: "A repeating clog can point to buildup, roots, poor slope, access trouble, or sewer damage. Cleaning, camera inspection, hydro jetting, or repair may be needed.",
        },
        {
          title: "Leaks and slab symptoms",
          text: "Moisture, pressure changes, warm floors, meter movement, and water stains can spread damage before the source is obvious.",
        },
        {
          title: "Commercial disruption",
          text: "Restaurants, offices, salons, retail centers, HOAs, apartments, and industrial properties need plumbing help that respects access, cleanup, tenants, customers, and downtime.",
        },
      ])}
    </section>
    ${serviceAreaDirectorySection({ business, markets })}
    <section>
      <span class="section-kicker">Plumbing guides</span>
      <h2>Plumbing advice from Masterflow</h2>
      <p class="lede">Read about clogs, sewer trouble, leaks, water heaters, repiping, emergency plumbing, and commercial work.</p>
      ${cardGrid([
        {
          title: "Drains and sewers",
          text: "Recurring clogs, gurgling fixtures, camera inspections, hydro jetting, and sewer repair questions.",
          href: blogCategoryUrl(business, BLOG_CATEGORIES.find((item) => item.slug === "drains-and-sewers")),
          linkText: "Read drain guides",
        },
        {
          title: "Leaks and water heaters",
          text: "Meter movement, warm floors, dripping fixtures, no hot water, and when a repair or replacement may be needed.",
          href: blogCategoryUrl(business, BLOG_CATEGORIES.find((item) => item.slug === "leaks-and-slab-leaks")),
          linkText: "Read leak guides",
        },
        {
          title: "All Masterflow guides",
          text: "Browse every Masterflow guide on plumbing emergencies, maintenance, repiping, commercial work, drains, leaks, and water heaters.",
          href: blogUrl(business),
          linkText: "Visit the blog",
        },
      ])}
    </section>
    ${requestServicePanel({ business })}
  `;
}

function buildPages({
  business,
  markets,
  services,
  reviews,
  faqs,
  options,
  posts = blogPostsFor(business),
  categories = blogCategoriesFor(business),
  industries = isCommercialSite(business) ? COMMERCIAL_INDUSTRIES : [],
}) {
  const marketMap = new Map(markets.map((market) => [market.slug, market]));
  const localBusiness = localBusinessSchema(business, markets, services);
  const copy = coreCopy(business);
  const pages = [];

  if (!options.omitIndex) pages.push(
    pageShell({
      kind: "index",
      urlPath: makeUrl(business.preview_prefix),
      metaTitle: isCommercialSite(business)
        ? "Commercial Plumber in Southern California | Masterflow"
        : "Emergency Plumber in Corona, CA | Masterflow",
      metaDescription: metaDescriptionWithPhone(copy.home.hero, business.phone_display),
      h1: copy.home.h1,
      heroCopy: copy.home.hero,
      eyebrow: copy.home.eyebrow,
      body: indexBody({ business, markets, services }),
    business,
      markets,
      services,
      schema: [localBusiness, breadcrumbSchema(business, [breadcrumbRoot(business)])],
      options,
    }),
  );

  pages.push(
    pageShell({
      kind: "about",
      urlPath: aboutUrl(business),
      metaTitle: isCommercialSite(business) ? "About Masterflow Commercial Plumbing" : "About Masterflow Plumbing",
      metaDescription: isCommercialSite(business)
        ? `About Masterflow commercial plumbing, ${displayLicenseNo(business)}, serving Southern California properties with emergency, drain, sewer, and building plumbing.`
        : `About Masterflow Plumbing, ${displayLicenseNo(business)}, serving Corona and Southern California with emergency, drain, sewer, and commercial plumbing.`,
      h1: copy.about.h1,
      heroCopy: copy.about.hero,
      eyebrow: copy.about.eyebrow,
      body: aboutPageBody({ business, markets, services }),
      business,
      markets,
      services,
      market: markets[0],
      service: services[0],
      schema: [
        localBusiness,
        webPageSchema(business, {
          name: "About Masterflow Plumbing",
          urlPath: aboutUrl(business),
          description: "About Masterflow Plumbing.",
        }),
        breadcrumbSchema(business, [breadcrumbRoot(business), { name: "About", urlPath: aboutUrl(business) }]),
      ],
      options,
    }),
  );

  pages.push(
    pageShell({
      kind: "services-index",
      urlPath: servicesIndexUrl(business),
      metaTitle: isCommercialSite(business) ? "Masterflow Commercial Plumbing Services" : "Masterflow Plumbing Services",
      metaDescription: isCommercialSite(business)
        ? "Masterflow commercial plumbing services: 24/7 emergencies, drains, sewer repair, hydro jetting, cameras, leaks, water heaters, repiping, and fixtures."
        : "Masterflow plumbing services: emergency plumbing, drain cleaning, sewer repair, hydro jetting, leak detection, water heaters, and commercial plumbing.",
      h1: copy.services.h1,
      heroCopy: copy.services.hero,
      eyebrow: copy.services.eyebrow,
      body: servicesIndexBody({ business, markets, services }),
      heroMedia: mediaByFilename(business, "img-6137.jpg"),
      business,
      markets,
      services,
      market: markets[0],
      service: services[0],
      schema: [
        localBusiness,
        webPageSchema(business, {
          name: "Masterflow Plumbing Services",
          urlPath: servicesIndexUrl(business),
          description: "Masterflow Plumbing service catalog.",
        }),
        breadcrumbSchema(business, [breadcrumbRoot(business), { name: "Services", urlPath: servicesIndexUrl(business) }]),
      ],
      options,
    }),
  );

  pages.push(
    pageShell({
      kind: "service-area-index",
      urlPath: serviceAreaIndexUrl(business),
      metaTitle: isCommercialSite(business) ? "Masterflow Commercial Plumbing Service Area" : "Masterflow Plumbing Service Areas",
      metaDescription: isCommercialSite(business)
        ? "Masterflow commercial plumbing coverage from Santa Barbara through Greater Los Angeles, Orange County, the Inland Empire, and San Diego."
        : "Masterflow service areas for Corona, Lake Elsinore, Riverside, Norco, Ontario, Pasadena, Glendale, and nearby Southern California markets.",
      h1: copy.areas.h1,
      heroCopy: copy.areas.hero,
      eyebrow: copy.areas.eyebrow,
      body: serviceAreaIndexBody({ business, markets, services }),
      business,
      markets,
      services,
      market: markets[0],
      service: services[0],
      schema: [
        localBusiness,
        webPageSchema(business, {
          name: "Masterflow Plumbing Service Areas",
          urlPath: serviceAreaIndexUrl(business),
          description: "Masterflow Plumbing areas served.",
        }),
        breadcrumbSchema(business, [breadcrumbRoot(business), { name: "Service Area", urlPath: serviceAreaIndexUrl(business) }]),
      ],
      options,
    }),
  );

  pages.push(
    pageShell({
      kind: "contact",
      urlPath: contactUrl(business),
      metaTitle: isCommercialSite(business) ? "Request Commercial Plumbing Service | Masterflow" : "Contact Masterflow Plumbing",
      metaDescription: isCommercialSite(business)
        ? `Contact Masterflow at ${business.phone_display} for commercial emergencies, drains, sewer, hydro jetting, leaks, water heaters, maintenance, and project work.`
        : `Contact Masterflow Plumbing at ${business.phone_display} for emergency plumbing, drains, sewer, leak detection, water heaters, and commercial service.`,
      h1: copy.contact.h1,
      heroCopy: copy.contact.hero,
      eyebrow: copy.contact.eyebrow,
      body: contactPageBody({ business, markets, services }),
      business,
      markets,
      services,
      market: markets[0],
      service: services[0],
      schema: [
        localBusiness,
        webPageSchema(business, {
          name: "Contact Masterflow Plumbing",
          urlPath: contactUrl(business),
          description: "Contact Masterflow Plumbing.",
        }),
        breadcrumbSchema(business, [breadcrumbRoot(business), { name: "Contact", urlPath: contactUrl(business) }]),
      ],
      options,
    }),
  );

  pages.push(
    pageShell({
      kind: "reviews",
      urlPath: reviewsUrl(business),
      metaTitle: "Leave a Review",
      metaDescription: `Read real Masterflow Plumbing customer review excerpts. Leave feedback or call ${business.phone_display} for plumbing service.`,
      h1: copy.reviews.h1,
      heroCopy: copy.reviews.hero,
      eyebrow: copy.reviews.eyebrow,
      body: reviewsPageBody({ business, reviews }),
      business,
      markets,
      services,
      market: markets[0],
      service: services[0],
      schema: [localBusiness, breadcrumbSchema(business, [breadcrumbRoot(business), { name: "Reviews", urlPath: reviewsUrl(business) }])],
      options,
    }),
  );

  if (industries.length) {
    pages.push(
      pageShell({
        kind: "industries-index",
        urlPath: industriesIndexUrl(business),
        metaTitle: "Commercial Properties We Serve | Masterflow",
        metaDescription: "Masterflow commercial plumbing for property portfolios, multifamily, retail, restaurants, offices, industrial sites, HOAs, and due diligence.",
        h1: "Commercial Properties Masterflow Serves",
        heroCopy: "Commercial plumbing for occupied properties, managed portfolios, operating businesses, community associations, and real estate projects across Southern California.",
        eyebrow: "Commercial properties",
        body: commercialIndustriesIndexBody({ business, services }),
        heroMedia: mediaByFilename(business, "epoxy-sewer-liner-prep-commercial-2.jpg"),
        business,
        markets,
        services,
        market: markets[0],
        service: services[0],
        schema: [
          localBusiness,
          webPageSchema(business, {
            name: "Commercial Properties Masterflow Serves",
            urlPath: industriesIndexUrl(business),
            description: "Commercial property plumbing services from Masterflow.",
          }),
          breadcrumbSchema(business, [
            breadcrumbRoot(business),
            { name: "Industries", urlPath: industriesIndexUrl(business) },
          ]),
        ],
        options,
      }),
    );

    for (const industry of industries) {
      pages.push(
        pageShell({
          kind: "industry",
          urlPath: industryUrl(business, industry),
          metaTitle: `${industry.name} Plumbing | Masterflow`,
          metaDescription: industry.description,
          h1: industry.h1,
          heroCopy: industry.description,
          eyebrow: industry.name,
          body: commercialIndustryBody({ business, industry, services }),
          heroMedia: mediaByFilename(business, "epoxy-sewer-liner-prep-commercial-3.jpg"),
          business,
          markets,
          services,
          market: markets[0],
          service: services[0],
          schema: [
            localBusiness,
            webPageSchema(business, {
              name: industry.h1,
              urlPath: industryUrl(business, industry),
              description: industry.description,
            }),
            breadcrumbSchema(business, [
              breadcrumbRoot(business),
              { name: "Industries", urlPath: industriesIndexUrl(business) },
              { name: industry.name, urlPath: industryUrl(business, industry) },
            ]),
          ],
          options,
        }),
      );
    }
  }

  pages.push(
    pageShell({
      kind: "post-index",
      urlPath: blogUrl(business),
      metaTitle: isCommercialSite(business) ? "Commercial Plumbing Guides | Masterflow" : "Plumbing Guides | Masterflow Plumbing",
      metaDescription: isCommercialSite(business)
        ? "Masterflow commercial plumbing guides for property operations, drains, sewers, emergencies, due diligence, downtime, and larger projects."
        : "Masterflow plumbing guides for drains, sewer lines, leaks, water heaters, repiping, emergencies, maintenance, and commercial plumbing.",
      h1: isCommercialSite(business) ? "Masterflow Commercial Plumbing Guides" : "Masterflow Plumbing Guides",
      heroCopy: isCommercialSite(business)
        ? "Practical guides for property managers, facility teams, owners, investors, and commercial project leads."
        : "Straight answers about clogs, sewer trouble, leaks, water heaters, repiping, plumbing emergencies, and commercial work.",
      eyebrow: isCommercialSite(business) ? "Commercial resources" : "Blog",
      body: blogIndexBody({ business, posts, categories }),
      heroMedia: mediaByFilename(business, "img-1669.jpg"),
      business,
      markets,
      services,
      market: markets[0],
      service: services[0],
      schema: [
        localBusiness,
        webPageSchema(business, {
          name: "Masterflow Plumbing Guides",
          urlPath: blogUrl(business),
          description: "Masterflow Plumbing article library.",
        }),
        breadcrumbSchema(business, [breadcrumbRoot(business), { name: "Blog", urlPath: blogUrl(business) }]),
      ],
      options,
    }),
  );

  for (const category of categories) {
    const categoryPosts = posts.filter((post) => post.category === category.slug);
    pages.push(
      pageShell({
        kind: "category",
        urlPath: blogCategoryUrl(business, category),
        metaTitle: `${category.name} | Masterflow Blog`,
        metaDescription: category.description,
        h1: category.name,
        heroCopy: category.description,
        eyebrow: "Plumbing guide topic",
        body: blogCategoryBody({ business, category, posts: categoryPosts, categories }),
        heroMedia: pageMediaForService(
          business,
          markets[0],
          blogCategoryService(category.slug, services),
          category.slug,
        ),
        business,
        markets,
        services,
        market: markets[0],
        service: services[0],
        schema: [
          localBusiness,
          webPageSchema(business, {
            name: category.name,
            urlPath: blogCategoryUrl(business, category),
            description: category.description,
          }),
          breadcrumbSchema(business, [
            breadcrumbRoot(business),
            { name: "Blog", urlPath: blogUrl(business) },
            { name: category.name, urlPath: blogCategoryUrl(business, category) },
          ]),
        ],
        options,
      }),
    );
  }

  for (const post of posts) {
    const category = categoryBySlug(post.category, categories);
    const postService = services.find((item) => item.slug === post.serviceSlug) ?? services[0];
    pages.push(
      pageShell({
        kind: "post",
        urlPath: blogPostUrl(business, post),
        metaTitle: `${post.title} | Masterflow`,
        metaDescription: post.description,
        h1: post.title,
        heroCopy: post.description,
        eyebrow: category?.name ?? "Plumbing guide",
        body: blogPostBody({ business, post, posts, services, categories }),
        heroMedia: pageMediaForService(business, markets[0], postService, post.slug),
        business,
        markets,
        services,
        market: markets[0],
        service: postService,
        schema: [
          localBusiness,
          articleSchema(business, post),
          ...(post.faq?.length ? [faqSchema(post.faq)] : []),
          breadcrumbSchema(business, [
            breadcrumbRoot(business),
            { name: "Blog", urlPath: blogUrl(business) },
            ...(category ? [{ name: category.name, urlPath: blogCategoryUrl(business, category) }] : []),
            { name: post.title, urlPath: blogPostUrl(business, post) },
          ]),
        ],
        options,
      }),
    );
  }

  pages.push(
    pageShell({
      kind: "admin",
      urlPath: adminUrl(business),
      metaTitle: "Site Maintenance | Masterflow Plumbing",
      metaDescription: `masterflowplumbing.us is created and maintained by ${maintainer.domain}.`,
      h1: "Masterflow Plumbing Site Maintenance",
      heroCopy: `masterflowplumbing.us is created and maintained by ${maintainer.domain}.`,
      eyebrow: "Website record",
      body: adminPageBody({ business }),
      business,
      markets,
      services,
      market: markets[0],
      service: services[0],
      schema: [
        localBusiness,
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Masterflow Plumbing Site Maintenance",
          url: `${business.primary_domain}${adminUrl(business)}`,
          isPartOf: { "@type": "WebSite", url: business.primary_domain },
          about: { "@id": businessEntityId(business) },
          creator: {
            "@type": "Organization",
            name: maintainer.name,
            url: maintainer.url,
          },
        },
        breadcrumbSchema(business, [breadcrumbRoot(business), { name: "Site Maintenance", urlPath: adminUrl(business) }]),
      ],
      options,
      searchIndexable: false,
    }),
  );

  if (!isCommercialSite(business)) {
    for (const market of markets) {
      pages.push(
        pageShell({
      kind: "city",
      urlPath: cityHubUrl(business, market),
      metaTitle: cityHubMetaTitle(business, market),
      metaDescription: cityHubMetaDescription(business, market),
      h1: cityHubHeading(business, market),
      heroCopy: clientHeroCopy(business, market),
        eyebrow: cityHubEyebrow(market),
        body: cityHubBody({ business, market, marketMap, services }),
        heroMedia: pageMediaForService(business, market, services[0], "city"),
        business,
        markets,
        services,
        market,
        service: services[0],
        schema: [
          localBusiness,
          breadcrumbSchema(business, [
            breadcrumbRoot(business),
            { name: market.city, urlPath: cityHubUrl(business, market) },
          ]),
        ],
        options,
        }),
      );
    }
  }

  for (const service of services) {
    const copy = serviceCopy(service, business);
    pages.push(
      pageShell({
        kind: "service",
        urlPath: serviceHubUrl(business, service),
        metaTitle: `${copy.title} | Masterflow Plumbing`,
        metaDescription: metaDescriptionWithPhone(copy.hero, business.phone_display),
        h1: copy.title,
        heroCopy: copy.hero,
        eyebrow: copy.eyebrow,
        body: serviceHubBody({ business, service, markets, posts }),
        heroMedia: pageMediaForService(business, markets[0], service, "service"),
        business,
        markets,
        services,
        market: markets[0],
        service,
        schema: [
          localBusiness,
          breadcrumbSchema(business, [
            breadcrumbRoot(business),
            { name: service.name, urlPath: serviceHubUrl(business, service) },
          ]),
        ],
        options,
      }),
    );
  }

  if (!isCommercialSite(business)) {
    for (const market of markets) {
      for (const service of services) {
        const selectedFaqs = applyFaqTokens(faqs, market, service);
        const cityServiceName = serviceSeoName(service);
        pages.push(
          pageShell({
          kind: "city-service",
          urlPath: cityServiceUrl(business, market, service),
          metaTitle: cityServiceMetaTitle(market, service),
          metaDescription: cityServiceMetaDescription(business, market, service),
          h1: `${cityServiceName} in ${market.city}, CA`,
          heroCopy: cityServiceHeroCopy(business, market, service),
          eyebrow: `${market.city} ${cityServiceName}`,
          body: cityServiceBody({ business, market, service, marketMap, services, faqs, reviews }),
          heroMedia: pageMediaForService(business, market, service, "city-service"),
          business,
          markets,
          services,
          market,
          service,
          schema: [
            localBusiness,
            serviceSchema(business, market, service),
            faqSchema(selectedFaqs),
            breadcrumbSchema(business, [
              breadcrumbRoot(business),
              { name: market.city, urlPath: cityHubUrl(business, market) },
              { name: service.name, urlPath: cityServiceUrl(business, market, service) },
            ]),
          ],
          options,
          searchIndexable: false,
          }),
        );
      }
    }
  }
  return pages;
}

function validateData({
  business,
  markets,
  services,
  reviews,
  faqs,
  allMarketSlugs,
  posts = blogPostsFor(business),
  categories = blogCategoriesFor(business),
  industries = isCommercialSite(business) ? COMMERCIAL_INDUSTRIES : [],
}) {
  const ajv = new Ajv({ allErrors: true });
  const validators = {
    business: ajv.compile(dataSchemas.business),
    market: ajv.compile(dataSchemas.market),
    service: ajv.compile(dataSchemas.service),
  };
  const issues = [];
  if (!validators.business(business)) issues.push({ scope: "business", errors: validators.business.errors });
  services.forEach((service) => {
    if (!validators.service(service)) issues.push({ scope: `service:${service.slug ?? "missing"}`, errors: validators.service.errors });
  });
  markets.forEach((market) => {
    if (!validators.market(market)) issues.push({ scope: `market:${market.slug ?? "missing"}`, errors: validators.market.errors });
  });
  const marketSlugs = new Set(markets.map((market) => market.slug));
  const nearbySlugs = allMarketSlugs ?? marketSlugs;
  for (const market of markets) {
    for (const nearby of market.nearby_slugs ?? []) {
      if (!nearbySlugs.has(nearby)) issues.push({ scope: `market:${market.slug}`, errors: [{ message: `nearby_slug ${nearby} is not defined` }] });
    }
  }
  for (const review of reviews) {
    if ("city_slug" in review) issues.push({ scope: "reviews", errors: [{ message: "reviews must not invent city_slug metadata" }] });
    if ("service_slug" in review) issues.push({ scope: "reviews", errors: [{ message: "reviews must not invent service_slug metadata" }] });
    if (review.consented !== true) issues.push({ scope: "reviews", errors: [{ message: "review is not consented" }] });
  }
  if (!Array.isArray(faqs) || faqs.length < 4) issues.push({ scope: "faqs", errors: [{ message: "expected at least four common FAQs" }] });
  const mediaRefs = [];
  const collectMedia = (value) => {
    if (typeof value === "string" && value.startsWith("/media/")) mediaRefs.push(value);
    else if (Array.isArray(value)) value.forEach(collectMedia);
    else if (value && typeof value === "object") Object.values(value).forEach(collectMedia);
  };
  collectMedia(business.media);
  for (const mediaRef of [...new Set(mediaRefs)]) {
    const mediaFile = mediaRef.split("?")[0].replace(/^\/media\//, "");
    if (!existsSync(path.join(siteDir, "media", mediaFile))) {
      issues.push({ scope: "media", errors: [{ message: `missing referenced media file ${mediaFile}` }] });
    }
  }
  const categorySlugs = new Set(categories.map((category) => category.slug));
  const serviceSlugs = new Set(services.map((service) => service.slug));
  const paragraphOwners = new Map();
  const expectedPostCount = isCommercialSite(business) ? 8 : 45;
  const expectedCategoryCount = isCommercialSite(business) ? 4 : 6;
  const minimumArticleWords = isCommercialSite(business) ? 150 : 200;
  if (posts.length !== expectedPostCount) issues.push({ scope: "blog", errors: [{ message: `expected ${expectedPostCount} posts, found ${posts.length}` }] });
  if (categories.length !== expectedCategoryCount) issues.push({ scope: "blog", errors: [{ message: `expected ${expectedCategoryCount} categories, found ${categories.length}` }] });
  if (isCommercialSite(business) && industries.length !== 6) {
    issues.push({ scope: "industries", errors: [{ message: `expected 6 commercial industries, found ${industries.length}` }] });
  }
  for (const post of posts) {
    if (!categorySlugs.has(post.category)) issues.push({ scope: `blog:${post.slug}`, errors: [{ message: `unknown category ${post.category}` }] });
    if (!serviceSlugs.has(post.serviceSlug)) issues.push({ scope: `blog:${post.slug}`, errors: [{ message: `unknown service ${post.serviceSlug}` }] });
    const paragraphs = [post.lede, ...post.sections.flatMap((section) => section.paragraphs ?? []), ...(post.faq ?? []).map((faq) => faq.a)];
    const articleSource = [
      post.title,
      post.description,
      post.lede,
      ...post.sections.flatMap((section) => [section.heading, ...(section.paragraphs ?? [])]),
      ...(post.checklist ?? []),
      ...(post.faq ?? []).flatMap((faq) => [faq.q, faq.a]),
    ];
    const wordCount = articleSource.join(" ").split(/\s+/).filter(Boolean).length;
    if (wordCount < minimumArticleWords) issues.push({ scope: `blog:${post.slug}`, errors: [{ message: `article source is too short (${wordCount} words)` }] });
    for (const paragraph of paragraphs) {
      const normalized = String(paragraph).replace(/\s+/g, " ").trim().toLowerCase();
      if (!normalized) continue;
      const owner = paragraphOwners.get(normalized);
      if (owner && owner !== post.slug) {
        issues.push({ scope: `blog:${post.slug}`, errors: [{ message: `repeats a full paragraph from ${owner}` }] });
      } else {
        paragraphOwners.set(normalized, post.slug);
      }
    }
  }
  return issues;
}

function shingleSet(text, size = 5) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((word) => word.length > 2);
  const shingles = new Set();
  for (let i = 0; i <= words.length - size; i += 1) shingles.add(words.slice(i, i + size).join(" "));
  return shingles;
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
  return stripHtml(main.replace(/<script\b[\s\S]*?<\/script>/gi, " ")).replace(/\s+/g, " ").trim();
}

function internalHrefs(html, prefix) {
  const hrefs = [];
  const matcher = /<a\b[^>]*\bhref=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match;
  while ((match = matcher.exec(String(html)))) {
    const href = match.slice(1).find(Boolean);
    if (href?.startsWith(prefix)) hrefs.push(href.split(/[?#]/, 1)[0] || prefix);
  }
  return hrefs;
}

function jsonLdTexts(html) {
  const scripts = [];
  const matcher = /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = matcher.exec(String(html)))) scripts.push(match[1].trim());
  return scripts;
}

function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function validateRenderedPages({ pages, htmlByUrl, business, options }) {
  const pageUrlSet = new Set(pages.map((page) => page.urlPath));
  const pageByUrl = new Map(pages.map((page) => [page.urlPath, page]));
  const allowedStaticHrefs = isProductionRouteMode(business)
    ? new Set(["/", "/commercial/", "/privacy.html/", "/terms.html/"])
    : new Set();
  const titles = new Map();
  const descriptions = new Map();
  const inboundPublicLinks = new Map(
    pages
      .filter(searchIndexablePage)
      .map((page) => [page.urlPath, new Set()]),
  );
  const guards = [];
  const issues = [];

  let sitemapLocs = 0;
  let maxDuplicate = { score: 0, a: "", b: "" };
  const shingled = [];

  for (const page of pages) {
    const html = htmlByUrl.get(page.urlPath);
    const mainText = mainTextFromHtml(html);
    const wordCount = mainText.split(/\s+/).filter(Boolean).length;
    const minWords = page.kind === "city-service"
      ? 1000
      : page.kind === "city"
        ? 750
        : page.kind === "service"
          ? 550
          : page.kind === "index" || page.kind === "post-index"
            ? 500
            : page.kind === "post"
              ? 250
              : page.kind === "category"
                ? 140
                : page.kind === "admin"
                  ? 90
                  : 350;
    if (wordCount < minWords) issues.push({ guard: "wordCount", urlPath: page.urlPath, wordCount, minWords });

    const title = titleFromHtml(html);
    const description = metaContent(html, "description");
    if (!title || title.length > 60) issues.push({ guard: "meta", urlPath: page.urlPath, titleLength: title.length });
    if (!description || description.length > 155) issues.push({ guard: "meta", urlPath: page.urlPath, descriptionLength: description.length });
    if (titles.has(title)) issues.push({ guard: "uniqueMeta", urlPath: page.urlPath, duplicateTitleWith: titles.get(title) });
    if (descriptions.has(description)) issues.push({ guard: "uniqueMeta", urlPath: page.urlPath, duplicateDescriptionWith: descriptions.get(description) });
    titles.set(title, page.urlPath);
    descriptions.set(description, page.urlPath);

    if (!html.includes(business.phone_display) || !html.includes(business.license_no)) issues.push({ guard: "nap", urlPath: page.urlPath });
    if (searchIndexablePage(page)) {
      if (!html.includes("index,follow") || /\bnoindex\b/i.test(html)) issues.push({ guard: "robotsMeta", urlPath: page.urlPath });
    } else if (options.indexable) {
      if (!html.includes("noindex,follow")) issues.push({ guard: "robotsMeta", urlPath: page.urlPath });
    } else if (!html.includes("noindex,nofollow")) {
      issues.push({ guard: "robotsMeta", urlPath: page.urlPath });
    }

    for (const href of internalHrefs(html, business.preview_prefix)) {
      const normalized = href.endsWith("/") ? href : `${href}/`;
      const slashless = normalized.replace(/\/$/, "") || "/";
      if (allowedStaticHrefs.has(normalized) && !pageUrlSet.has(normalized) && !pageUrlSet.has(slashless)) continue;
      if (!pageUrlSet.has(normalized) && !pageUrlSet.has(slashless) && !normalized.endsWith("/sitemap.xml/")) issues.push({ guard: "links", urlPath: page.urlPath, href });
      const target = pageByUrl.get(normalized) ?? pageByUrl.get(slashless);
      if (searchIndexablePage(page) && target && !searchIndexablePage(target)) {
        issues.push({ guard: "publicToNoindex", urlPath: page.urlPath, href });
      }
      if (target && searchIndexablePage(target) && target.urlPath !== page.urlPath) {
        inboundPublicLinks.get(target.urlPath)?.add(page.urlPath);
      }
    }

    for (const scriptText of jsonLdTexts(html)) {
      try {
        const parsed = JSON.parse(scriptText);
        const types = Array.isArray(parsed["@type"]) ? parsed["@type"] : [parsed["@type"]];
        if (types.includes("LocalBusiness") || types.includes("Plumber")) {
          for (const key of ["name", "telephone", "address", "geo"]) if (!parsed[key]) throw new Error(`missing ${key}`);
        }
        if (types.includes("Service")) {
          for (const key of ["serviceType", "provider", "areaServed"]) if (!parsed[key]) throw new Error(`missing ${key}`);
        }
        if (types.includes("FAQPage") && !Array.isArray(parsed.mainEntity)) throw new Error("missing FAQ mainEntity");
        if (types.includes("BreadcrumbList") && !Array.isArray(parsed.itemListElement)) throw new Error("missing breadcrumb items");
      } catch (error) {
        issues.push({ guard: "jsonLd", urlPath: page.urlPath, message: error.message });
      }
    }

    for (const bad of badStrings) {
      if (html.includes(bad)) issues.push({ guard: "badString", urlPath: page.urlPath, bad });
    }
    if (page.kind !== "admin") {
      for (const forbidden of PUBLIC_COPY_FORBIDDEN) {
        if (mainText.toLowerCase().includes(forbidden.toLowerCase())) {
          issues.push({ guard: "publicCopy", urlPath: page.urlPath, forbidden });
        }
      }
    }

    const officialPhoneDigits = business.phone.replace(/\D/g, "");
    const officialPhoneVariants = new Set([
      officialPhoneDigits,
      officialPhoneDigits.startsWith("1") ? officialPhoneDigits.slice(1) : officialPhoneDigits,
    ]);
    const phoneMatches = html.match(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g) ?? [];
    for (const phone of phoneMatches) {
      if (!officialPhoneVariants.has(phone.replace(/\D/g, ""))) issues.push({ guard: "noPii", urlPath: page.urlPath, phone });
    }
    const emailMatches = html.match(/[\w.+-]+@[\w-]+\.\w+/g) ?? [];
    for (const email of emailMatches) issues.push({ guard: "noPii", urlPath: page.urlPath, email });
    const streetMatches = html.match(/\b\d{1,5}\s+[A-Za-z]+\s+(?:st|street|ave|avenue|blvd|road|rd|drive|dr|lane|ln|court|ct)\b/gi) ?? [];
    for (const street of streetMatches) issues.push({ guard: "noPii", urlPath: page.urlPath, street });

    if (page.kind === "city-service") shingled.push({ urlPath: page.urlPath, set: shingleSet(mainText) });
  }

  for (let i = 0; i < shingled.length; i += 1) {
    for (let j = i + 1; j < shingled.length; j += 1) {
      const score = jaccard(shingled[i].set, shingled[j].set);
      if (score > maxDuplicate.score) maxDuplicate = { score, a: shingled[i].urlPath, b: shingled[j].urlPath };
    }
  }
  if (maxDuplicate.score > 0.84) issues.push({ guard: "duplicateRisk", ...maxDuplicate });

  const orphanPublicRoutes = [...inboundPublicLinks]
    .filter(([, inbound]) => inbound.size === 0)
    .map(([urlPath]) => urlPath);
  for (const urlPath of orphanPublicRoutes) issues.push({ guard: "orphanPublic", urlPath });

  const guardNames = ["wordCount", "meta", "uniqueMeta", "nap", "robotsMeta", "links", "publicToNoindex", "orphanPublic", "jsonLd", "badString", "publicCopy", "noPii", "duplicateRisk", "sitemapParity"];
  for (const guardName of guardNames) {
    guards.push({
      name: guardName,
      pass: !issues.some((issue) => issue.guard === guardName),
    });
  }
  return { guards, issues, maxDuplicate, sitemapLocs, orphanPublicRoutes };
}

function searchIndexablePage(page) {
  const robots = String(page.meta?.robots ?? "");
  return /\bindex\b/i.test(robots) && !/\bnoindex\b/i.test(robots);
}

function sitemapFamilyForPage(page) {
  if (page.kind === "city" || page.kind === "service-area-index") return "areas_we_serve";
  if (page.kind === "services-index" || page.kind === "service") return "services";
  if (page.kind === "industries-index" || page.kind === "industry") return "industries";
  if (page.kind === "post" || page.kind === "post-index") return "post";
  if (page.kind === "category") return "category";
  if (page.kind === "admin" || page.kind === "city-service") return "admin";
  return "page";
}

function sitemapPublicUrl(business, filename) {
  return `${business.primary_domain}${makeUrl(business.preview_prefix, [filename]).replace(/\/$/, "")}`;
}

function pagePublicUrl(business, page) {
  return `${business.primary_domain}${page.urlPath}`;
}

function productionHomeSitemapEntry(business) {
  if (!isProductionRouteMode(business)) return null;
  return {
    kind: "index",
    urlPath: "/",
    meta: {
      title: "Masterflow Plumbing",
      robots: "index,follow",
      canonical: `${business.primary_domain}/`,
      lastmod: COPY_LASTMOD,
    },
    generatedByThisRun: false,
  };
}

function buildSitemapPlan(business, pages) {
  const homeEntry = pages.some((page) => page.urlPath === "/") ? null : productionHomeSitemapEntry(business);
  const entries = [
    ...(homeEntry ? [homeEntry] : []),
    ...pages.map((page) => ({ ...page, generatedByThisRun: true })),
  ];
  const searchEntries = entries.filter(searchIndexablePage);
  const families = sitemapFamilies.map((family) => {
    const allPages = entries.filter((page) => sitemapFamilyForPage(page) === family.id);
    const searchPages = searchEntries.filter((page) => sitemapFamilyForPage(page) === family.id);
    return {
      ...family,
      publicUrl: sitemapPublicUrl(business, family.filename),
      allPages,
      searchPages,
    };
  }).filter((family) => family.allPages.length > 0);
  return {
    indexFilename: "sitemap.xml",
    indexAliasFilename: "sitemap_index.xml",
    indexUrl: sitemapPublicUrl(business, "sitemap.xml"),
    entries,
    searchEntries,
    families,
    publicFamilies: families.filter((family) => family.searchFacing !== false),
  };
}

function sitemapIndexXml(plan) {
  const locs = plan.publicFamilies
    .map((family) => `  <sitemap><loc>${escapeHtml(family.publicUrl)}</loc><lastmod>${escapeHtml(COPY_LASTMOD)}</lastmod></sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="${sitemapStylesheetFilename}"?>\n<!-- Created and maintained by ${maintainer.url} -->\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs}\n</sitemapindex>\n`;
}

function urlsetSitemapXml(business, pages) {
  const uniquePages = [...new Map(pages.map((page) => [pagePublicUrl(business, page), page])).values()];
  const locs = uniquePages
    .map((page) => `  <url><loc>${escapeHtml(pagePublicUrl(business, page))}</loc><lastmod>${escapeHtml(page.meta?.lastmod ?? COPY_LASTMOD)}</lastmod></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="${sitemapStylesheetFilename}"?>\n<!-- Created and maintained by ${maintainer.url} -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs}\n</urlset>\n`;
}

function sitemapFamilySummaries(plan) {
  return plan.families.map((family) => ({
    id: family.id,
    label: family.label,
    filename: family.filename,
    publicUrl: family.publicUrl,
    generatedPages: family.allPages.filter((page) => page.generatedByThisRun !== false).length,
    searchIndexablePages: family.searchPages.length,
    noindexPages: family.allPages.filter((page) => !searchIndexablePage(page)).length,
    searchFacing: family.searchFacing !== false,
  }));
}

function pageInventoryRecord({ business, plan, page }) {
  const family = sitemapFamilies.find((item) => item.id === sitemapFamilyForPage(page));
  const searchIndexable = searchIndexablePage(page);
  return {
    path: page.urlPath,
    url: pagePublicUrl(business, page),
    kind: page.kind,
    title: page.meta?.title ?? "",
    canonical: page.meta?.canonical ?? "",
    robots: page.meta?.robots ?? "",
    sitemapFamily: family?.id ?? "page",
    sitemapFile: family?.filename ?? "page-sitemap.xml",
    generatedByThisRun: page.generatedByThisRun !== false,
    lastmod: page.meta?.lastmod ?? COPY_LASTMOD,
    searchIndexable,
    searchSitemapIncluded: searchIndexable && plan.searchEntries.some((entry) => entry.urlPath === page.urlPath),
  };
}

function pagesSitemapInventory({ business, pages, plan, options }) {
  const generatedEntries = pages.map((page) => ({ ...page, generatedByThisRun: true }));
  const supplementalEntries = plan.entries.filter((page) => page.generatedByThisRun === false);
  const records = [...generatedEntries, ...supplementalEntries]
    .map((page) => pageInventoryRecord({ business, plan, page }))
    .sort((a, b) => a.sitemapFamily.localeCompare(b.sitemapFamily) || a.path.localeCompare(b.path));
  return {
    generatedAt: new Date().toISOString(),
    purpose: "Generator page ledger. This records every generated page, including noindex/non-indexed preview pages; search-facing XML sitemaps include only indexable pages.",
    output: options.out,
    physicalOutput: path.relative(siteDir, generatedOutputRoot(options.out)),
    indexableBuild: Boolean(options.indexable),
    parentSitemap: plan.indexUrl,
    counts: {
      generatedPages: pages.length,
      supplementalSearchPages: supplementalEntries.length,
      totalLoggedPages: records.length,
      searchIndexablePages: records.filter((page) => page.searchIndexable).length,
      noindexPages: records.filter((page) => !page.searchIndexable).length,
      searchSitemapUrls: plan.searchEntries.length,
    },
    sitemapFamilies: sitemapFamilySummaries(plan),
    pages: records,
  };
}

function llmsTxt({ business, markets, services, pages }) {
  const priorityMarkets = business.service_area?.priority_markets ?? [];
  const commercial = business.commercial_reputation ?? {};
  const keyPages = [
    "/",
    aboutUrl(business),
    servicesIndexUrl(business),
    serviceAreaIndexUrl(business),
    blogUrl(business),
    reviewsUrl(business),
    contactUrl(business),
    ...markets.slice(0, 8).map((market) => cityHubUrl(business, market)),
    ...services.slice(0, 8).map((service) => serviceHubUrl(business, service)),
  ];
  const pageByPath = new Map(pages.map((page) => [page.urlPath, page]));
  const visibleKeyPages = keyPages
    .map((pathValue) => {
      const page = pageByPath.get(pathValue);
      const title = pathValue === "/" ? "Homepage" : page?.meta?.title ?? pathValue;
      return `- [${title}](${business.primary_domain}${pathValue})`;
    })
    .join("\n");
  const serviceLines = services
    .map((service) => `- ${serviceSeoName(service)}: ${service.short_desc}`)
    .join("\n");
  const marketLines = markets
    .filter((market) => priorityMarkets.includes(market.city))
    .map((market) => `- ${market.city}, ${market.county}: ${market.local_signals.slice(0, 2).map(customerFacingSignal).join("; ")}`)
    .join("\n");
  const commercialProof = [
    commercial.summary,
    ...(commercial.service_proof ?? []),
  ].filter(Boolean).map((item) => `- ${item}`).join("\n");

  return `# ${business.name}

> ${business.description}

Masterflow Plumbing is a licensed California plumbing, drain, and sewer company centered in Corona and serving selected Southern California communities. Emergency service is available 24/7.

## Contact

- Phone: ${business.phone_display}
- License: ${business.license_no}
- Primary site: ${business.primary_domain}
- Sitemap: ${business.primary_domain}/sitemap.xml

## Core Services

${serviceLines}

## Priority Service Areas

${marketLines}

## Commercial Plumbing

${commercialProof}

Commercial client names are described by property type unless approved for public use.

## Key Pages

${visibleKeyPages}

## Useful For

- Emergency plumber in Corona, CA.
- Drain cleaning, sewer line repair, hydro jetting, camera inspections, leak detection, and water heater repair.
- Commercial plumbing repairs, replacements, installs, and trenchless sewer support for managed properties, retail centers, restaurants, and commercial buildings.
- People comparing the canonical Masterflow company, service areas, license, contact details, and plumbing guides.
`;
}

function reportArtifacts(variant = "residential") {
  const suffix = variant === "commercial" ? "-commercial" : "";
  return {
    buildFilename: `build-report${suffix}.json`,
    buildPath: `seo/reports/build-report${suffix}.json`,
    inventoryFilename: `pages-sitemap${suffix}.json`,
    inventoryPath: `seo/reports/pages-sitemap${suffix}.json`,
  };
}

async function writeReport(report, variant) {
  const artifacts = reportArtifacts(variant);
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.writeFile(path.join(reportsDir, artifacts.buildFilename), `${JSON.stringify(report, null, 2)}\n`);
}

async function writePagesSitemapInventory(inventory, variant) {
  const artifacts = reportArtifacts(variant);
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.writeFile(path.join(reportsDir, artifacts.inventoryFilename), `${JSON.stringify(inventory, null, 2)}\n`);
}

function pipelineReport({ markets, services, pages, validation, options, sitemapPlan }) {
  const verifyPass = validation.issues.length === 0;
  const artifacts = reportArtifacts(options.variant);
  return {
    framework: "ValenFramework",
    pattern: "Build -> Match -> Verify -> Execute",
    currentPhase: "usage",
    verifyBeforeExecute: true,
    phaseRecovery: verifyPass
      ? { strategy: "none", targetPhase: "usage" }
      : { strategy: "shift_back", targetPhase: "conversion", reason: "render verification blocked publish-side effects" },
    dualSurfaceState: {
      desktop3d: `runtime card can ingest ${artifacts.buildPath}`,
      fieldTablet: "private GUI route /masterflow-seo reads the same report",
    },
    runtimeBridge: {
      action: "masterflow.seo.report.ingest",
      payloadPath: artifacts.buildPath,
      currentPhase: "usage",
      approvalGate: "queue-runtime-shipment before indexable publish, DNS, ads, outreach, or contact writes",
    },
    steps: [
      {
        name: "build",
        status: "pass",
        evidence: {
          pages: pages.length,
          indexable: Boolean(options.indexable),
          output: options.out,
        },
      },
      {
        name: "match",
        status: "pass",
        evidence: {
          markets: markets.length,
          services: services.length,
          cityServicePages: markets.length * services.length,
        },
      },
      {
        name: "verify",
        status: verifyPass ? "pass" : "fail",
        evidence: {
          guards: validation.guards.length,
          issues: validation.issues.length,
          maxDuplicateScore: validation.maxDuplicate.score,
        },
      },
      {
        name: "execute",
        status: verifyPass ? "ready" : "blocked",
        evidence: verifyPass
          ? ["write rendered files", "write robots.txt, parent sitemap index, and child sitemap files", `emit ${artifacts.buildFilename} and ${artifacts.inventoryFilename}`]
          : [`write ${artifacts.buildFilename} only`, "skip preview file rewrite until verification passes"],
      },
    ],
    sitemapFamily: {
      parent: sitemapPlan.indexUrl,
      children: sitemapFamilySummaries(sitemapPlan),
    },
  };
}

function isNumberedConflictArtifact(name) {
  return / \d+(?:\.[^.]+)?$/.test(name);
}

function supportPageFilenames(business, options) {
  if (!options.indexable || isCommercialSite(business) || normalizePrefix(business.preview_prefix) !== "/") return [];
  return ["privacy.html", "terms.html", "sitemap.html"];
}

function supportPageShell({ business, title, description, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,follow">
  <title>${escapeHtml(title)} | ${escapeHtml(business.name)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <style>
    :root { --ink: #061a38; --muted: #52657d; --line: #d7e0ea; --red: #ed162d; --paper: #f5f7fa; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--ink); font-family: Arial, Helvetica, sans-serif; line-height: 1.6; }
    header { background: var(--ink); color: #fff; }
    nav, main { margin: 0 auto; max-width: 920px; padding: 20px; }
    nav { align-items: center; display: flex; flex-wrap: wrap; gap: 18px; justify-content: space-between; }
    nav a { color: #fff; font-weight: 700; text-decoration: none; }
    nav .call { background: var(--red); border-radius: 6px; padding: 9px 13px; }
    main { padding-bottom: 64px; padding-top: 48px; }
    h1, h2 { line-height: 1.15; }
    h1 { font-size: clamp(2.2rem, 6vw, 4rem); margin: 0 0 14px; }
    h2 { margin-top: 0; }
    p, li { color: var(--muted); }
    section { background: #fff; border: 1px solid var(--line); border-radius: 8px; margin-top: 18px; padding: 24px; }
    main a { color: var(--ink); font-weight: 700; }
    .route-list { columns: 2; padding-left: 20px; }
    @media (max-width: 680px) { .route-list { columns: 1; } }
  </style>
</head>
<body>
  <header><nav><a href="/">${escapeHtml(business.name)}</a><a href="/services/">Services</a><a href="/service-area/">Service Area</a><a href="/blog/">Blog</a><a href="/contact/">Contact</a><a class="call" href="tel:${escapeHtml(business.phone.replace(/^\+1/, ""))}">Call ${escapeHtml(business.phone_display)}</a></nav></header>
  <main>${body}</main>
</body>
</html>`;
}

function supportPages({ business, pages }) {
  const publicPages = pages.filter(searchIndexablePage);
  const routeList = publicPages
    .map((page) => `<li><a href="${escapeHtml(page.urlPath)}">${escapeHtml(page.h1 || page.meta?.title || page.urlPath)}</a></li>`)
    .join("\n");
  return new Map([
    ["privacy.html", supportPageShell({
      business,
      title: "Privacy Policy",
      description: `Privacy policy for ${business.name}.`,
      body: `<h1>Privacy Policy</h1>
      <p>${escapeHtml(business.name)} respects your privacy. This page explains the information we may receive when you call, text, request service, leave a review, or use this website.</p>
      <section><h2>Information we collect</h2><p>We may collect your name, phone number, email, service address, job details, review details, and information you choose to provide so we can respond to your request.</p></section>
      <section><h2>How we use it</h2><p>We use this information to respond, schedule service, provide estimates, verify and moderate reviews, follow up on work, maintain business records, and improve customer service.</p></section>
      <section><h2>Sharing</h2><p>We do not sell personal information. Information may be shared when needed to provide service, run the website and business, comply with law, or protect customers and the company.</p></section>
      <section><h2>Contact</h2><p>For privacy questions, call <a href="tel:${escapeHtml(business.phone.replace(/^\+1/, ""))}">${escapeHtml(business.phone_display)}</a>. ${escapeHtml(business.license_no)}.</p></section>`,
    })],
    ["terms.html", supportPageShell({
      business,
      title: "Terms of Service",
      description: `Website and service terms for ${business.name}.`,
      body: `<h1>Terms of Service</h1>
      <p>These terms apply to this website and general communications with ${escapeHtml(business.name)}.</p>
      <section><h2>Website information</h2><p>Website content is general information and cannot replace an on-site inspection. Plumbing conditions, access, materials, code requirements, and repair scope vary by property.</p></section>
      <section><h2>Estimates and authorization</h2><p>Estimates and recommendations remain subject to inspection and confirmation. Work begins after the customer authorizes the scope and pricing.</p></section>
      <section><h2>Availability</h2><p>Emergency and same-day availability depends on location, current calls, access, and the type of work. Call <a href="tel:${escapeHtml(business.phone.replace(/^\+1/, ""))}">${escapeHtml(business.phone_display)}</a> to confirm current availability.</p></section>
      <section><h2>Contact</h2><p>${escapeHtml(business.name)}. ${escapeHtml(business.license_no)}.</p></section>`,
    })],
    ["sitemap.html", supportPageShell({
      business,
      title: "Sitemap",
      description: `Public route directory for ${business.name}.`,
      body: `<h1>Sitemap</h1><p>Browse the public pages for ${escapeHtml(business.name)}.</p><section><ul class="route-list">${routeList}</ul></section>`,
    })],
  ]);
}

function outputManifestFiles({ pages, outputRoot, sitemapPlan, business, options }) {
  return new Set(
    [
      ...pages.map((page) => page.outFile),
      path.join(outputRoot, sitemapPlan.indexFilename),
      path.join(outputRoot, sitemapPlan.indexAliasFilename),
      ...sitemapPlan.families.map((family) => path.join(outputRoot, family.filename)),
      path.join(outputRoot, sitemapStylesheetFilename),
      ...sitemapPresentationAssets.map((asset) => path.join(outputRoot, asset.output)),
      path.join(outputRoot, "llms.txt"),
      path.join(outputRoot, "LLM.txt"),
      path.join(outputRoot, "robots.txt"),
      ...supportPageFilenames(business, options).map((filename) => path.join(outputRoot, filename)),
    ].map((file) => path.resolve(file)),
  );
}

function outputManifestDirectories(outputRoot, expectedFiles) {
  const root = path.resolve(outputRoot);
  const directories = new Set([root]);
  for (const file of expectedFiles) {
    let directory = path.dirname(file);
    while (directory.startsWith(root)) {
      directories.add(directory);
      if (directory === root) break;
      directory = path.dirname(directory);
    }
  }
  return directories;
}

async function pruneOutputRoot(outputRoot, expectedFiles) {
  const root = path.resolve(outputRoot);
  const expectedDirectories = outputManifestDirectories(root, expectedFiles);
  const removed = [];
  await fs.mkdir(root, { recursive: true });

  async function removeArtifact(absolute) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await fs.rm(absolute, { recursive: true, force: true });
        return;
      } catch (error) {
        if (!["ENOTEMPTY", "EBUSY", "ENOENT"].includes(error.code) || attempt === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  async function visit(directory) {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute);
      if (isNumberedConflictArtifact(entry.name)) {
        await removeArtifact(absolute);
        removed.push(relative);
        continue;
      }
      if (entry.isDirectory()) {
        await visit(absolute);
        if (!expectedDirectories.has(path.resolve(absolute))) {
          await removeArtifact(absolute);
          removed.push(relative);
        }
        continue;
      }
      if (!expectedFiles.has(path.resolve(absolute))) {
        await removeArtifact(absolute);
        removed.push(relative);
      }
    }
  }

  await visit(root);
  return removed;
}

async function numberedConflictArtifacts(outputRoot) {
  const root = path.resolve(outputRoot);
  const conflicts = [];
  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (isNumberedConflictArtifact(entry.name)) conflicts.push(path.relative(root, absolute));
      if (entry.isDirectory()) await visit(absolute);
    }
  }
  await visit(root);
  return conflicts.sort();
}

async function settleOutputRoot(outputRoot, expectedFiles) {
  const removed = new Set();
  for (let pass = 0; pass < 3; pass += 1) {
    for (const item of await pruneOutputRoot(outputRoot, expectedFiles)) removed.add(item);
    if (pass < 2) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return {
    removedStaleArtifacts: [...removed].sort(),
    conflicts: await numberedConflictArtifacts(outputRoot),
  };
}

async function writeOutput({ pages, htmlByUrl, business, markets, services, outputRoot, options }) {
  const sitemapPlan = buildSitemapPlan(business, pages);
  const expectedFiles = outputManifestFiles({ pages, outputRoot, sitemapPlan, business, options });
  const removedBeforeWrite = await pruneOutputRoot(outputRoot, expectedFiles);
  for (const page of pages) {
    await fs.mkdir(path.dirname(page.outFile), { recursive: true });
    await fs.writeFile(page.outFile, htmlByUrl.get(page.urlPath).replace(/[ \t]+$/gm, ""));
  }
  if (options.indexable && business.preview_prefix === "/" && !options.omitIndex) {
    const reportHomepage = path.join(reportsDir, "homepage-index-with-tracking.html");
    const canonicalHomepage = await fs.readFile(
      existsSync(reportHomepage) ? reportHomepage : path.join(siteDir, "index.html"),
      "utf8",
    );
    await fs.writeFile(path.join(outputRoot, "index.html"), canonicalHomepage.replace(/[ \t]+$/gm, ""));
  }
  const parentSitemap = sitemapIndexXml(sitemapPlan);
  await fs.writeFile(path.join(outputRoot, sitemapPlan.indexFilename), parentSitemap);
  await fs.writeFile(path.join(outputRoot, sitemapPlan.indexAliasFilename), parentSitemap);
  for (const family of sitemapPlan.families) {
    const sitemapPages = family.searchFacing === false ? family.allPages : family.searchPages;
    await fs.writeFile(path.join(outputRoot, family.filename), urlsetSitemapXml(business, sitemapPages));
  }
  await fs.copyFile(
    path.join(seoDir, "templates", sitemapStylesheetFilename),
    path.join(outputRoot, sitemapStylesheetFilename),
  );
  for (const asset of sitemapPresentationAssets) {
    const outputFile = path.join(outputRoot, asset.output);
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.copyFile(asset.source, outputFile);
  }
  const llms = llmsTxt({ business, markets, services, pages });
  await fs.writeFile(path.join(outputRoot, "llms.txt"), llms);
  await fs.writeFile(path.join(outputRoot, "LLM.txt"), llms);
  const supplementalSitemaps = options.indexable && !isCommercialSite(business) && normalizePrefix(business.preview_prefix) === "/"
    ? `Sitemap: ${business.primary_domain}/commercial/sitemap.xml\n`
    : "";
  const robots = options.indexable
    ? `# Created and maintained by ${maintainer.url}\nUser-agent: *\nAllow: /\nSitemap: ${business.primary_domain}${makeUrl(business.preview_prefix, ["sitemap.xml"]).replace(/\/$/, "")}\n${supplementalSitemaps}`
    : `# Created and maintained by ${maintainer.url}\nUser-agent: *\nDisallow: /\nSitemap: ${business.primary_domain}${makeUrl(business.preview_prefix, ["sitemap.xml"]).replace(/\/$/, "")}\n`;
  await fs.writeFile(path.join(outputRoot, "robots.txt"), robots);
  for (const [filename, html] of supportPages({ business, pages })) {
    if (!supportPageFilenames(business, options).includes(filename)) continue;
    await fs.writeFile(path.join(outputRoot, filename), `${html.replace(/[ \t]+$/gm, "")}\n`);
  }
  const hygiene = await settleOutputRoot(outputRoot, expectedFiles);
  return {
    ...hygiene,
    removedStaleArtifacts: [...new Set([...removedBeforeWrite, ...hygiene.removedStaleArtifacts])].sort(),
  };
}

export async function loadSeoData({ variant = "residential" } = {}) {
  const [baseBusiness, services, markets, reviews, faqs, sources, siteProfiles] = await Promise.all([
    readJson("data/business.json"),
    readJson("data/services.json"),
    readJson("data/markets.json"),
    readJson("data/reviews.json"),
    readJson("data/faqs/common.json"),
    readJson("data/sources.json"),
    readJson("data/site-profiles.json"),
  ]);
  const profile = siteProfiles[variant];
  if (!profile) throw new Error(`unknown Masterflow site variant: ${variant}`);

  const overlay = variant === "commercial" ? await readJson("data/business-commercial.json") : {};
  const business = mergeObjects(baseBusiness, {
    ...overlay,
    site_variant: variant,
    site_profile: profile,
  });
  const categories = variant === "commercial" ? COMMERCIAL_BLOG_CATEGORIES : BLOG_CATEGORIES;
  const posts = variant === "commercial" ? COMMERCIAL_BLOG_POSTS : BLOG_POSTS;
  const industries = variant === "commercial" ? COMMERCIAL_INDUSTRIES : [];
  return { business, services, markets, reviews, faqs, sources, siteProfiles, profile, categories, posts, industries };
}

export async function buildSeo(rawOptions = {}) {
  const options = { ...parseArgs([]), ...rawOptions };
  const data = await loadSeoData({ variant: options.variant });
  const defaultRoutePrefix = options.indexable
    ? data.profile.route_prefix
    : data.profile.preview_route_prefix;
  data.business = {
    ...data.business,
    preview_prefix: normalizePrefix(options.routePrefix ?? defaultRoutePrefix ?? data.business.preview_prefix),
  };
  const allMarketSlugs = new Set(data.markets.map((market) => market.slug));
  let markets = data.markets;
  let services = data.services;
  if (options.marketSlugs?.length) {
    const wanted = new Set(options.marketSlugs);
    markets = markets.filter((market) => wanted.has(market.slug));
  }
  if (options.serviceSlugs?.length) {
    const wanted = new Set(options.serviceSlugs);
    services = services.filter((service) => wanted.has(service.slug));
  }
  if (!options.full) {
    if (Number.isFinite(options.limitMarkets)) markets = markets.slice(0, options.limitMarkets);
    if (Number.isFinite(options.limitServices)) services = services.slice(0, options.limitServices);
  }

  const dataIssues = validateData({ ...data, markets, services, allMarketSlugs });
  if (dataIssues.length) {
    const report = {
      allPass: false,
      phase: "validate-data",
      dataIssues,
      pipeline: {
        framework: "ValenFramework",
        pattern: "Build -> Match -> Verify -> Execute",
        currentPhase: "usage",
        verifyBeforeExecute: true,
        phaseRecovery: { strategy: "shift_back", targetPhase: "conversion", reason: "data validation failed before build" },
        steps: [
          { name: "build", status: "blocked", evidence: { dataIssues: dataIssues.length } },
          { name: "match", status: "blocked", evidence: {} },
          { name: "verify", status: "fail", evidence: { dataIssues: dataIssues.length } },
          { name: "execute", status: "blocked", evidence: ["no preview file rewrite"] },
        ],
      },
    };
    await writeReport(report, options.variant);
    throw new Error(`data validation failed: ${JSON.stringify(dataIssues.slice(0, 3))}`);
  }
  if (options.validateOnly) {
    return {
      allPass: true,
      phase: "validate-data",
      counts: { business: 1, services: services.length, markets: markets.length, faqs: data.faqs.length, reviews: data.reviews.length },
    };
  }

  const template = await fs.readFile(path.join(seoDir, "templates", "page.eta"), "utf8");
  const adminTemplate = await fs.readFile(path.join(seoDir, "templates", "admin.eta"), "utf8");
  const eta = new Eta({ autoEscape: true });
  const pages = buildPages({ ...data, markets, services, options });
  const htmlByUrl = new Map();
  for (const page of pages) {
    htmlByUrl.set(page.urlPath, await eta.renderString(page.kind === "admin" ? adminTemplate : template, page));
  }

  const sitemapPlan = buildSitemapPlan(data.business, pages);
  const validation = validateRenderedPages({ pages, htmlByUrl, business: data.business, options });
  validation.guards.push({ name: "outputHygiene", pass: true });
  const sitemapLocCount = sitemapPlan.searchEntries.length;
  const needsSupplementalHome = !pages.some((page) => page.urlPath === "/") && productionHomeSitemapEntry(data.business);
  const expectedSitemapLocCount = pages.filter(searchIndexablePage).length + (needsSupplementalHome ? 1 : 0);
  if (sitemapLocCount !== expectedSitemapLocCount) {
    validation.issues.push({ guard: "sitemapParity", expected: expectedSitemapLocCount, actual: sitemapLocCount });
    const sitemapGuard = validation.guards.find((guard) => guard.name === "sitemapParity");
    if (sitemapGuard) sitemapGuard.pass = false;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    allPass: validation.issues.length === 0,
    indexable: options.indexable,
    output: options.out,
    physicalOutput: path.relative(siteDir, generatedOutputRoot(options.out)),
    counts: {
      pages: pages.length,
      cityHubs: markets.length,
      serviceHubs: services.length,
      cityServicePages: isCommercialSite(data.business) ? 0 : markets.length * services.length,
      markets: markets.length,
      services: services.length,
      industries: data.industries.length,
      posts: data.posts.length,
      sitemapUrls: sitemapPlan.searchEntries.length,
      noindexGeneratedPages: pages.filter((page) => !searchIndexablePage(page)).length,
      orphanPublicPages: validation.orphanPublicRoutes.length,
    },
    sitemap: {
      parent: sitemapPlan.indexUrl,
      children: sitemapFamilySummaries(sitemapPlan),
      inventoryReport: reportArtifacts(options.variant).inventoryPath,
    },
    guards: validation.guards,
    issues: validation.issues,
    maxDuplicate: validation.maxDuplicate,
    publicDataSources: data.sources.public_data_sources,
  };
  report.pipeline = pipelineReport({ markets, services, pages, validation, options, sitemapPlan });

  const outputRoot = generatedOutputRoot(options.out);

  if (!report.allPass) {
    await writeReport(report, options.variant);
    throw new Error(`render validation failed: ${JSON.stringify(validation.issues.slice(0, 5))}`);
  }

  const outputHygiene = await writeOutput({ pages, htmlByUrl, business: data.business, markets, services, outputRoot, options });
  report.outputHygiene = outputHygiene;
  if (outputHygiene.conflicts.length) {
    const outputGuard = validation.guards.find((guard) => guard.name === "outputHygiene");
    if (outputGuard) outputGuard.pass = false;
    validation.issues.push({ guard: "outputHygiene", conflicts: outputHygiene.conflicts });
    report.issues = validation.issues;
    report.allPass = false;
    report.pipeline = pipelineReport({ markets, services, pages, validation, options, sitemapPlan });
    await writeReport(report, options.variant);
    throw new Error(`output hygiene failed: ${JSON.stringify(outputHygiene.conflicts.slice(0, 10))}`);
  }
  await writePagesSitemapInventory(
    pagesSitemapInventory({ business: data.business, pages, plan: sitemapPlan, options }),
    options.variant,
  );
  await writeReport(report, options.variant);

  return report;
}

async function main() {
  const options = parseArgs();
  const result = await buildSeo(options);
  if (options.validateOnly) {
    console.log(`data ok: business(1) services(${result.counts.services}) markets(${result.counts.markets}) faqs(${result.counts.faqs}) reviews(${result.counts.reviews})`);
  } else {
    console.log(`rendered ${result.counts.pages} pages -> ${result.output}`);
    console.log(`guards: ${result.guards.filter((guard) => guard.pass).length}/${result.guards.length} PASS`);
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
