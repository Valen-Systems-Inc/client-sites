import assert from "node:assert/strict";
import test from "node:test";
import worker, { canonicalRedirect, staticOriginUrl } from "./worker.js";

const env = {
  STATIC_ORIGIN: "https://clients.valen-systems.com/masterflow-plumbing",
  CANONICAL_ORIGIN: "https://masterflowplumbing.us",
};

test("maps canonical routes to the Valen clients CDN prefix", () => {
  const request = new Request("https://masterflowplumbing.us/about/?v=mflow-v.1.0.6");
  assert.equal(
    staticOriginUrl(request, env.STATIC_ORIGIN).toString(),
    "https://clients.valen-systems.com/masterflow-plumbing/about/?v=mflow-v.1.0.6",
  );
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
