import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BLOG_CATEGORIES } from "../content/blog-categories.mjs";
import { BLOG_POSTS } from "../content/blog-posts.mjs";
import { buildSeo, loadSeoData } from "./build.mjs";
import { createSeoServer } from "./server.mjs";

const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const siteDir = path.dirname(seoDir);

function generatedFile(file) {
  const [root, ...rest] = file.split("/");
  if (!["seo-preview", "seo-production"].includes(root)) return file;
  return path.join(".generated.nosync", root, ...rest);
}

async function read(file) {
  return fs.readFile(path.join(siteDir, generatedFile(file)), "utf8");
}

async function numberedConflictArtifacts(relativeRoot) {
  const root = path.join(siteDir, generatedFile(relativeRoot));
  const conflicts = [];
  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (/ \d+(?:\.[^.]+)?$/.test(entry.name)) conflicts.push(path.relative(root, absolute));
      if (entry.isDirectory()) await visit(absolute);
    }
  }
  await visit(root);
  return conflicts.sort();
}

async function withServer(server, fn) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function assertNoLegacyAssets(html, label) {
  const legacy = [
    "storage.googleapis",
    "masterflowplumbing.com",
    "masterflow-plumbing-murrieta-2",
    "909-272-5456",
    "1085831",
    "masterflow-truck-wrap",
    "Masterflow Plumbing & Rooter",
    "Masterflow Plumbing &amp; Rooter",
    "Masterflow Plumbing and Rooter",
  ];
  for (const bad of legacy) assert.equal(html.includes(bad), false, `${label} contains legacy asset/data string ${bad}`);
}

function sectionImageSources(html, sectionId) {
  const section = html.match(new RegExp(`<section[^>]+id="${sectionId}"[\\s\\S]*?<\\/section>`))?.[0] ?? "";
  return [...section.matchAll(/<img[^>]+src="([^"]+)"/g)].map((match) => match[1]);
}

function heroBackgroundMedia(html) {
  return html.match(/url\("([^"\n]+)"\) center\/cover/)?.[1] ?? "";
}

const data = await loadSeoData();
const report = await buildSeo({ full: true, out: "seo-preview", indexable: false });
const staticPages = 7; // index, about, services, service-area, contact, reviews, and private admin/maintenance.
const blogPages = 1 + 45 + 6; // Blog index, 45 articles, and six category pages.
const expectedPages = staticPages + blogPages + data.markets.length + data.services.length + data.markets.length * data.services.length;

assert.equal(report.allPass, true, "build report must pass all guards");
assert.equal(report.indexable, false, "preview builds must stay noindex");
assert.equal(report.pipeline.framework, "ValenFramework", "build report exposes ValenFramework pipeline");
assert.equal(report.pipeline.pattern, "Build -> Match -> Verify -> Execute");
assert.equal(report.pipeline.verifyBeforeExecute, true);
assert.equal(report.pipeline.runtimeBridge.payloadPath, "seo/reports/build-report.json");
assert.equal(report.pipeline.steps.at(-1).status, "ready", "execute phase is ready only after verification");
assert.equal(report.counts.pages, expectedPages, "page count must match market/service cross product");
assert.equal(report.counts.cityServicePages, data.markets.length * data.services.length);
assert.equal(report.counts.orphanPublicPages, 0, "preview build must not report public-route orphans");
assert.equal(report.physicalOutput, ".generated.nosync/seo-preview");
assert.deepEqual(data.business.offers, {
  emergency_service_24_7: true,
  same_day_service_available: true,
  financing_available: true,
  upfront_pricing: true,
  service_guarantee: true,
}, "the complete approved offer set must remain in the business record");
assert.equal(data.business.name, "Masterflow Plumbing");
assert.equal(data.business.dba, "Masterflow Plumbing");
assert.deepEqual(data.business.alternate_names, ["Masterflow Plumbing"]);
assert.deepEqual(report.outputHygiene.conflicts, [], "preview output must not contain numbered File Provider conflict artifacts");
assert.deepEqual(await numberedConflictArtifacts("seo-preview"), [], "preview tree must stay free of numbered conflict artifacts");
assert.ok(report.counts.cityServicePages >= 72, "first 90-day asset target must be represented");

const indexHtml = await read("seo-preview/index.html");
const homepageArtifactHtml = await read("seo/reports/homepage-index-with-tracking.html");
const aboutHtml = await read("seo-preview/about/index.html");
const servicesIndexHtml = await read("seo-preview/services/index.html");
const serviceAreaIndexHtml = await read("seo-preview/service-area/index.html");
const contactHtml = await read("seo-preview/contact/index.html");
const reviewsHtml = await read("seo-preview/reviews/index.html");
const blogHtml = await read("seo-preview/blog/index.html");
const samplePostHtml = await read("seo-preview/blog/what-to-do-when-a-pipe-bursts/index.html");
const sampleCategoryHtml = await read("seo-preview/category/emergency-and-maintenance/index.html");
const blogPostHeroMedia = await Promise.all(
  BLOG_POSTS.map(async (post) => heroBackgroundMedia(await read(`seo-preview/blog/${post.slug}/index.html`))),
);
const blogCategoryHeroMedia = await Promise.all(
  BLOG_CATEGORIES.map(async (category) => heroBackgroundMedia(await read(`seo-preview/category/${category.slug}/index.html`))),
);
const serviceHeroMedia = await Promise.all(
  data.services.map(async (service) => heroBackgroundMedia(await read(`seo-preview/services/${service.slug}/index.html`))),
);
const coronaHub = await read("seo-preview/locations/corona/index.html");
const lakeElsinoreHub = await read("seo-preview/locations/lake-elsinore/index.html");
const riversideEmergency = await read("seo-preview/locations/riverside/emergency-plumbing/index.html");
const lakeElsinoreEmergency = await read("seo-preview/locations/lake-elsinore/emergency-plumbing/index.html");
const lakeElsinoreDrainCleaning = await read("seo-preview/locations/lake-elsinore/drain-cleaning/index.html");
const riversideDrainCleaning = await read("seo-preview/locations/riverside/drain-cleaning/index.html");
const perrisDrainCleaning = await read("seo-preview/locations/perris/drain-cleaning/index.html");
const perrisHub = await read("seo-preview/locations/perris/index.html");
const morenoValleyHub = await read("seo-preview/locations/moreno-valley/index.html");
const riversideHub = await read("seo-preview/locations/riverside/index.html");
const murrietaDrain = await read("seo-preview/locations/murrieta/drain-cleaning/index.html");
const robots = await read("seo-preview/robots.txt");
const sitemapIndex = await read("seo-preview/sitemap.xml");
const sitemapIndexAlias = await read("seo-preview/sitemap_index.xml");
const pageSitemap = await read("seo-preview/page-sitemap.xml");
const servicesSitemap = await read("seo-preview/services-sitemap.xml");
const serviceAreaSitemap = await read("seo-preview/areas_we_serve-sitemap.xml");
const postSitemap = await read("seo-preview/post-sitemap.xml");
const categorySitemap = await read("seo-preview/category-sitemap.xml");
const adminSitemap = await read("seo-preview/admin-sitemap.xml");
const deployScript = await read("seo/engine/deploy-r2-preview.mjs");
const siteApiWorker = await read("review-worker/src/worker.js");
const siteApiMigration = await read("review-worker/migrations/0002_service_requests_and_reviewer_contacts.sql");
const reviewModerationScript = await read("review-worker/scripts/moderate-reviews.mjs");
const pagesSitemapInventory = JSON.parse(await read("seo/reports/pages-sitemap.json"));

assert.match(indexHtml, /noindex,nofollow/);
assert.match(indexHtml, /<link rel="icon" type="image\/png" href="\/media\/masterflow-logo-20260704\.png">/);
assert.match(indexHtml, /<img src="\/media\/masterflow-logo-20260704\.png" alt="Masterflow Plumbing logo"/);
assert.match(indexHtml, /href="\/seo-preview\/about\/"/);
assert.match(indexHtml, /href="\/seo-preview\/services\/"/);
assert.match(indexHtml, /href="\/seo-preview\/service-area\/"/);
assert.match(indexHtml, /href="\/seo-preview\/blog\/">Blog<\/a>/);
assert.match(indexHtml, /Request Service/);
assert.match(indexHtml, /Drain and sewer/);
assert.match(indexHtml, /href="\/seo-preview\/reviews\/"/);
assert.match(aboutHtml, /About Masterflow Plumbing/);
assert.match(aboutHtml, /The company behind the Masterflow trucks/);
assert.match(aboutHtml, /Same-Day Service Available/);
assert.match(aboutHtml, /Upfront Pricing/);
assert.match(aboutHtml, /Work Backed by Masterflow/);
assert.match(servicesIndexHtml, /Masterflow Plumbing Services/);
assert.match(servicesIndexHtml, /We give you upfront pricing before work starts/);
assert.match(serviceAreaIndexHtml, /Masterflow Plumbing Service Areas/);
assert.match(serviceAreaIndexHtml, /High-priority service areas/);
assert.match(contactHtml, /Contact Masterflow Plumbing/);
assert.match(contactHtml, /What to tell us when you call/);
assert.match(contactHtml, /id="request-service"/);
assert.match(contactHtml, /action="https:\/\/masterflowplumbing\.us\/api\/request-service"/);
assert.match(contactHtml, /name="customerName"/);
assert.match(contactHtml, /name="phone" type="tel"[^>]+required/);
assert.match(contactHtml, /name="consentContact" required/);
assert.match(contactHtml, /data-form-kind="request"/);
assert.match(homepageArtifactHtml, /<section class="hero" id="hero">/);
assert.match(homepageArtifactHtml, /<link rel="icon" type="image\/png" href="\.\.\/\.\.\/media\/masterflow-logo-20260704\.png">/);
assert.match(homepageArtifactHtml, /<img src="\.\.\/\.\.\/media\/masterflow-logo-20260704\.png" alt="Masterflow Plumbing logo"/);
assert.match(homepageArtifactHtml, /<details class="service-menu" data-service-menu>/);
assert.match(homepageArtifactHtml, /<strong>Commercial services<\/strong>/);
assert.match(homepageArtifactHtml, /href="\/services\/hydro-jetting"/);
assert.match(homepageArtifactHtml, /serviceMenu\.addEventListener\("pointerenter"/);
assert.match(homepageArtifactHtml, /serviceMenu\.addEventListener\("keydown"/);
assert.match(indexHtml, /<details class="service-menu" data-service-menu>/);
assert.match(indexHtml, /serviceMenu\.addEventListener\("pointerenter"/);
assert.match(indexHtml, /serviceMenu\.addEventListener\("keydown"/);
assert.match(homepageArtifactHtml, /<a class="navlink" href="\/service-area">Service Area<\/a>/);
assert.ok((homepageArtifactHtml.match(/href="\/blog\/"/g) ?? []).length >= 3, "Blog must be visible in desktop, mobile, and footer navigation");
assert.ok((homepageArtifactHtml.match(/>Blog<\/a>/g) ?? []).length >= 3, "Blog label must stay congruent across canonical navigation surfaces");
assert.match(homepageArtifactHtml, /<a class="request-pill" href="\/contact\/#request-service">Request Service<\/a>/);
assert.doesNotMatch(homepageArtifactHtml, /<button class="navlink" type="button" data-target="services">Services<\/button>|data-target="commercial"|data-target="payment">Estimates/);
assert.match(homepageArtifactHtml, /<aside class="proof-strip"/);
assert.match(homepageArtifactHtml, /What to expect/);
assert.match(homepageArtifactHtml, /Plumbing services/);
assert.match(homepageArtifactHtml, /What waiting can cost/);
assert.match(homepageArtifactHtml, /Honest Estimates\. No Surprises\./);
assert.match(homepageArtifactHtml, /Same-day service is available/);
assert.match(homepageArtifactHtml, /Upfront pricing and financing/);
assert.match(homepageArtifactHtml, /warranty or guarantee/);
assert.match(homepageArtifactHtml, /"addressLocality": "Corona"/);
assert.match(homepageArtifactHtml, /https:\/\/www\.yelp\.com\/biz\/masterflow-plumbing-lake-elsinore/);
assert.doesNotMatch(homepageArtifactHtml, /hero-video|masterflow-plumbing-murrieta-2|"addressLocality": "Murrieta"/);
assert.doesNotMatch(homepageArtifactHtml, /src="media\/|poster="media\/|href="\/media\/masterflow-logo|Family-owned|fully licensed and insured|within the hour|repair path|dispatch machine|hidden fees|Fast, Reliable Service|Quality Workmanship|Proudly serving Corona|What happens next|How service works|closest to the problem|close to the decision|Call for the Next Step|Scope Explained First|cannot wait|what is happening|actual failure|before approved work|fastest practical next step/i);
const homepageServiceImages = sectionImageSources(homepageArtifactHtml, "services");
const homepageFieldImages = sectionImageSources(homepageArtifactHtml, "field-work");
assert.equal(homepageServiceImages.length, 7, "homepage service grid keeps seven problem-led entries");
assert.equal(new Set(homepageServiceImages).size, homepageServiceImages.length, "homepage service grid must not reuse images");
assert.ok(homepageFieldImages.length >= 18, "homepage field-work gallery must show the recovered job-site range");
assert.equal(new Set(homepageFieldImages).size, homepageFieldImages.length, "homepage field-work gallery must not duplicate images");
assert.match(deployScript, /extensionlessKey/);
assert.match(deployScript, /slashKey\.replace\(\/\\\/\$\/, ""\)/);
assert.match(deployScript, /generatedSourceRoot/, "deploy must read from the clean physical output tree");
assert.match(deployScript, /cwd: sourceRoot/, "deploy must glob from inside the hidden generated output root");
assert.match(deployScript, /dot: true/, "deploy must include files below the hidden generated output root");
assert.match(deployScript, /relUnderRoot === "index\.html"/, "deploy must update the canonical bucket-root alias");
assert.match(deployScript, /hasNumberedConflictSegment/, "deploy must reject numbered File Provider conflict paths");
assert.match(deployScript, /process\.env\.VALEN_WRANGLER_EMAIL/, "deploy must support an explicitly approved Valen CDN operator identity");
assert.match(deployScript, /text\.includes\(accountId\)/, "deploy must keep the Valen clients CDN account-id guard");
const liveVerifyScript = await read("seo/engine/verify-live-release.mjs");
assert.match(liveVerifyScript, /pageLedger\.pages/, "live verification must check every generated page");
assert.match(liveVerifyScript, /comparableLiveBytes\.equals\(comparableLocalBytes\)/, "live verification must compare normalized release bytes");
assert.match(liveVerifyScript, /jsd\|precursor/, "live verification must recognize both known Cloudflare challenge injections");
assert.match(liveVerifyScript, /pageLedger\.sitemapFamilies/, "live verification must check every sitemap family");
assert.match(liveVerifyScript, /privacy\.html.*terms\.html.*sitemap\.html/s, "live verification must check generated support pages");
assert.match(liveVerifyScript, /walkFiles\(path\.join\(siteDir, "media"\)\)/, "live verification must check published media");
assert.match(reviewsHtml, /Masterflow Plumbing Reviews/);
assert.match(reviewsHtml, /Real Masterflow customer feedback/);
assert.match(reviewsHtml, /Leave a Review/);
assert.match(reviewsHtml, /action="https:\/\/masterflowplumbing\.us\/api\/reviews"/);
assert.match(reviewsHtml, /name="reviewerEmail" type="email"[^>]+required/);
assert.match(reviewsHtml, /status = 'approved'|customer-submitted-reviews/);
assert.match(reviewsHtml, /will stay off the site until it is approved/);
assert.match(reviewsHtml, /https:\/\/www\.yelp\.com\/biz\/masterflow-plumbing-lake-elsinore/);
assert.doesNotMatch(reviewsHtml, /masterflow-plumbing-murrieta-2/);
assert.doesNotMatch(reviewsHtml, /service_slug|city_slug/);
assert.match(siteApiWorker, /sales@masterflowplumbing\.us/);
assert.match(siteApiWorker, /INSERT INTO service_requests/);
assert.match(siteApiWorker, /WHERE status = 'approved' AND consent_display = 1/);
assert.match(siteApiMigration, /CREATE TABLE IF NOT EXISTS service_requests/);
assert.match(siteApiMigration, /reviewer_email/);
assert.match(reviewModerationScript, /action === "approve"/);
assert.match(reviewModerationScript, /consent_display = 1/);
assert.match(blogHtml, /Masterflow Plumbing Guides/);
assert.equal(BLOG_POSTS.length, 45, "the article library must contain all 45 planned guides");
assert.match(blogHtml, /<h2>Popular plumbing guides<\/h2>/);
assert.match(samplePostHtml, /What to Do When a Pipe Bursts/);
assert.match(samplePostHtml, /Have these details ready/);
assert.match(sampleCategoryHtml, /Emergency and Maintenance/);
assert.ok(new Set(blogPostHeroMedia).size >= 10, "the article library must use a broad set of topic-relevant hero images");
assert.equal(new Set(blogCategoryHeroMedia).size, BLOG_CATEGORIES.length, "every blog category must have a distinct hero image");
assert.ok(new Set(serviceHeroMedia).size >= 7, "service heroes must use more than the same small image set");
assert.match(coronaHub, /<title>Plumber in Corona, CA \| Masterflow<\/title>/);
assert.match(coronaHub, /<h1>Plumber in Corona, CA<\/h1>/);
assert.doesNotMatch(coronaHub, /<h1>Emergency Plumber in Corona, CA<\/h1>/);
assert.match(lakeElsinoreHub, /<title>Plumber in Lake Elsinore, CA \| Masterflow<\/title>/);
assert.match(lakeElsinoreHub, /<h1>Plumber in Lake Elsinore, CA<\/h1>/);
assert.doesNotMatch(lakeElsinoreHub, /<h1>Emergency Plumber in Lake Elsinore, CA<\/h1>/);
assert.match(riversideEmergency, /<title>24\/7 Emergency Plumber in Riverside, CA \| Masterflow<\/title>/);
assert.match(riversideEmergency, /<h1>Emergency Plumber in Riverside, CA<\/h1>/);
assert.doesNotMatch(riversideEmergency, /<title>Emergency Plumbing in Riverside, CA \| Masterflow<\/title>|<h1>Emergency Plumbing in Riverside, CA<\/h1>/);
assert.match(lakeElsinoreEmergency, /<title>24\/7 Emergency Plumber in Lake Elsinore, CA \| Masterflow<\/title>/);
assert.match(lakeElsinoreEmergency, /<h1>Emergency Plumber in Lake Elsinore, CA<\/h1>/);
assert.match(lakeElsinoreEmergency, /Need an emergency plumber in Lake Elsinore\?/);
assert.match(lakeElsinoreEmergency, /Call 951-612-7912/);
assert.doesNotMatch(lakeElsinoreEmergency, /24\/7 plumbing, drains, sewer, leaks, hydro jetting, camera inspections, and water heaters/);
assert.match(lakeElsinoreDrainCleaning, /Clogged drain in Lake Elsinore\?/);
assert.match(lakeElsinoreDrainCleaning, /Call 951-612-7912/);
assert.doesNotMatch(lakeElsinoreDrainCleaning, /24\/7 plumbing, drains, sewer, leaks, hydro jetting, camera inspections, and water heaters/);
assert.match(perrisHub, /Masterflow serves Perris homes, rentals, businesses, and managed properties/);
assert.match(perrisHub, /Tell us which fixture or line is giving you trouble/);
assert.match(perrisHub, /24\/7 Emergency Service/);
assert.match(perrisHub, /Residential &amp; Commercial/);
assert.match(perrisHub, /<a href="tel:9516127912">Call 951-612-7912<\/a>/);
assert.match(morenoValleyHub, /Masterflow serves Moreno Valley homes, rentals, businesses, and managed properties/);
assert.match(morenoValleyHub, /Rancho Belago, Sunnymead Ranch, Hidden Springs, Towngate and Sunnymead/);
assert.doesNotMatch(morenoValleyHub, /practical scheduling, clear estimates, and clean workmanship/i);
assert.match(riversideHub, /Serving Riverside &amp; the Inland Empire/);
assert.match(riversideHub, /Masterflow serves Riverside homes, rentals, businesses, HOAs, and managed properties/);
assert.match(riversideHub, /Orangecrest, Canyon Crest, Mission Grove, La Sierra, Arlington, Wood Streets and Downtown Riverside/);
assert.match(riversideHub, /Call 951-612-7912/);
assert.equal((riversideHub.match(/Commercial Plumbing &amp; Trenchless Sewer Services/g) ?? []).length, 1);
assert.doesNotMatch(riversideHub, /Commercial and trenchless work/);
assert.doesNotMatch(perrisHub, /local signals|generated service plan|microversions|route covers/i);
assert.doesNotMatch(morenoValleyHub, /local signals|generated service plan|microversions|route covers/i);
assert.doesNotMatch(riversideHub, /local signals|generated service plan|microversions|route covers/i);
assert.match(riversideDrainCleaning, /Drain Cleaning for Riverside homes and businesses/);
assert.match(riversideDrainCleaning, /Masterflow serves ZIPs 92501, 92503, 92504, 92505, 92506, 92507, 92508/);
assert.match(riversideDrainCleaning, /Before you call/);
assert.match(riversideDrainCleaning, /Where is the problem\?/);
assert.match(riversideDrainCleaning, /Is anything active\?/);
assert.match(riversideDrainCleaning, /What is easy to reach\?/);
assert.equal((riversideDrainCleaning.match(/Commercial Plumbing &amp; Trenchless Sewer Services/g) ?? []).length, 1);
assert.match(perrisDrainCleaning, /<span class="section-kicker">Areas we serve<\/span>/);
assert.match(perrisDrainCleaning, /Request Service/);
assert.doesNotMatch(riversideDrainCleaning, /local signals|generated service plan|microversions|See local fit|comparison searches|top rated plumber|5 star plumber|Repair path explained/i);
assert.doesNotMatch(perrisDrainCleaning, /local signals|generated service plan|microversions|See local fit|comparison searches|top rated plumber|5 star plumber|Repair path explained/i);
assert.match(murrietaDrain, /Drain Cleaning in Murrieta, CA/);
assert.match(robots, /Disallow: \//);
assert.match(sitemapIndex, /<sitemapindex xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
assert.match(sitemapIndex, /\/seo-preview\/page-sitemap\.xml/);
assert.match(sitemapIndex, /\/seo-preview\/services-sitemap\.xml/);
assert.match(sitemapIndex, /\/seo-preview\/areas_we_serve-sitemap\.xml/);
assert.match(sitemapIndex, /\/seo-preview\/post-sitemap\.xml/);
assert.match(sitemapIndex, /\/seo-preview\/category-sitemap\.xml/);
assert.equal(sitemapIndexAlias, sitemapIndex, "sitemap.xml and sitemap_index.xml must stay identical");
assert.match(pageSitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
assert.match(servicesSitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
assert.match(serviceAreaSitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
assert.match(postSitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
assert.match(categorySitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
assert.match(adminSitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
assert.doesNotMatch(pageSitemap, /<url><loc>/, "preview page sitemap must not expose noindex URLs as search-facing locs");
assert.doesNotMatch(servicesSitemap, /<url><loc>/, "preview services sitemap must not expose noindex URLs as search-facing locs");
assert.doesNotMatch(serviceAreaSitemap, /<url><loc>/, "preview service-area sitemap must not expose noindex URLs as search-facing locs");
assert.doesNotMatch(postSitemap, /<url><loc>/, "preview post sitemap must not expose noindex URLs as search-facing locs");
assert.doesNotMatch(categorySitemap, /<url><loc>/, "preview category sitemap must not expose noindex URLs as search-facing locs");
assert.match(adminSitemap, /<url><loc>/, "developer sitemap logs noindex generated routes");
assert.equal(report.counts.sitemapUrls, 0, "preview search sitemap has no indexable URL locs");
assert.equal(report.counts.noindexGeneratedPages, expectedPages, "preview inventory records every generated page as noindex");
assert.equal(pagesSitemapInventory.counts.generatedPages, expectedPages);
assert.equal(pagesSitemapInventory.counts.noindexPages, expectedPages);
assert.equal(pagesSitemapInventory.counts.searchSitemapUrls, 0);
assert.ok(pagesSitemapInventory.pages.some((page) => page.path === "/seo-preview/locations/lake-elsinore/emergency-plumbing/" && page.sitemapFamily === "admin"));
assert.ok(pagesSitemapInventory.pages.some((page) => page.path === "/seo-preview/locations/lake-elsinore/" && page.sitemapFamily === "areas_we_serve"));
assert.ok(pagesSitemapInventory.pages.some((page) => page.path === "/seo-preview/services/" && page.sitemapFamily === "services"));
assert.ok(pagesSitemapInventory.pages.some((page) => page.path === "/seo-preview/service-area/" && page.sitemapFamily === "areas_we_serve"));
assert.ok(pagesSitemapInventory.pages.some((page) => page.path === "/seo-preview/blog/" && page.sitemapFamily === "post"));
assert.ok(pagesSitemapInventory.pages.some((page) => page.path === "/seo-preview/category/drains-and-sewers/" && page.sitemapFamily === "category"));
assert.ok(pagesSitemapInventory.pages.some((page) => page.path === "/seo-preview/about/" && page.sitemapFamily === "page"));
assert.ok(pagesSitemapInventory.pages.some((page) => page.path === "/seo-preview/contact/" && page.sitemapFamily === "page"));
assert.ok(pagesSitemapInventory.pages.some((page) => page.path === "/seo-preview/reviews/" && page.sitemapFamily === "page"));
assertNoLegacyAssets(indexHtml, "index");
assertNoLegacyAssets(aboutHtml, "about");
assertNoLegacyAssets(servicesIndexHtml, "services index");
assertNoLegacyAssets(serviceAreaIndexHtml, "service area index");
assertNoLegacyAssets(contactHtml, "contact");
assertNoLegacyAssets(reviewsHtml, "reviews");
assertNoLegacyAssets(riversideEmergency, "riverside emergency");
assertNoLegacyAssets(perrisHub, "perris hub");
assertNoLegacyAssets(morenoValleyHub, "moreno valley hub");
assertNoLegacyAssets(riversideHub, "riverside hub");
assertNoLegacyAssets(murrietaDrain, "murrieta drain");
assert.equal(data.reviews.some((review) => "service_slug" in review || "city_slug" in review), false, "reviews must not invent service or city slugs");

await withServer(createSeoServer({ token: "test-token" }), async (baseUrl) => {
  const health = await fetch(`${baseUrl}/health`).then((res) => res.json());
  assert.equal(health.ok, true, "health endpoint ok");
  assert.equal(health.private, true, "server declares private mode");
  assert.equal(health.allPass, true, "health sees passing report");
  assert.equal(health.pipeline.pattern, "Build -> Match -> Verify -> Execute");

  const project = await fetch(`${baseUrl}/api/projects/masterflow`).then((res) => res.json());
  assert.equal(project.ok, true);
  assert.equal(project.counts.markets, data.markets.length);
  assert.equal(project.business.phone_display, data.business.phone_display);
  assert.equal(project.pipeline.runtimeBridge.action, "masterflow.seo.report.ingest");

  const plan = await fetch(`${baseUrl}/api/audos-plan`).then((res) => res.json());
  assert.equal(plan.ok, true);
  assert.ok(plan.hooks_to_reuse.includes("valen-kernel-sem"));
  assert.equal(plan.wrapper_to_add.name, "valen-seo-build-report");
  assert.equal(plan.valen_framework.verify_before_execute, true);

  const preview = await fetch(`${baseUrl}/generator-preview/locations/riverside/emergency-plumbing/`);
  assert.equal(preview.status, 200);
  assert.match(preview.headers.get("x-robots-tag") ?? "", /noindex/);
  assert.equal(preview.headers.get("x-masterflow-preview-source"), "seo-preview");
  assertNoLegacyAssets(await preview.text(), "server preview");
});

const productionReport = await buildSeo({
  full: true,
  out: "seo-production",
  indexable: true,
  routePrefix: "/",
  omitIndex: false,
});
const productionParent = await read("seo-production/sitemap.xml");
const productionParentAlias = await read("seo-production/sitemap_index.xml");
const productionPages = await read("seo-production/page-sitemap.xml");
const productionServices = await read("seo-production/services-sitemap.xml");
const productionAreas = await read("seo-production/areas_we_serve-sitemap.xml");
const productionPosts = await read("seo-production/post-sitemap.xml");
const productionCategories = await read("seo-production/category-sitemap.xml");
const productionAdmin = await read("seo-production/admin-sitemap.xml");
const productionRoot = await read("seo-production/index.html");
const productionPrivacy = await read("seo-production/privacy.html");
const productionTerms = await read("seo-production/terms.html");
const productionHumanSitemap = await read("seo-production/sitemap.html");
const normalizedHomepageArtifact = homepageArtifactHtml.replace(/[ \t]+$/gm, "");

assert.equal(productionReport.allPass, true);
assert.equal(productionReport.counts.sitemapUrls, 101);
assert.equal(productionReport.counts.noindexGeneratedPages, 331);
assert.equal(productionReport.counts.orphanPublicPages, 0, "every public production page must have at least one public inbound link");
assert.equal(productionReport.physicalOutput, ".generated.nosync/seo-production");
assert.deepEqual(productionReport.outputHygiene.conflicts, [], "production output must not contain numbered File Provider conflict artifacts");
assert.deepEqual(await numberedConflictArtifacts("seo-production"), [], "production tree must stay free of numbered conflict artifacts");
assert.equal(productionParentAlias, productionParent);
assert.match(productionParent, /areas_we_serve-sitemap\.xml/);
assert.match(productionParent, /post-sitemap\.xml/);
assert.match(productionParent, /category-sitemap\.xml/);
assert.doesNotMatch(productionParent, /admin-sitemap\.xml|service-area-sitemap\.xml/);
assert.match(productionPages, /https:\/\/masterflowplumbing\.us\/about\/<\/loc>/);
assert.match(productionServices, /https:\/\/masterflowplumbing\.us\/services\/emergency-plumber\/<\/loc>/);
assert.match(productionAreas, /https:\/\/masterflowplumbing\.us\/corona-plumber\/<\/loc>/);
assert.equal((productionPosts.match(/<url><loc>/g) ?? []).length, 46);
assert.equal((productionCategories.match(/<url><loc>/g) ?? []).length, 6);
assert.equal((productionAdmin.match(/<url><loc>/g) ?? []).length, 331);
assert.equal(productionRoot, normalizedHomepageArtifact, "production / must use the approved canonical homepage artifact");
assertNoLegacyAssets(productionRoot, "production root");
assertNoLegacyAssets(productionPrivacy, "production privacy policy");
assertNoLegacyAssets(productionTerms, "production terms");
assertNoLegacyAssets(productionHumanSitemap, "production human sitemap");
assert.match(productionPrivacy, /Masterflow Plumbing respects your privacy/);
assert.match(productionTerms, /These terms apply to this website and general communications with Masterflow Plumbing/);
assert.match(productionHumanSitemap, /href="\/blog\/">Masterflow Plumbing Guides<\/a>/);
assert.match(productionRoot, /href="\/blog\/">Blog<\/a>/);
assert.doesNotMatch(productionRoot, /href="\/admin\/"|Site maintenance|Dropstars-style|repair path|dispatch machine/);

await withServer(createSeoServer({ token: "test-token" }), async (baseUrl) => {
  const reviewRoot = await fetch(`${baseUrl}/seo-preview/`);
  assert.equal(reviewRoot.status, 200);
  assert.equal(reviewRoot.headers.get("x-masterflow-preview-source"), "seo-production");
  const reviewRootHtml = await reviewRoot.text();
  assert.match(reviewRootHtml, /<div class="progress" id="progress">/);
  assert.match(reviewRootHtml, /href="\/seo-preview\/about"/);
  assert.doesNotMatch(reviewRootHtml, /<aside class="utility-proof"/);

  const trackingStub = await fetch(`${baseUrl}/tracking/umami-events.js`);
  assert.equal(trackingStub.status, 200, "local review mode must not emit a tracking-script 404");
  assert.match(trackingStub.headers.get("content-type") ?? "", /application\/javascript/);
  assert.match(await trackingStub.text(), /window\.umami/);

  const reviewContact = await fetch(`${baseUrl}/seo-preview/contact`);
  assert.equal(reviewContact.status, 200, "extensionless canonical routes must resolve in local review mode");
  assert.equal(reviewContact.headers.get("x-masterflow-preview-source"), "seo-production");
  const reviewContactHtml = await reviewContact.text();
  assert.match(reviewContactHtml, /<h1>Call or request plumbing service<\/h1>/);
  assert.match(reviewContactHtml, /href="\/seo-preview\/blog\/">Blog<\/a>/);
});

console.log(`Masterflow SEO engine tests passed: ${report.counts.pages} pages, ${report.guards.length} guards.`);
