import assert from "node:assert/strict";
import test from "node:test";
import worker, {
  canonicalRedirect,
  isSitemapPath,
  originTarget,
  staticOriginUrl,
} from "./worker.js";

const env = {
  STATIC_ORIGIN: "https://clients.valen-systems.com/masterflow-plumbing",
  SITEMAP_ORIGIN: "https://clients.valen-systems.com/masterflow-plumbing/_control/sitemaps",
  INDEXNOW_ORIGIN: "https://clients.valen-systems.com/masterflow-plumbing/_control/indexnow",
  CANONICAL_ORIGIN: "https://masterflowplumbing.us",
};

test("maps canonical routes to the Valen clients CDN prefix", () => {
  const request = new Request("https://masterflowplumbing.us/about/?v=mflow-v.1.0.6");
  assert.equal(
    staticOriginUrl(request, env.STATIC_ORIGIN).toString(),
    "https://clients.valen-systems.com/masterflow-plumbing/about/?v=mflow-v.1.0.6",
  );
});

test("routes residential sitemap files through the Valen control silo", () => {
  const target = originTarget(
    new Request("https://masterflowplumbing.us/post-sitemap.xml?v=mflow-v.1.0.9"),
    env,
  );
  assert.equal(target.kind, "sitemap");
  assert.equal(
    target.url.toString(),
    "https://clients.valen-systems.com/masterflow-plumbing/_control/sitemaps/post-sitemap.xml?v=mflow-v.1.0.9",
  );
});

test("routes commercial sitemap files through their control-silo family", () => {
  const target = originTarget(
    new Request("https://masterflowplumbing.us/commercial/sitemap_index.xml"),
    env,
  );
  assert.equal(target.kind, "sitemap");
  assert.equal(
    target.url.toString(),
    "https://clients.valen-systems.com/masterflow-plumbing/_control/sitemaps/commercial/sitemap_index.xml",
  );
});

test("routes a valid root IndexNow key file through the Valen control silo", () => {
  const target = originTarget(
    new Request("https://masterflowplumbing.us/0123456789abcdef.txt"),
    env,
  );
  assert.equal(target.kind, "indexnow-key");
  assert.equal(
    target.url.toString(),
    "https://clients.valen-systems.com/masterflow-plumbing/_control/indexnow/0123456789abcdef.txt",
  );
});

test("does not mistake ordinary text files or nested routes for control artifacts", () => {
  assert.equal(isSitemapPath("/robots.txt"), false);
  assert.equal(isSitemapPath("/blog/sitemap.xml"), false);
  assert.equal(originTarget(new Request("https://masterflowplumbing.us/robots.txt"), env).kind, "site");
});

test("redirects alias domains to the canonical .us host", () => {
  const request = new Request("https://www.masterflowplumbing.us/services/drain-cleaning/?ref=alias");
  const response = canonicalRedirect(request, env.CANONICAL_ORIGIN);
  assert.equal(response.status, 301);
  assert.equal(
    response.headers.get("location"),
    "https://masterflowplumbing.us/services/drain-cleaning/?ref=alias",
  );
});

test("keeps canonical requests on the static path", () => {
  assert.equal(canonicalRedirect(new Request("https://masterflowplumbing.us/"), env.CANONICAL_ORIGIN), null);
});

test("fails closed if an API request reaches the static worker", async () => {
  const response = await worker.fetch(new Request("https://masterflowplumbing.us/api/request-service", {
    method: "POST",
  }), env);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("rejects non-static methods", async () => {
  const response = await worker.fetch(new Request("https://masterflowplumbing.us/contact/", {
    method: "POST",
  }), env);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET, HEAD");
});
