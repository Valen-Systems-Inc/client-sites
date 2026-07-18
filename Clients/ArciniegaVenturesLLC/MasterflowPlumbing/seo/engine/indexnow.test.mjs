import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  collectIndexNowUrls,
  createIndexNowPayload,
  INDEXNOW_MAX_URLS,
  parseIndexNowArgs,
  runIndexNow,
  validateIndexNowKey,
} from "./indexnow.mjs";

test("accepts protocol-safe keys and rejects malformed keys", () => {
  assert.equal(validateIndexNowKey("abcDEF-123456"), "abcDEF-123456");
  assert.throws(() => validateIndexNowKey("short"), /8-128/);
  assert.throws(() => validateIndexNowKey("bad_key_value"), /letters, numbers, or dashes/);
});

test("enforces the official 10,000 URL ceiling", () => {
  assert.equal(parseIndexNowArgs([`--max-urls=${INDEXNOW_MAX_URLS}`, "--url=https://masterflowplumbing.us/"]).maxUrls, 10_000);
  assert.throws(
    () => parseIndexNowArgs(["--max-urls=10001", "--url=https://masterflowplumbing.us/"]),
    /1 to 10000/,
  );
});

test("discovers and deduplicates canonical URLs from a local sitemap index", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "indexnow-test-"));
  await fs.writeFile(path.join(dir, "sitemap_index.xml"), `<?xml version="1.0"?>
    <sitemapindex><sitemap><loc>https://masterflowplumbing.us/page-sitemap.xml</loc></sitemap></sitemapindex>`);
  await fs.writeFile(path.join(dir, "page-sitemap.xml"), `<?xml version="1.0"?>
    <urlset>
      <url><loc>https://masterflowplumbing.us/</loc><lastmod>2026-07-17</lastmod></url>
      <url><loc>https://masterflowplumbing.us/about/</loc><lastmod>2026-07-17</lastmod></url>
      <url><loc>https://masterflowplumbing.us/about/</loc><lastmod>2026-07-17</lastmod></url>
    </urlset>`);

  const urls = await collectIndexNowUrls({
    host: "masterflowplumbing.us",
    sitemaps: [path.join(dir, "sitemap_index.xml")],
    urls: [],
    urlsFiles: [],
    changedSince: null,
    maxUrls: 10_000,
  });
  assert.deepEqual(urls, [
    "https://masterflowplumbing.us/",
    "https://masterflowplumbing.us/about/",
  ]);
});

test("rejects cross-host URLs before a payload can be submitted", async () => {
  await assert.rejects(
    collectIndexNowUrls({
      host: "masterflowplumbing.us",
      sitemaps: [],
      urls: ["https://masterflowplumbing.net/"],
      urlsFiles: [],
      changedSince: null,
      maxUrls: 10_000,
    }),
    /does not belong/,
  );
});

test("builds one same-host payload with the root key location", () => {
  const options = {
    submit: false,
    host: "masterflowplumbing.us",
    key: "0123456789abcdef",
    keyLocation: "",
  };
  const { payload } = createIndexNowPayload(options, ["https://masterflowplumbing.us/"]);
  assert.equal(payload.host, "masterflowplumbing.us");
  assert.equal(payload.keyLocation, "https://masterflowplumbing.us/0123456789abcdef.txt");
  assert.equal(payload.urlList.length, 1);
});

test("redacts the configured key everywhere in the audit payload", async () => {
  const key = "0123456789abcdef";
  const report = await runIndexNow({
    submit: false,
    host: "masterflowplumbing.us",
    endpoint: "https://api.indexnow.org/indexnow",
    key,
    keyLocation: "",
    sitemaps: [],
    urls: ["https://masterflowplumbing.us/"],
    urlsFiles: [],
    changedSince: null,
    maxUrls: 10_000,
  });
  assert.equal(report.payload.key, "[configured]");
  assert.equal(report.payload.keyLocation, "https://masterflowplumbing.us/[configured].txt");
  assert.doesNotMatch(JSON.stringify(report.payload), new RegExp(key));
});
