import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv from "ajv";
import { Eta } from "eta";

const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const siteDir = path.dirname(seoDir);
const reportsDir = path.join(seoDir, "reports");

const serviceTitleMap = new Map([
  ["water-heater-repair-install", "Water Heater Service"],
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
  };
  for (const arg of argv) {
    if (arg === "--full") opts.full = true;
    else if (arg === "--validate-only") opts.validateOnly = true;
    else if (arg === "--indexable") opts.indexable = true;
    else if (arg.startsWith("--out=")) opts.out = arg.slice("--out=".length);
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
  return `${prefix.replace(/\/$/, "")}/${cleaned.join("/")}${cleaned.length ? "/" : ""}`;
}

function outputFileForUrl(outputRoot, prefix, urlPath) {
  const rel = urlPath.replace(prefix, "").replace(/^\/+/, "");
  if (!rel) return path.join(outputRoot, "index.html");
  return path.join(outputRoot, rel, "index.html");
}

function absoluteMedia(business, mediaPath) {
  return `${business.primary_domain}${mediaPath}`;
}

function nearbyMarkets(market, marketMap) {
  return (market.nearby_slugs ?? []).map((slug) => marketMap.get(slug)).filter(Boolean);
}

function localPhrase(market) {
  return `${market.city} ${market.county} homes around ${sentenceJoin(market.neighborhoods.slice(0, 3))}`;
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
}) {
  const primaryMarket = markets.find((item) => item.slug === "corona") ?? markets[0];
  const primaryService = services.find((item) => item.slug === "emergency-plumbing") ?? services[0];
  const robots = options.indexable ? "index,follow" : "noindex,nofollow";
  return {
    kind,
    urlPath,
    outFile: outputFileForUrl(path.join(siteDir, options.out), business.preview_prefix, urlPath),
    meta: {
      title: smartTrim(metaTitle, 60),
      description: smartTrim(metaDescription, 155),
      robots,
      canonical: `${business.primary_domain}${urlPath}`,
    },
    h1,
    heroCopy,
    eyebrow,
    body,
    business,
    prefix: business.preview_prefix,
    locationLabel: market?.city ?? "Corona",
    primaryMarket,
    primaryService,
    absoluteMedia: (mediaPath) => absoluteMedia(business, mediaPath),
    schema,
  };
}

function localBusinessSchema(business, markets) {
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "Plumber"],
    "@id": `${business.primary_domain}/#localbusiness`,
    name: business.dba ?? business.legal_name,
    legalName: business.legal_name,
    telephone: business.phone,
    url: business.primary_domain,
    image: absoluteMedia(business, business.media.hero),
    priceRange: business.price_range,
    openingHours: business.hours,
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
    areaServed: markets.map((market) => ({
      "@type": "City",
      name: `${market.city}, ${market.state}`,
    })),
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
      item: `${business.primary_domain}${crumb.urlPath}`,
    })),
  };
}

function serviceSchema(business, market, service) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: service.schema_service_type,
    name: `${service.name} in ${market.city}, CA`,
    provider: { "@id": `${business.primary_domain}/#localbusiness` },
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

function processGrid(market, service) {
  return `<div class="process">
    <div class="step"><strong>Call and triage</strong><p>Masterflow starts with the symptom, the fixture or line involved, the ${escapeHtml(market.city)} property type, and the urgency of the ${escapeHtml(service.name.toLowerCase())} call.</p></div>
    <div class="step"><strong>Inspect the real failure</strong><p>The crew checks visible plumbing, access points, shutoffs, water behavior, drain behavior, and property-specific signals before pushing a repair path.</p></div>
    <div class="step"><strong>Explain options</strong><p>Customers get plain-language repair choices, safety notes, likely scope, and pricing before approved work starts whenever job conditions allow it.</p></div>
    <div class="step"><strong>Verify and clean up</strong><p>The work is tested, the area is left clean, and the customer understands what was fixed, what was found, and what to watch next.</p></div>
  </div>`;
}

function cityServiceBody({ business, market, service, marketMap, services, faqs }) {
  const near = nearbyMarkets(market, marketMap);
  const citySignals = market.local_signals.map((signal) => signal.toLowerCase());
  const selectedFaqs = applyFaqTokens(faqs, market, service);
  const media = business.media.gallery[Math.abs(market.slug.length + service.slug.length) % business.media.gallery.length] ?? business.media.proof;
  const cityServiceCards = [
    {
      title: `${market.city} property fit`,
      text: `${service.name} calls in ${market.city} often involve ${sentenceJoin(citySignals)}. That mix changes how Masterflow checks access, water behavior, drain behavior, and repair risk.`,
    },
    {
      title: `${market.zip_primary} and nearby ZIPs`,
      text: `The generated service plan covers ${market.zips.join(", ")} with special attention to neighborhoods such as ${sentenceJoin(market.neighborhoods.slice(0, 4))}.`,
    },
    {
      title: "Licensed California plumbing",
      text: `${business.license_no} and direct phone ${business.phone_display} stay visible on every local page so NAP and license proof do not drift across microversions.`,
    },
  ];
  return `
    <section id="local-proof" class="local-panel">
      <div>
        <span class="section-kicker">Local fit</span>
        <h2>${escapeHtml(service.name)} built for ${escapeHtml(localPhrase(market))}</h2>
        <p>${escapeHtml(service.long_desc)}</p>
        <p>For ${escapeHtml(market.city)}, the local signals are ${escapeHtml(sentenceJoin(citySignals))}. The page copy is generated from structured city data, service data, public enrichment, and validation reports so every microversion has a reason to exist.</p>
        <div class="chips">
          ${market.neighborhoods.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          ${market.zips.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
        </div>
      </div>
      <div class="media-proof"><img src="${escapeHtml(media)}" alt="Masterflow Plumbing work vehicle and field proof"></div>
    </section>
    <section>
      <span class="section-kicker">Service detail</span>
      <h2>What Masterflow checks before ${escapeHtml(service.name.toLowerCase())} in ${escapeHtml(market.city)}</h2>
      <p class="lede">${escapeHtml(service.short_desc)} The goal is to stabilize the issue, avoid unnecessary demolition or upsell pressure, and give the customer a clean repair path.</p>
      ${cardGrid(cityServiceCards)}
    </section>
    <section>
      <span class="section-kicker">Process</span>
      <h2>A practical plumbing workflow for ${escapeHtml(market.city)} calls</h2>
      ${processGrid(market, service)}
    </section>
    <section>
      <span class="section-kicker">Nearby options</span>
      <h2>Related Masterflow pages</h2>
      ${relatedList([
        ...near.slice(0, 4).map((item) => ({
          href: makeUrl(business.preview_prefix, ["locations", item.slug, service.slug]),
          label: `${serviceSeoName(service)} in ${item.city}`,
        })),
        ...services
          .filter((item) => item.slug !== service.slug)
          .slice(0, 4)
          .map((item) => ({
            href: makeUrl(business.preview_prefix, ["locations", market.slug, item.slug]),
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
    <section id="local-proof" class="local-panel">
      <div>
        <span class="section-kicker">City hub</span>
        <h2>Masterflow Plumbing pages for ${escapeHtml(market.city)}, ${escapeHtml(market.state)}</h2>
        <p>${escapeHtml(market.city)} is part of Masterflow's Corona-centered Southern California service map. The city hub keeps service pages organized by real local signals: ${escapeHtml(sentenceJoin(market.local_signals.map((item) => item.toLowerCase())))}.</p>
        <div class="chips">${[...market.neighborhoods, ...market.zips].map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
      </div>
      <div class="media-proof"><img src="${escapeHtml(business.media.proof)}" alt="Masterflow Plumbing field service proof"></div>
    </section>
    <section>
      <span class="section-kicker">Services</span>
      <h2>Localized plumbing services in ${escapeHtml(market.city)}</h2>
      ${cardGrid(
        services.map((service) => ({
          title: service.name,
          text: `${service.short_desc} This ${market.city} page ties the service to ${sentenceJoin(market.neighborhoods.slice(0, 3))} and ${market.county} routing.`,
          href: makeUrl(business.preview_prefix, ["locations", market.slug, service.slug]),
          linkText: `Open ${service.name}`,
        })),
      )}
    </section>
    <section>
      <span class="section-kicker">Neighboring hubs</span>
      <h2>Nearby service-area pages</h2>
      ${relatedList(near.map((item) => ({ href: makeUrl(business.preview_prefix, ["locations", item.slug]), label: `${item.city} plumbing hub` })))}
    </section>
  `;
}

function serviceHubBody({ business, service, markets }) {
  const priorityMarkets = markets.slice(0, 12);
  return `
    <section id="local-proof" class="local-panel">
      <div>
        <span class="section-kicker">Service hub</span>
        <h2>${escapeHtml(service.name)} across the Corona-centered service area</h2>
        <p>${escapeHtml(service.long_desc)}</p>
        <p>This hub fans out into city-specific pages so ${escapeHtml(service.name.toLowerCase())} copy can account for ZIPs, neighborhoods, property mix, and local plumbing risks instead of repeating one generic paragraph everywhere.</p>
      </div>
      <div class="media-proof"><img src="${escapeHtml(business.media.proof)}" alt="Masterflow Plumbing service proof"></div>
    </section>
    <section>
      <span class="section-kicker">Local pages</span>
      <h2>${escapeHtml(service.name)} by city</h2>
      ${cardGrid(
        priorityMarkets.map((market) => ({
          title: `${serviceSeoName(service)} in ${market.city}`,
          text: `Generated from ${market.city} data, ${market.county} routing, neighborhoods including ${sentenceJoin(market.neighborhoods.slice(0, 3))}, and Masterflow service rules.`,
          href: makeUrl(business.preview_prefix, ["locations", market.slug, service.slug]),
          linkText: `Open ${market.city}`,
        })),
      )}
      ${relatedList(
        markets.slice(12).map((market) => ({
          href: makeUrl(business.preview_prefix, ["locations", market.slug, service.slug]),
          label: `${market.city} ${serviceSeoName(service)}`,
        })),
      )}
    </section>
  `;
}

function indexBody({ business, markets, services }) {
  return `
    <section id="local-proof" class="local-panel">
      <div>
        <span class="section-kicker">Private SEO preview</span>
        <h2>Masterflow localized SEO engine directory</h2>
        <p>This preview is generated from structured business, service, market, FAQ, review, and enrichment data. It is intentionally noindex until William approves live activation.</p>
        <div class="chips"><span>${markets.length} city hubs</span><span>${services.length} service hubs</span><span>${markets.length * services.length} city-service pages</span><span>${business.license_no}</span></div>
      </div>
      <div class="media-proof"><img src="${escapeHtml(business.media.hero)}" alt="Masterflow Plumbing truck proof"></div>
    </section>
    <section>
      <span class="section-kicker">Cities</span>
      <h2>Generated local plumbing hubs</h2>
      ${cardGrid(
        markets.map((market) => ({
          title: `${market.city}, ${market.state}`,
          text: `${market.county} hub with ZIPs ${market.zips.join(", ")} and local signals: ${sentenceJoin(market.local_signals.map((item) => item.toLowerCase()))}.`,
          href: makeUrl(business.preview_prefix, ["locations", market.slug]),
          linkText: "Open city hub",
        })),
      )}
    </section>
    <section>
      <span class="section-kicker">Services</span>
      <h2>Generated service hubs</h2>
      ${cardGrid(
        services.map((service) => ({
          title: service.name,
          text: service.short_desc,
          href: makeUrl(business.preview_prefix, ["services", service.slug]),
          linkText: "Open service hub",
        })),
      )}
    </section>
  `;
}

function buildPages({ business, markets, services, faqs, options }) {
  const marketMap = new Map(markets.map((market) => [market.slug, market]));
  const localBusiness = localBusinessSchema(business, markets);
  const pages = [];

  pages.push(
    pageShell({
      kind: "index",
      urlPath: makeUrl(business.preview_prefix),
      metaTitle: "Masterflow Plumbing SEO Preview Directory",
      metaDescription: "Private noindex preview of localized Masterflow Plumbing city and service pages for validation before live SEO activation.",
      h1: "Masterflow localized plumbing SEO preview",
      heroCopy: "A private, noindex directory of city and service micro-pages generated from structured Masterflow data, public region signals, and validation gates.",
      eyebrow: "Private preview",
      body: indexBody({ business, markets, services }),
      business,
      markets,
      services,
      schema: [localBusiness, breadcrumbSchema(business, [{ name: "SEO Preview", urlPath: makeUrl(business.preview_prefix) }])],
      options,
    }),
  );

  for (const market of markets) {
    pages.push(
      pageShell({
        kind: "city",
        urlPath: makeUrl(business.preview_prefix, ["locations", market.slug]),
        metaTitle: `Plumber in ${market.city}, CA | Masterflow`,
        metaDescription: `Masterflow Plumbing ${market.city} hub for emergency plumbing, drains, water heaters, leaks, sewer lines, and repair planning.`,
        h1: `Plumber in ${market.city}, CA`,
        heroCopy: `Masterflow Plumbing serves ${market.city}, ${market.county}, including ${sentenceJoin(market.neighborhoods.slice(0, 3))}.`,
        eyebrow: `${market.county} service hub`,
        body: cityHubBody({ business, market, marketMap, services }),
        business,
        markets,
        services,
        market,
        service: services[0],
        schema: [
          localBusiness,
          breadcrumbSchema(business, [
            { name: "SEO Preview", urlPath: makeUrl(business.preview_prefix) },
            { name: market.city, urlPath: makeUrl(business.preview_prefix, ["locations", market.slug]) },
          ]),
        ],
        options,
      }),
    );
  }

  for (const service of services) {
    pages.push(
      pageShell({
        kind: "service",
        urlPath: makeUrl(business.preview_prefix, ["services", service.slug]),
        metaTitle: `${serviceSeoName(service)} | Masterflow Plumbing`,
        metaDescription: `${service.short_desc} Private noindex service hub for localized Masterflow Plumbing SEO validation.`,
        h1: `${service.name} service area`,
        heroCopy: `${service.short_desc} This hub links every ${service.name.toLowerCase()} city micro-page in the Masterflow service map.`,
        eyebrow: "Service hub",
        body: serviceHubBody({ business, service, markets }),
        business,
        markets,
        services,
        market: markets[0],
        service,
        schema: [
          localBusiness,
          breadcrumbSchema(business, [
            { name: "SEO Preview", urlPath: makeUrl(business.preview_prefix) },
            { name: service.name, urlPath: makeUrl(business.preview_prefix, ["services", service.slug]) },
          ]),
        ],
        options,
      }),
    );
  }

  for (const market of markets) {
    for (const service of services) {
      const selectedFaqs = applyFaqTokens(faqs, market, service);
      pages.push(
        pageShell({
          kind: "city-service",
          urlPath: makeUrl(business.preview_prefix, ["locations", market.slug, service.slug]),
          metaTitle: `${serviceSeoName(service)} in ${market.city}, CA | Masterflow`,
          metaDescription: `${service.short_desc} Call ${business.phone_display}. ${business.license_no}. Local ${market.city} plumbing service.`,
          h1: `${service.name} in ${market.city}, CA`,
          heroCopy: `Licensed Masterflow help for ${service.name.toLowerCase()} in ${market.city}, ${market.county}, with local routing around ${sentenceJoin(market.neighborhoods.slice(0, 3))}.`,
          eyebrow: `${market.city} ${service.name}`,
          body: cityServiceBody({ business, market, service, marketMap, services, faqs }),
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
              { name: "SEO Preview", urlPath: makeUrl(business.preview_prefix) },
              { name: market.city, urlPath: makeUrl(business.preview_prefix, ["locations", market.slug]) },
              { name: service.name, urlPath: makeUrl(business.preview_prefix, ["locations", market.slug, service.slug]) },
            ]),
          ],
          options,
        }),
      );
    }
  }
  return pages;
}

function validateData({ business, markets, services, reviews, faqs }) {
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
  const serviceSlugs = new Set(services.map((service) => service.slug));
  for (const market of markets) {
    for (const nearby of market.nearby_slugs ?? []) {
      if (!marketSlugs.has(nearby)) issues.push({ scope: `market:${market.slug}`, errors: [{ message: `nearby_slug ${nearby} is not defined` }] });
    }
  }
  for (const review of reviews) {
    if (review.city_slug && !marketSlugs.has(review.city_slug)) issues.push({ scope: "reviews", errors: [{ message: `review city_slug ${review.city_slug} is not defined` }] });
    if (review.service_slug && !serviceSlugs.has(review.service_slug)) issues.push({ scope: "reviews", errors: [{ message: `review service_slug ${review.service_slug} is not defined` }] });
    if (review.consented !== true) issues.push({ scope: "reviews", errors: [{ message: "review is not consented" }] });
  }
  if (!Array.isArray(faqs) || faqs.length < 4) issues.push({ scope: "faqs", errors: [{ message: "expected at least four common FAQs" }] });
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
    if (href?.startsWith(prefix)) hrefs.push(href);
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

function validateRenderedPages({ pages, htmlByUrl, business }) {
  const pageUrlSet = new Set(pages.map((page) => page.urlPath));
  const titles = new Map();
  const descriptions = new Map();
  const guards = [];
  const issues = [];

  let sitemapLocs = 0;
  let maxDuplicate = { score: 0, a: "", b: "" };
  const shingled = [];

  for (const page of pages) {
    const html = htmlByUrl.get(page.urlPath);
    const mainText = mainTextFromHtml(html);
    const wordCount = mainText.split(/\s+/).filter(Boolean).length;
    const minWords = page.kind === "city-service" ? 520 : page.kind === "index" ? 260 : 300;
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
    if (!html.includes('noindex,nofollow')) issues.push({ guard: "previewNoindex", urlPath: page.urlPath });

    for (const href of internalHrefs(html, business.preview_prefix)) {
      const normalized = href.endsWith("/") ? href : `${href}/`;
      if (!pageUrlSet.has(normalized) && !normalized.endsWith("/sitemap.xml/")) issues.push({ guard: "links", urlPath: page.urlPath, href });
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

  const guardNames = ["wordCount", "meta", "uniqueMeta", "nap", "previewNoindex", "links", "jsonLd", "badString", "noPii", "duplicateRisk", "sitemapParity"];
  for (const guardName of guardNames) {
    guards.push({
      name: guardName,
      pass: !issues.some((issue) => issue.guard === guardName),
    });
  }
  return { guards, issues, maxDuplicate, sitemapLocs };
}

function sitemapXml(business, pages) {
  const locs = pages
    .map((page) => `  <url><loc>${business.primary_domain}${page.urlPath}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs}\n</urlset>\n`;
}

async function writeReport(report) {
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.writeFile(path.join(reportsDir, "build-report.json"), `${JSON.stringify(report, null, 2)}\n`);
}

function pipelineReport({ markets, services, pages, validation, options }) {
  const verifyPass = validation.issues.length === 0;
  return {
    framework: "ValenFramework",
    pattern: "Build -> Match -> Verify -> Execute",
    currentPhase: "usage",
    verifyBeforeExecute: true,
    phaseRecovery: verifyPass
      ? { strategy: "none", targetPhase: "usage" }
      : { strategy: "shift_back", targetPhase: "conversion", reason: "render verification blocked publish-side effects" },
    dualSurfaceState: {
      desktop3d: "runtime card can ingest seo/reports/build-report.json",
      fieldTablet: "private GUI route /masterflow-seo reads the same report",
    },
    runtimeBridge: {
      action: "masterflow.seo.report.ingest",
      payloadPath: "seo/reports/build-report.json",
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
          ? ["write noindex preview files", "write robots.txt and sitemap.xml", "emit build-report.json"]
          : ["write build-report.json only", "skip preview file rewrite until verification passes"],
      },
    ],
  };
}

async function writeOutput({ pages, htmlByUrl, business, outputRoot }) {
  await fs.rm(outputRoot, { recursive: true, force: true });
  for (const page of pages) {
    await fs.mkdir(path.dirname(page.outFile), { recursive: true });
    await fs.writeFile(page.outFile, htmlByUrl.get(page.urlPath));
  }
  await fs.writeFile(path.join(outputRoot, "sitemap.xml"), sitemapXml(business, pages));
  await fs.writeFile(path.join(outputRoot, "robots.txt"), `User-agent: *\nDisallow: /\nSitemap: ${business.primary_domain}${business.preview_prefix}/sitemap.xml\n`);
}

export async function loadSeoData() {
  const [business, services, markets, reviews, faqs, sources] = await Promise.all([
    readJson("data/business.json"),
    readJson("data/services.json"),
    readJson("data/markets.json"),
    readJson("data/reviews.json"),
    readJson("data/faqs/common.json"),
    readJson("data/sources.json"),
  ]);
  return { business, services, markets, reviews, faqs, sources };
}

export async function buildSeo(rawOptions = {}) {
  const options = { ...parseArgs([]), ...rawOptions };
  const data = await loadSeoData();
  let markets = data.markets;
  let services = data.services;
  if (!options.full) {
    if (Number.isFinite(options.limitMarkets)) markets = markets.slice(0, options.limitMarkets);
    if (Number.isFinite(options.limitServices)) services = services.slice(0, options.limitServices);
  }

  const dataIssues = validateData({ ...data, markets, services });
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
    await writeReport(report);
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
  const eta = new Eta({ autoEscape: true });
  const pages = buildPages({ ...data, markets, services, options });
  const htmlByUrl = new Map();
  for (const page of pages) {
    htmlByUrl.set(page.urlPath, await eta.renderString(template, page));
  }

  const validation = validateRenderedPages({ pages, htmlByUrl, business: data.business });
  const sitemapLocCount = (sitemapXml(data.business, pages).match(/<loc>/g) ?? []).length;
  if (sitemapLocCount !== pages.length) {
    validation.issues.push({ guard: "sitemapParity", expected: pages.length, actual: sitemapLocCount });
    const sitemapGuard = validation.guards.find((guard) => guard.name === "sitemapParity");
    if (sitemapGuard) sitemapGuard.pass = false;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    allPass: validation.issues.length === 0,
    indexable: options.indexable,
    output: options.out,
    counts: {
      pages: pages.length,
      cityHubs: markets.length,
      serviceHubs: services.length,
      cityServicePages: markets.length * services.length,
      markets: markets.length,
      services: services.length,
    },
    guards: validation.guards,
    issues: validation.issues,
    maxDuplicate: validation.maxDuplicate,
    publicDataSources: data.sources.public_data_sources,
  };
  report.pipeline = pipelineReport({ markets, services, pages, validation, options });

  const outputRoot = path.join(siteDir, options.out);

  if (!report.allPass) {
    await writeReport(report);
    throw new Error(`render validation failed: ${JSON.stringify(validation.issues.slice(0, 5))}`);
  }

  await writeOutput({ pages, htmlByUrl, business: data.business, outputRoot });
  await writeReport(report);

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
