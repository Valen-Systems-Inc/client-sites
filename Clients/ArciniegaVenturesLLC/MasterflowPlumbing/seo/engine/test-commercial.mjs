import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMMERCIAL_BLOG_CATEGORIES, COMMERCIAL_BLOG_POSTS } from "../content/commercial-blog.mjs";
import { COMMERCIAL_INDUSTRIES } from "../content/commercial-industries.mjs";
import { buildSeo, loadSeoData } from "./build.mjs";

const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const siteDir = path.dirname(seoDir);

async function readGenerated(root, file) {
  return fs.readFile(path.join(siteDir, ".generated.nosync", root, file), "utf8");
}

async function pathExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function assertNoLegacyOrRoboticCopy(html, label) {
  const forbidden = [
    "909-272-5456",
    "masterflowplumbing.com",
    "masterflow-plumbing-murrieta-2",
    "what is happening",
    "choose the next step",
    "cannot wait",
    "repair path",
    "dispatch machine",
    "stage check",
    "sound check",
    "dropstars",
  ];
  for (const phrase of forbidden) {
    assert.equal(html.toLowerCase().includes(phrase), false, `${label} contains forbidden copy: ${phrase}`);
  }
}

const data = await loadSeoData({ variant: "commercial" });
assert.equal(data.business.site_variant, "commercial");
assert.equal(data.posts.length, COMMERCIAL_BLOG_POSTS.length);
assert.equal(data.categories.length, COMMERCIAL_BLOG_CATEGORIES.length);
assert.equal(data.industries.length, COMMERCIAL_INDUSTRIES.length);

const expectedPages =
  7
  + 1 + COMMERCIAL_INDUSTRIES.length
  + 1 + COMMERCIAL_BLOG_POSTS.length + COMMERCIAL_BLOG_CATEGORIES.length
  + data.services.length;

const preview = await buildSeo({
  variant: "commercial",
  full: true,
  out: "commercial",
  indexable: false,
  routePrefix: "/commercial",
});

assert.equal(preview.allPass, true);
assert.equal(preview.counts.pages, expectedPages);
assert.equal(preview.counts.pages, 37);
assert.equal(preview.counts.cityServicePages, 0);
assert.equal(preview.counts.industries, 6);
assert.equal(preview.counts.posts, 8);
assert.equal(preview.counts.orphanPublicPages, 0);
assert.equal(preview.physicalOutput, ".generated.nosync/commercial");
assert.equal(preview.pipeline.runtimeBridge.payloadPath, "seo/reports/build-report-commercial.json");
assert.equal(preview.sitemap.inventoryReport, "seo/reports/pages-sitemap-commercial.json");

const home = await readGenerated("commercial", "index.html");
const services = await readGenerated("commercial", "services/index.html");
const serviceArea = await readGenerated("commercial", "service-area/index.html");
const contact = await readGenerated("commercial", "contact/index.html");
const industries = await readGenerated("commercial", "industries/index.html");
const portfolio = await readGenerated("commercial", "industries/property-management-portfolios/index.html");
const blog = await readGenerated("commercial", "blog/index.html");
const guide = await readGenerated("commercial", "blog/commercial-plumbing-maintenance-plan/index.html");
const service = await readGenerated("commercial", "services/hydro-jetting/index.html");
const parentSitemap = await readGenerated("commercial", "sitemap.xml");
const industrySitemap = await readGenerated("commercial", "industries-sitemap.xml");
const adminSitemap = await readGenerated("commercial", "admin-sitemap.xml");
const commercialBuildReport = JSON.parse(await fs.readFile(path.join(seoDir, "reports", "build-report-commercial.json"), "utf8"));
const commercialPageInventory = JSON.parse(await fs.readFile(path.join(seoDir, "reports", "pages-sitemap-commercial.json"), "utf8"));

assert.match(home, /Commercial Plumbing Across Southern California/);
assert.match(home, /href="\/">Residential<\/a>/);
assert.match(home, /href="\/commercial\/industries\/">Industries<\/a>/);
assert.match(home, /href="\/commercial\/blog\/">Blog<\/a>/);
assert.match(services, /Commercial Plumbing, Drain, and Sewer Services/);
assert.match(serviceArea, /Commercial Plumbing From Santa Barbara Through San Diego/);
assert.match(industries, /Commercial Properties Masterflow Serves/);
assert.match(portfolio, /Commercial Plumbing for Property Management Portfolios/);
assert.match(blog, /Commercial Plumbing Guides/);
assert.match(guide, /What Belongs in a Commercial Plumbing Maintenance Plan/);
assert.match(service, /Commercial Hydro Jetting/);
assert.match(contact, /name="companyName"[^>]+required/);
assert.match(contact, /name="propertyType"[^>]+required/);
assert.match(contact, /name="accessWindow"/);
assert.match(contact, /name="siteVariant" value="commercial"/);
assert.match(contact, /action="https:\/\/masterflowplumbing\.us\/api\/request-service"/);
assert.match(parentSitemap, /industries-sitemap\.xml/);
assert.match(parentSitemap, /post-sitemap\.xml/);
assert.match(parentSitemap, /category-sitemap\.xml/);
assert.doesNotMatch(parentSitemap, /admin-sitemap\.xml/);
assert.match(adminSitemap, /<url><loc>/);
assert.doesNotMatch(industrySitemap, /<url><loc>/);
assert.equal(commercialBuildReport.counts.pages, 37);
assert.equal(commercialPageInventory.counts.generatedPages, 37);
assert.equal(
  await pathExists(path.join(siteDir, ".generated.nosync", "commercial", "locations")),
  false,
  "commercial build must not generate a residential city-page matrix",
);

for (const [label, html] of [
  ["commercial home", home],
  ["commercial services", services],
  ["commercial service area", serviceArea],
  ["commercial contact", contact],
  ["commercial industries", industries],
  ["commercial portfolio", portfolio],
  ["commercial blog", blog],
  ["commercial guide", guide],
  ["commercial service", service],
]) {
  assertNoLegacyOrRoboticCopy(html, label);
}

const production = await buildSeo({
  variant: "commercial",
  full: true,
  out: "commercial-production",
  indexable: true,
  routePrefix: "/commercial",
});
const productionParent = await readGenerated("commercial-production", "sitemap.xml");
const productionIndustries = await readGenerated("commercial-production", "industries-sitemap.xml");
const productionRobots = await readGenerated("commercial-production", "robots.txt");

assert.equal(production.allPass, true);
assert.equal(production.counts.pages, 37);
assert.equal(production.counts.cityServicePages, 0);
assert.equal(production.counts.orphanPublicPages, 0);
assert.equal(production.counts.sitemapUrls, 36);
assert.match(productionParent, /https:\/\/masterflowplumbing\.us\/commercial\/industries-sitemap\.xml/);
assert.equal((productionIndustries.match(/<url><loc>/g) ?? []).length, 7);
assert.match(productionRobots, /Sitemap: https:\/\/masterflowplumbing\.us\/commercial\/sitemap\.xml/);
assert.doesNotMatch(productionRobots, /Disallow: \//);

console.log(`Masterflow commercial SEO tests passed: ${production.counts.pages} pages, ${production.counts.sitemapUrls} public URLs.`);
