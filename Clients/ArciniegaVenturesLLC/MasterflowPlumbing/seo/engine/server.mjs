import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildSeo, generatedOutputRoot, loadSeoData } from "./build.mjs";

const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const siteDir = path.dirname(seoDir);
const reportsDir = path.join(seoDir, "reports");
const reportFile = path.join(reportsDir, "build-report.json");
const domainPolicyFile = path.join(reportsDir, "domain-policy-report.json");
const sitemapPlanFile = path.join(reportsDir, "sitemap-plan.json");
const signalInventoryFile = path.join(reportsDir, "signal-inventory.json");
const feedbackLoopFile = path.join(reportsDir, "feedback-loop.json");
const liveCrawlFile = path.join(reportsDir, "live-crawl-siteone.json");
const cdnDeployPlanFile = path.join(reportsDir, "cdn-deploy-plan.json");
const liveActionPlanFile = path.join(reportsDir, "live-action-plan.json");
const loopStateFile = path.join(reportsDir, "loop-state.json");
const promotionCandidatesFile = path.join(siteDir, "promotions", "candidates.json");
const scopeFile = path.join(seoDir, "data", "scope.json");
const enrichmentFile = path.join(seoDir, "data", "region-enrichment.json");

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
  [".xsl", "text/xsl; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
  [".mp4", "video/mp4"],
  [".mov", "video/quicktime"],
]);

function jsonResponse(res, statusCode, body) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
  });
  res.end(`${JSON.stringify(body, null, 2)}\n`);
}

function htmlResponse(req, res, statusCode, html) {
  res.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
  });
  res.end(req.method === "HEAD" ? undefined : html);
}

async function readJsonMaybe(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

function isLocalRequest(req) {
  const remote = req.socket.remoteAddress ?? "";
  const host = req.headers.host ?? "";
  return remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1" || host.startsWith("127.0.0.1") || host.startsWith("localhost");
}

function hasBearer(req, token) {
  if (!token) return false;
  const auth = req.headers.authorization ?? "";
  if (auth === `Bearer ${token}`) return true;
  if (req.headers["x-valen-internal"] === token) return true;
  const cookie = req.headers.cookie ?? "";
  return cookie.split(";").some((part) => part.trim() === `valen_seo_token=${token}`);
}

function isAuthorized(req, token) {
  if (isLocalRequest(req)) return true;
  return hasBearer(req, token);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function money(cents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(cents ?? 0) / 100);
}

async function getProjectState() {
  const [data, scope, report, enrichment] = await Promise.all([
    loadSeoData(),
    readJsonMaybe(scopeFile, {}),
    readJsonMaybe(reportFile, null),
    readJsonMaybe(enrichmentFile, null),
  ]);
  return { ...data, scope, report, enrichment };
}

function hookList(scope) {
  return (scope.audos_hooks_to_reuse ?? [])
    .map((hook) => `<span class="pill">${escapeHtml(hook)}</span>`)
    .join("");
}

function guardRows(report) {
  if (!report) return `<tr><td colspan="3">No build report yet.</td></tr>`;
  return (report.guards ?? [])
    .map(
      (guard) => `<tr>
        <td>${escapeHtml(guard.name)}</td>
        <td><span class="status ${guard.pass ? "ok" : "bad"}">${guard.pass ? "PASS" : "FAIL"}</span></td>
        <td>${guard.pass ? "Ready" : "Needs attention"}</td>
      </tr>`,
    )
    .join("");
}

function pipelineRows(report) {
  const steps = report?.pipeline?.steps ?? [];
  if (!steps.length) return `<tr><td colspan="3">No pipeline report yet.</td></tr>`;
  return steps
    .map(
      (step) => `<tr>
        <td>${escapeHtml(step.name)}</td>
        <td><span class="status ${step.status === "pass" || step.status === "ready" ? "ok" : step.status === "blocked" ? "warn" : "bad"}">${escapeHtml(step.status)}</span></td>
        <td><code>${escapeHtml(JSON.stringify(step.evidence ?? {}))}</code></td>
      </tr>`,
    )
    .join("");
}

function issueRows(report) {
  if (!report?.issues?.length) return `<li>No open generator issues.</li>`;
  return report.issues
    .slice(0, 12)
    .map((issue) => `<li><code>${escapeHtml(issue.guard ?? issue.scope ?? "issue")}</code> ${escapeHtml(JSON.stringify(issue))}</li>`)
    .join("");
}

function projectHtml(state) {
  const { business, markets, services, scope, report, enrichment } = state;
  const launchRegions = scope.first_90_days?.launch_regions ?? [];
  const generatedPages = report?.counts?.pages ?? 0;
  const targetAssets = scope.first_90_days?.target_assets ?? 72;
  const cityServicePages = report?.counts?.cityServicePages ?? markets.length * services.length;
  const progress = Math.min(100, Math.round((cityServicePages / targetAssets) * 100));
  const enrichmentStamp = enrichment?.generatedAt ? new Date(enrichment.generatedAt).toLocaleString() : "not fetched yet";
  const lastBuild = report?.generatedAt ? new Date(report.generatedAt).toLocaleString() : "not built yet";
  const pipeline = report?.pipeline;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Masterflow SEO Engine</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #07111f;
      --panel: #0c1a2c;
      --panel-2: #10253c;
      --line: rgba(174, 203, 237, .18);
      --text: #eef6ff;
      --muted: #9eb1c6;
      --blue: #56a8ff;
      --cyan: #55e6d9;
      --amber: #ffd166;
      --green: #5ef3a2;
      --red: #ff6b6b;
      --orange: #ff8a4c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at 12% 0%, rgba(86,168,255,.18), transparent 34%),
        linear-gradient(180deg, #07111f, #08101c 46%, #050910);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.48;
    }
    main { margin: 0 auto; max-width: 1240px; padding: 28px 18px 56px; }
    header { display: grid; gap: 18px; grid-template-columns: minmax(0, 1.15fr) minmax(340px, .85fr); margin-bottom: 18px; }
    section, .panel {
      background: linear-gradient(180deg, rgba(16,37,60,.92), rgba(12,26,44,.9));
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: 0 18px 50px rgba(0,0,0,.24);
      padding: 18px;
    }
    .hero {
      min-height: 320px;
      overflow: hidden;
      position: relative;
    }
    .hero:after {
      background: linear-gradient(90deg, rgba(7,17,31,.94), rgba(7,17,31,.62), rgba(7,17,31,.16));
      content: "";
      inset: 0;
      position: absolute;
    }
    .hero img {
      filter: saturate(1.04) contrast(1.02);
      height: 100%;
      inset: 0;
      object-fit: cover;
      position: absolute;
      width: 100%;
    }
    .hero-copy { max-width: 760px; position: relative; z-index: 1; }
    h1 { font-size: clamp(2.4rem, 5vw, 4.7rem); letter-spacing: 0; line-height: .95; margin: 0 0 14px; }
    h2 { font-size: 1.1rem; margin: 0 0 12px; }
    p { color: var(--muted); margin: 0 0 12px; }
    code, pre, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .eyebrow { color: var(--cyan); font-size: .76rem; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
    .stats { display: grid; gap: 12px; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 18px 0; }
    .stat { background: rgba(255,255,255,.035); border: 1px solid var(--line); border-radius: 8px; padding: 14px; }
    .stat strong { display: block; font-size: 1.5rem; }
    .stat span { color: var(--muted); font-size: .85rem; }
    .grid { display: grid; gap: 14px; grid-template-columns: 1fr 1fr; }
    .bar { background: rgba(255,255,255,.08); border-radius: 999px; height: 12px; overflow: hidden; }
    .bar span { background: linear-gradient(90deg, var(--cyan), var(--blue)); display: block; height: 100%; width: ${progress}%; }
    .pill { border: 1px solid var(--line); border-radius: 999px; color: var(--text); display: inline-flex; font-size: .82rem; margin: 0 6px 8px 0; padding: 7px 10px; }
    button, .button {
      background: var(--blue);
      border: 0;
      border-radius: 8px;
      color: #04101f;
      cursor: pointer;
      display: inline-flex;
      font-weight: 900;
      min-height: 42px;
      padding: 10px 14px;
      text-decoration: none;
    }
    button.secondary, .button.secondary { background: rgba(255,255,255,.08); border: 1px solid var(--line); color: var(--text); }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border-bottom: 1px solid var(--line); padding: 10px; text-align: left; vertical-align: top; }
    th { color: var(--muted); font-size: .78rem; letter-spacing: .08em; text-transform: uppercase; }
    .status { border-radius: 999px; display: inline-flex; font-size: .78rem; font-weight: 900; padding: 5px 8px; }
    .ok { background: rgba(94,243,162,.12); color: var(--green); }
    .bad { background: rgba(255,107,107,.12); color: var(--red); }
    .warn { background: rgba(255,209,102,.12); color: var(--amber); }
    .roadmap { display: grid; gap: 10px; }
    .roadmap div { background: rgba(255,255,255,.035); border: 1px solid var(--line); border-radius: 8px; padding: 12px; }
    .regions { columns: 2; color: var(--muted); margin: 0; padding-left: 18px; }
    #toast { color: var(--cyan); min-height: 22px; }
    @media (max-width: 940px) {
      header, .grid, .stats { grid-template-columns: 1fr; }
      .regions { columns: 1; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <section class="hero">
        <img src="${escapeHtml(business.media.hero)}" alt="">
        <div class="hero-copy">
          <span class="eyebrow">Private Valen SEO Engine</span>
          <h1>Masterflow demand console</h1>
          <p>This is the private control surface for localized plumbing SEO, SEM-kernel research, public region enrichment, and approval-gated CDN previews. It is noindex and token-gated outside localhost.</p>
          <div class="actions">
            <button id="build">Run full build</button>
            <a class="button secondary" href="${escapeHtml(business.preview_prefix)}/">Open generated preview</a>
            <a class="button secondary" href="/api/projects/masterflow/report">Report JSON</a>
          </div>
          <p id="toast" class="mono"></p>
        </div>
      </section>
      <aside class="panel">
        <span class="eyebrow">Contract Shape</span>
        <h2>${escapeHtml(scope.engagement ?? "Localized SEO execution")}</h2>
        <p>Launch model: ${escapeHtml(String(scope.first_90_days?.assets_per_region ?? 12))} assets per region, ${escapeHtml(String(targetAssets))} assets in 90 days, then up to ${escapeHtml(String(scope.ongoing_monthly_asset_capacity ?? 25))} new or optimized assets per month.</p>
        <p>SEM media/testing lane: ${money((scope.sem_scope?.included_basic_media_testing_usd_monthly ?? 1000) * 100)} included monthly. Extra spend stays approval-gated.</p>
        <p><span class="status warn">Private</span> ${escapeHtml(scope.quality_guardrail ?? "")}</p>
      </aside>
    </header>
    <div class="stats">
      <div class="stat"><strong>${generatedPages}</strong><span>generated pages</span></div>
      <div class="stat"><strong>${markets.length}</strong><span>markets in local graph</span></div>
      <div class="stat"><strong>${services.length}</strong><span>service tracks</span></div>
      <div class="stat"><strong>${cityServicePages}</strong><span>city-service assets</span></div>
    </div>
    <div class="grid">
      <section>
        <span class="eyebrow">90-Day Asset Goal</span>
        <h2>${progress}% of first asset target represented by city-service output</h2>
        <div class="bar" aria-label="Asset progress"><span></span></div>
        <p class="mono">${cityServicePages} city-service pages / ${targetAssets} first-90-day assets</p>
        <ul class="regions">${launchRegions.map((region) => `<li>${escapeHtml(region)}</li>`).join("")}</ul>
      </section>
      <section>
        <span class="eyebrow">Audos Hook Spine</span>
        <h2>Troy/cufehaco lane preserved</h2>
        <p>Use existing hooks first. This server emits reports the Audos hook layer can ingest; public publish and domain mutations stay behind shipment approval.</p>
        <div>${hookList(scope)}</div>
      </section>
      <section>
        <span class="eyebrow">ValenFramework Pipeline</span>
        <h2>${escapeHtml(pipeline?.pattern ?? "Build -> Match -> Verify -> Execute")}</h2>
        <p>Pages are built in memory, matched to market/service data, verified, then written only after the verification gates pass.</p>
        <table>
          <thead><tr><th>Step</th><th>Status</th><th>Evidence</th></tr></thead>
          <tbody>${pipelineRows(report)}</tbody>
        </table>
      </section>
      <section>
        <span class="eyebrow">Guards</span>
        <h2>Build gates</h2>
        <table>
          <thead><tr><th>Guard</th><th>Status</th><th>Meaning</th></tr></thead>
          <tbody>${guardRows(report)}</tbody>
        </table>
      </section>
      <section>
        <span class="eyebrow">Open Issues</span>
        <h2>What blocks promotion</h2>
        <ul>${issueRows(report)}</ul>
        <p class="mono">Last build: ${escapeHtml(lastBuild)}<br>Region enrichment: ${escapeHtml(enrichmentStamp)}</p>
      </section>
      <section>
        <span class="eyebrow">Automation Roadmap</span>
        <h2>Next controlled routes</h2>
        <div class="roadmap">
          <div><strong>valen-seo-build-report</strong><p>Ingest <code>seo/reports/build-report.json</code>, update cards, and queue approvals.</p></div>
          <div><strong>valen-kernel-sem</strong><p>Run keyword summarize/rank/research for selected service+market candidates.</p></div>
          <div><strong>queue-runtime-shipment</strong><p>Approval gate before root homepage, DNS, paid ads, or public indexable promotion.</p></div>
        </div>
      </section>
      <section>
        <span class="eyebrow">Direct Line</span>
        <h2>Demand routes to Gianni's phone lane, no phone bot</h2>
        <p>Generated pages preserve Masterflow NAP and license consistency, push emergency jobs to <strong>${escapeHtml(business.phone_display)}</strong>, and keep reporting ready for call/source attribution.</p>
        <p class="mono">Domain: ${escapeHtml(business.primary_domain)}${escapeHtml(business.preview_prefix)}/</p>
      </section>
    </div>
  </main>
  <script>
    const buildButton = document.getElementById("build");
    const toast = document.getElementById("toast");
    buildButton.addEventListener("click", async () => {
      buildButton.disabled = true;
      toast.textContent = "building full preview...";
      try {
        const response = await fetch("/api/projects/masterflow/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ full: true }) });
        const data = await response.json();
        toast.textContent = data.ok ? "build passed; reloading report" : "build failed; report has issues";
        setTimeout(() => location.reload(), 700);
      } catch (error) {
        toast.textContent = error.message;
      } finally {
        buildButton.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

function previewTarget(pathname) {
  if (pathname.startsWith("/seo-preview/")) {
    return {
      mount: "/seo-preview/",
      root: generatedOutputRoot("seo-production"),
      source: "seo-production",
    };
  }
  if (pathname.startsWith("/generator-preview/")) {
    return {
      mount: "/generator-preview/",
      root: generatedOutputRoot("seo-preview"),
      source: "seo-preview",
    };
  }
  return {
    mount: "/",
    root: siteDir,
    source: "site",
  };
}

function rewritePreviewHtml(html, source) {
  if (source === "seo-production") {
    return html
      .replace(
      /(href|action|src)="\/(?!\/|seo-preview\/|generator-preview\/|media\/|api\/|favicon\.ico)([^"]*)"/g,
      '$1="/seo-preview/$2"',
      )
      .replace(
        /url\("\/(?!\/|seo-preview\/|generator-preview\/|media\/|api\/)([^"]*)"\)/g,
        'url("/seo-preview/$1")',
      );
  }
  if (source === "seo-preview") {
    return html.replace(/(href|action)="\/seo-preview\//g, '$1="/generator-preview/');
  }
  return html;
}

async function serveStaticPreview(req, res, pathname) {
  const target = previewTarget(pathname);
  const safePath = pathname.slice(target.mount.length);
  const requestedPath = path.join(target.root, safePath);
  const candidates = pathname.endsWith("/")
    ? [path.join(requestedPath, "index.html")]
    : [requestedPath, ...(path.extname(requestedPath) ? [] : [path.join(requestedPath, "index.html")])];
  const normalizedRoot = path.resolve(target.root);
  const normalizedCandidates = candidates.map((candidate) => path.resolve(candidate));
  if (normalizedCandidates.some((candidate) => candidate !== normalizedRoot && !candidate.startsWith(`${normalizedRoot}${path.sep}`))) {
    jsonResponse(res, 403, { ok: false, error: "outside site root" });
    return true;
  }

  for (const candidate of normalizedCandidates) {
    try {
      const body = await fs.readFile(candidate);
      const ext = path.extname(candidate).toLowerCase();
      const responseBody = ext === ".html"
        ? Buffer.from(rewritePreviewHtml(body.toString("utf8"), target.source))
        : body;
      res.writeHead(200, {
        "content-type": contentTypes.get(ext) ?? "application/octet-stream",
        "cache-control": "no-store",
        "x-robots-tag": "noindex, nofollow",
        "x-masterflow-preview-source": target.source,
      });
      res.end(req.method === "HEAD" ? undefined : responseBody);
      return true;
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "EISDIR") throw error;
    }
  }

  jsonResponse(res, 404, { ok: false, error: "not found", path: pathname });
  return true;
}

export function createSeoServer({ token = process.env.SEO_ENGINE_TOKEN } = {}) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      if (!isAuthorized(req, token)) {
        jsonResponse(res, 401, { ok: false, error: "private seo engine requires Valen internal token" });
        return;
      }

      if (req.method === "GET" && url.pathname === "/health") {
        const report = await readJsonMaybe(reportFile, null);
        jsonResponse(res, 200, {
          ok: true,
          service: "masterflow-seo-engine",
          private: true,
          reportReady: Boolean(report),
          allPass: report?.allPass ?? null,
          pipeline: report?.pipeline
            ? {
                framework: report.pipeline.framework,
                pattern: report.pipeline.pattern,
                currentPhase: report.pipeline.currentPhase,
                phaseRecovery: report.pipeline.phaseRecovery,
              }
            : null,
        });
        return;
      }

      if ((req.method === "GET" || req.method === "HEAD") && (url.pathname === "/" || url.pathname === "/masterflow-seo")) {
        htmlResponse(req, res, 200, projectHtml(await getProjectState()));
        return;
      }

      if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/tracking/umami-events.js") {
        res.writeHead(200, {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "no-store",
          "x-robots-tag": "noindex, nofollow",
        });
        res.end(req.method === "HEAD" ? undefined : "window.umami = window.umami || { track() {} };\n");
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/projects/masterflow") {
        const state = await getProjectState();
        jsonResponse(res, 200, {
          ok: true,
          private: true,
          counts: {
            markets: state.markets.length,
            services: state.services.length,
            generatedPages: state.report?.counts?.pages ?? null,
          },
          scope: state.scope,
          pipeline: state.report?.pipeline ?? null,
          business: {
            dba: state.business.dba,
            phone_display: state.business.phone_display,
            license_no: state.business.license_no,
            primary_domain: state.business.primary_domain,
            preview_prefix: state.business.preview_prefix,
          },
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/projects/masterflow/report") {
        jsonResponse(res, 200, { ok: true, report: await readJsonMaybe(reportFile, null) });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/projects/masterflow/pages") {
        const state = await getProjectState();
        const report = state.report;
        jsonResponse(res, 200, {
          ok: true,
          previewRoot: `${state.business.primary_domain}${state.business.preview_prefix}/`,
          counts: report?.counts ?? null,
          issues: report?.issues ?? [],
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/audos-plan") {
        const state = await getProjectState();
        jsonResponse(res, 200, {
          ok: true,
          private_route: "/masterflow-seo",
          privacy_model: "localhost allowed; public host requires Authorization bearer or x-valen-internal token; all responses emit noindex",
          hooks_to_reuse: state.scope.audos_hooks_to_reuse ?? [],
          wrapper_to_add: {
            name: "valen-seo-build-report",
            input: "seo/reports/build-report.json",
            action: "upsert status cards and queue runtime shipment for approval-gated R2/public activation",
          },
          valen_framework: state.report?.pipeline
            ? {
                pattern: state.report.pipeline.pattern,
                verify_before_execute: state.report.pipeline.verifyBeforeExecute,
                runtime_bridge: state.report.pipeline.runtimeBridge,
              }
            : null,
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/oss-stack/status") {
        const [domainPolicy, sitemapPlan, signalInventory, feedbackLoop, liveCrawl, promotionCandidates, cdnDeployPlan, liveActionPlan, loopState] = await Promise.all([
          readJsonMaybe(domainPolicyFile, null),
          readJsonMaybe(sitemapPlanFile, null),
          readJsonMaybe(signalInventoryFile, null),
          readJsonMaybe(feedbackLoopFile, null),
          readJsonMaybe(liveCrawlFile, null),
          readJsonMaybe(promotionCandidatesFile, null),
          readJsonMaybe(cdnDeployPlanFile, null),
          readJsonMaybe(liveActionPlanFile, null),
          readJsonMaybe(loopStateFile, null),
        ]);
        jsonResponse(res, 200, {
          ok: true,
          reports: {
            domainPolicy: Boolean(domainPolicy),
            sitemapPlan: Boolean(sitemapPlan),
            signalInventory: Boolean(signalInventory),
            feedbackLoop: Boolean(feedbackLoop),
            liveCrawl: Boolean(liveCrawl),
            promotionCandidates: Boolean(promotionCandidates),
            cdnDeployPlan: Boolean(cdnDeployPlan),
            liveActionPlan: Boolean(liveActionPlan),
            loopState: Boolean(loopState),
          },
          allPass: Boolean(feedbackLoop?.allPass),
          blockers: feedbackLoop?.blockers ?? [],
          summary: feedbackLoop?.summary ?? null,
          signalMissing: signalInventory?.missing ?? null,
          cdnDeploySummary: cdnDeployPlan?.summary ?? null,
          liveActionSummary: liveActionPlan?.summary ?? null,
          lastLoop: loopState
            ? {
                generatedAt: loopState.generatedAt,
                iteration: loopState.iteration,
                steps: loopState.steps,
              }
            : null,
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/oss-stack/feedback") {
        jsonResponse(res, 200, { ok: true, feedback: await readJsonMaybe(feedbackLoopFile, null) });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/oss-stack/promotion-candidates") {
        jsonResponse(res, 200, { ok: true, promotionCandidates: await readJsonMaybe(promotionCandidatesFile, null) });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/oss-stack/sitemap-plan") {
        jsonResponse(res, 200, { ok: true, sitemapPlan: await readJsonMaybe(sitemapPlanFile, null) });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/oss-stack/signal-inventory") {
        jsonResponse(res, 200, { ok: true, signalInventory: await readJsonMaybe(signalInventoryFile, null) });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/oss-stack/cdn-deploy-plan") {
        jsonResponse(res, 200, { ok: true, cdnDeployPlan: await readJsonMaybe(cdnDeployPlanFile, null) });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/oss-stack/live-action-plan") {
        jsonResponse(res, 200, { ok: true, liveActionPlan: await readJsonMaybe(liveActionPlanFile, null) });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/oss-stack/loop-state") {
        jsonResponse(res, 200, { ok: true, loopState: await readJsonMaybe(loopStateFile, null) });
        return;
      }

      if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/favicon.ico") {
        res.writeHead(204, { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" });
        res.end();
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/projects/masterflow/build") {
        const body = await readRequestBody(req);
        const report = await buildSeo({
          full: body.full !== false,
          out: String(body.out || "seo-preview"),
          indexable: false,
        });
        jsonResponse(res, 200, { ok: true, report });
        return;
      }

      if ((req.method === "GET" || req.method === "HEAD") && (url.pathname.startsWith("/seo-preview/") || url.pathname.startsWith("/generator-preview/") || url.pathname.startsWith("/media/"))) {
        await serveStaticPreview(req, res, url.pathname);
        return;
      }

      jsonResponse(res, 404, { ok: false, error: "not found" });
    } catch (error) {
      jsonResponse(res, 500, { ok: false, error: error.message });
    }
  });
}

async function main() {
  const port = Number(process.env.PORT || process.argv.find((arg) => arg.startsWith("--port="))?.split("=")[1] || 8765);
  const host = process.env.HOST || "127.0.0.1";
  const server = createSeoServer();
  server.listen(port, host, () => {
    console.log(`Masterflow SEO engine private console: http://${host}:${port}/masterflow-seo`);
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
