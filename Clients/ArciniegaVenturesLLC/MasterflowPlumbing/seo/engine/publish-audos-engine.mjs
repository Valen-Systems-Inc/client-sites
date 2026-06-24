import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const siteDir = path.dirname(seoDir);
const audosDir = path.join(seoDir, "audos");

const workspaceNumeric = process.env.AUDOS_WORKSPACE_NUMERIC || "182567";
const workspaceUuid = process.env.AUDOS_WORKSPACE_UUID || "81f9a0d7-df5b-43e7-bff9-b1a7d6c73ed1";
const sessionId = process.env.MASTERFLOW_SEO_SESSION_ID || "masterflow-seo-engine";
const slug = process.env.MASTERFLOW_SEO_SLUG || "masterflow-seo-engine";
const reportHookName = process.env.MASTERFLOW_SEO_REPORT_HOOK || "masterflow-seo-engine";
const token = process.env.MASTERFLOW_SEO_ACCESS_TOKEN || `mfseo_${crypto.randomBytes(16).toString("hex")}`;
const base = process.env.AUDOS_BASE_URL || "https://app.valencoreprototype.com";

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${url} failed ${response.status}: ${text.slice(0, 400)}`);
  }
  return body;
}

async function deleteExistingPermalinks() {
  const url = `${base}/api/workspaces/${workspaceNumeric}/permalink-pages`;
  const rows = await request(url, { headers: { "x-session-id": sessionId } });
  const matching = Array.isArray(rows) ? rows.filter((row) => row.slug === slug) : [];
  for (const row of matching) {
    await request(`${url}/${row.id}`, { method: "DELETE" });
  }
  return matching.length;
}

async function updateBuildReportHook() {
  const code = await fs.readFile(path.join(audosDir, "valen-seo-build-report.js"), "utf8");
  const hooks = await request(`${base}/api/workspaces/${workspaceNumeric}/hooks`);
  const existing = Array.isArray(hooks) ? hooks.find((hook) => hook.name === reportHookName) : null;
  const payload = {
    name: reportHookName,
    description:
      "Private Masterflow SEO engine/report surface. Accepts current client-sites build-report.json, stores guard status, and serves the token-gated valencoreprototype.com permalink dashboard. No publish/DNS/R2/ads/outreach/contact writes.",
    code,
    language: "javascript",
    enabled: true,
  };
  if (existing) {
    await request(`${base}/api/workspaces/${workspaceNumeric}/hooks/${existing.id}`, {
      method: "DELETE",
    });
  }
  const created = await request(`${base}/api/workspaces/${workspaceNumeric}/hooks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { action: existing ? "recreated" : "created", id: created.id, name: reportHookName };
}

async function ingestReport() {
  const report = JSON.parse(await fs.readFile(path.join(seoDir, "reports", "build-report.json"), "utf8"));
  try {
    const queue = JSON.parse(await fs.readFile(path.join(seoDir, "reports", "microsite-deployment-queue.json"), "utf8"));
    report.microsite_deployment_queue = {
      generatedAt: queue.generatedAt,
      target_domain: queue.target_domain,
      summary: queue.summary,
      site_source_of_truth: queue.site_source_of_truth,
      first_wave: (queue.first_wave || []).slice(0, 72).map((item) => ({
        launch_wave: item.launch_wave,
        launch_region: item.launch_region,
        kind: item.kind,
        city: item.city,
        service: item.service,
        root_slug: item.root_slug,
        target_url: item.target_url,
        source_path: item.source_path,
        deployment_state: item.deployment_state,
        proof: item.proof,
      })),
    };
  } catch {
    report.microsite_deployment_queue = null;
  }
  return request(`${base}/api/hooks/execute/workspace-${workspaceUuid}/${reportHookName}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(report),
  });
}

async function createPermalink() {
  const htmlContent = await fs.readFile(path.join(audosDir, "masterflow-seo-engine.html"), "utf8");
  return request(`${base}/api/workspaces/${workspaceNumeric}/permalink-pages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-session-id": sessionId,
    },
    body: JSON.stringify({
      slug,
      title: "Masterflow SEO Engine",
      htmlContent,
      isPublic: false,
      accessToken: token,
      metadata: {
        client_slug: "masterflow-plumbing",
        privacy_model: "token-gated private permalink; noindex; Audos hooks compute",
        source: "client-sites MasterflowPlumbing seo/audos",
      },
    }),
  });
}

async function writePrivateReceipt(page, hook, ingest, deleted) {
  const receipt = {
    generatedAt: new Date().toISOString(),
    slug,
    deletedExisting: deleted,
    hook,
    ingest: {
      status: ingest.status,
      allPass: ingest.allPass,
      pages_total: ingest.pages_total,
      gates_passed: ingest.gates_passed,
      gates_total: ingest.gates_total,
    },
    page: {
      id: page.id,
      publicUrl: page.publicUrl,
      privateUrl: `https://www.valencoreprototype.com/p/${workspaceUuid}/${slug}?token=${token}`,
      workspaceId: page.workspaceId,
      isPublic: page.isPublic,
    },
  };
  const privateDir = path.join(siteDir, "tmp", "private");
  await fs.mkdir(privateDir, { recursive: true });
  await fs.writeFile(path.join(privateDir, "masterflow-seo-engine-audos.json"), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  return receipt;
}

async function main() {
  const hook = await updateBuildReportHook();
  const ingest = await ingestReport();
  const deleted = await deleteExistingPermalinks();
  const page = await createPermalink();
  const receipt = await writePrivateReceipt(page, hook, ingest, deleted);
  console.log(JSON.stringify(receipt, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
