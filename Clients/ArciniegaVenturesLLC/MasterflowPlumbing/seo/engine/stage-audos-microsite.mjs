import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const siteDir = path.dirname(seoDir);

const workspaceUuid =
  process.env.AUDOS_WORKSPACE_UUID || "81f9a0d7-df5b-43e7-bff9-b1a7d6c73ed1";
const hooksBase =
  process.env.AUDOS_HOOKS_BASE ||
  `https://app.valencoreprototype.com/api/hooks/execute/workspace-${workspaceUuid}`;
const sessionId = Number(process.env.MASTERFLOW_MICROSITE_SESSION_ID || 2026061701);
const slug = process.env.MASTERFLOW_MICROSITE_SLUG || "masterflow-seo-engine";
const clientSlug = "masterflow-plumbing";
const targetDomain = process.env.MASTERFLOW_TARGET_DOMAIN || "https://masterflowplumbing.us";
const forcePreview = process.env.MASTERFLOW_MICROSITE_REFRESH === "1";

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function maybeReadJson(file) {
  try {
    return await readJson(file);
  } catch {
    return null;
  }
}

async function request(hook, body, method = "POST") {
  const response = await fetch(`${hooksBase}/${hook}`, {
    method,
    headers: { "content-type": "application/json", accept: "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok || data.ok === false || data.success === false) {
    throw new Error(`${hook} failed ${response.status}: ${JSON.stringify(data).slice(0, 700)}`);
  }
  return data;
}

function sitePreviewCard({ privateUrl, report }) {
  const pagesTotal = report.ingest?.pages_total || 0;
  const guardsPassed = report.ingest?.gates_passed || 0;
  const guardsTotal = report.ingest?.gates_total || 0;

  return {
    card_type: "site_preview",
    status: "pending",
    priority: 98,
    idempotencyKey: `masterflow-seo-engine-site-preview-${slug}`,
    spatial_state: {
      space: "foreground",
      cluster: "masterflow-seo",
      emphasis: "primary",
    },
    card_data: {
      title: "Masterflow SEO Engine",
      businessName: "Masterflow Plumbing",
      businessDescription:
        "Private STRT-7 localized plumbing demand engine for Masterflow: 6 launch regions, city-service assets, SEM research, noindex previews, and approval-gated publish.",
      body:
        "The engine is running privately on valencoreprototype.com and points to the noindex CDN preview until William approves a public microsite/domain move.",
      action: "Preview",
      client_slug: clientSlug,
      slug,
      micrositeSlug: slug,
      targetHost: `${targetDomain}/${slug}`,
      privateControlSurfaceUrl: privateUrl,
      noindexCdnPreviewUrl: "https://masterflowplumbing.us/seo-preview/index.html",
      reportJsonUrl:
        `${hooksBase}/masterflow-seo-engine?client_slug=${encodeURIComponent(clientSlug)}`,
      noindex: true,
      approval_required: true,
      publish_gate:
        "William approval required before indexable publish, DNS, ads, outreach, contact writes, or public R2/root promotion.",
      seo_engine: {
        pages_total: pagesTotal,
        guards_passed: guardsPassed,
        guards_total: guardsTotal,
        report_status: report.ingest?.status || "unknown",
        report_hook: "masterflow-seo-engine",
        sem_hook: "valen-kernel-sem",
        preview_hook: "create-preview-microsite-v2",
        shipment_hook: "queue-runtime-shipment",
      },
    },
  };
}

async function writePrivateReceipt(receipt) {
  const privateDir = path.join(siteDir, "tmp", "private");
  await fs.mkdir(privateDir, { recursive: true });
  const receiptPath = path.join(privateDir, "masterflow-microsite-audos.json");
  await fs.writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
    mode: 0o600,
  });
  return receiptPath;
}

async function main() {
  if (!Number.isSafeInteger(sessionId) || sessionId <= 0) {
    throw new Error("MASTERFLOW_MICROSITE_SESSION_ID must be a positive integer");
  }

  const reportReceipt = await readJson(
    path.join(siteDir, "tmp", "private", "masterflow-seo-engine-audos.json"),
  );
  const priorReceipt = await maybeReadJson(
    path.join(siteDir, "tmp", "private", "masterflow-microsite-audos.json"),
  );

  const card = sitePreviewCard({
    privateUrl: reportReceipt.page.privateUrl,
    report: reportReceipt,
  });

  const upsert = await request("upsert-card", {
    sessionId,
    ...card,
  });

  const cards = await request("get-cards", { sessionId, full: true });

  let preview = priorReceipt?.preview || null;
  if (!preview || forcePreview) {
    preview = await request("create-preview-microsite-v2", {
      sessionId,
      businessName: card.card_data.businessName,
      businessDescription: card.card_data.businessDescription,
      slug,
    });
  }

  let shipment = priorReceipt?.shipment || null;
  if (!shipment || forcePreview) {
    shipment = await request("queue-runtime-shipment", {
      sessionId: String(sessionId),
      workflowType: "client_site_creation",
      summary:
        "Stage Masterflow SEO Engine microsite from verified private build report",
      approvalRequired: true,
      payload: {
        client_slug: clientSlug,
        slug,
        target_host: targetDomain,
        target_path_url: `${targetDomain}/${slug}`,
        private_control_surface_url: reportReceipt.page.privateUrl,
        noindex_cdn_preview_url: card.card_data.noindexCdnPreviewUrl,
        report_json_url: card.card_data.reportJsonUrl,
        pages_total: reportReceipt.ingest.pages_total,
        gates_passed: reportReceipt.ingest.gates_passed,
        gates_total: reportReceipt.ingest.gates_total,
        publish_gate: card.card_data.publish_gate,
        required_next_step:
          "Use the documented microsite mint lane to bind a compiled app bundle to masterflowplumbing.us/{slug}, then verify shell __APP_ID__ and bundle.js before public/indexable promotion.",
      },
    });
  }

  const receipt = {
    generatedAt: new Date().toISOString(),
    sessionId,
    slug,
    hooksBase,
    card: {
      action: upsert.action,
      card_id: upsert.card_id,
      idempotencyKey: card.idempotencyKey,
      cardsReadback: cards.summary || null,
    },
    preview,
    shipment,
    privacy_model:
      "site_preview + provisional preview + approval-gated shipment; no DNS, ads, outreach, contact writes, payment action, or public/indexable publish",
    proof_level:
      "card/readback + create-preview-microsite-v2 callable + shipment queued; root slug requires microsite mint proof",
  };

  await writePrivateReceipt(receipt);
  console.log(JSON.stringify(receipt, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
