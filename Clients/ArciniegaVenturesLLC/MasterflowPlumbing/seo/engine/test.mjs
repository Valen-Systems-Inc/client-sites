import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSeo, loadSeoData } from "./build.mjs";
import { createSeoServer } from "./server.mjs";

const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const siteDir = path.dirname(seoDir);

async function read(file) {
  return fs.readFile(path.join(siteDir, file), "utf8");
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
  const legacy = ["storage.googleapis", "masterflowplumbing.com", "909-272-5456", "1085831", "masterflow-truck-wrap"];
  for (const bad of legacy) assert.equal(html.includes(bad), false, `${label} contains legacy asset/data string ${bad}`);
}

const data = await loadSeoData();
const report = await buildSeo({ full: true, out: "seo-preview", indexable: false });
const expectedPages = 1 + data.markets.length + data.services.length + data.markets.length * data.services.length;

assert.equal(report.allPass, true, "build report must pass all guards");
assert.equal(report.indexable, false, "preview builds must stay noindex");
assert.equal(report.pipeline.framework, "ValenFramework", "build report exposes ValenFramework pipeline");
assert.equal(report.pipeline.pattern, "Build -> Match -> Verify -> Execute");
assert.equal(report.pipeline.verifyBeforeExecute, true);
assert.equal(report.pipeline.runtimeBridge.payloadPath, "seo/reports/build-report.json");
assert.equal(report.pipeline.steps.at(-1).status, "ready", "execute phase is ready only after verification");
assert.equal(report.counts.pages, expectedPages, "page count must match market/service cross product");
assert.equal(report.counts.cityServicePages, data.markets.length * data.services.length);
assert.ok(report.counts.cityServicePages >= 72, "first 90-day asset target must be represented");

const indexHtml = await read("seo-preview/index.html");
const riversideEmergency = await read("seo-preview/locations/riverside/emergency-plumbing/index.html");
const murrietaDrain = await read("seo-preview/locations/murrieta/drain-cleaning/index.html");
const robots = await read("seo-preview/robots.txt");

assert.match(indexHtml, /noindex,nofollow/);
assert.match(riversideEmergency, /Emergency Plumbing in Riverside, CA/);
assert.match(murrietaDrain, /Drain Cleaning in Murrieta, CA/);
assert.match(robots, /Disallow: \//);
assertNoLegacyAssets(indexHtml, "index");
assertNoLegacyAssets(riversideEmergency, "riverside emergency");
assertNoLegacyAssets(murrietaDrain, "murrieta drain");

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

  const preview = await fetch(`${baseUrl}/seo-preview/locations/riverside/emergency-plumbing/`);
  assert.equal(preview.status, 200);
  assert.match(preview.headers.get("x-robots-tag") ?? "", /noindex/);
  assertNoLegacyAssets(await preview.text(), "server preview");
});

console.log(`Masterflow SEO engine tests passed: ${report.counts.pages} pages, ${report.guards.length} guards.`);
