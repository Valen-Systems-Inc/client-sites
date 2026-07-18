import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const siteDir = path.dirname(seoDir);
const reportsDir = path.join(seoDir, "reports");

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    base: "https://masterflowplumbing.us",
    version: "",
    variant: "residential",
    concurrency: 16,
  };
  for (const arg of argv) {
    if (arg.startsWith("--base=")) options.base = arg.slice("--base=".length).replace(/\/+$/, "");
    else if (arg.startsWith("--version=")) options.version = arg.slice("--version=".length).trim();
    else if (arg.startsWith("--variant=")) options.variant = arg.slice("--variant=".length).trim();
    else if (arg.startsWith("--concurrency=")) {
      options.concurrency = Math.max(1, Number(arg.slice("--concurrency=".length)) || 1);
    }
  }
  if (!options.version) throw new Error("Live verification requires --version=<release-version>.");
  if (!["residential", "commercial"].includes(options.variant)) {
    throw new Error(`Unsupported live verification variant: ${options.variant}`);
  }
  return options;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function withVersion(url, version) {
  const target = new URL(url);
  target.searchParams.set("v", version);
  return target.toString();
}

function localPageFile(urlPath, generatedRoot, routePrefix) {
  let relative = String(urlPath);
  if (routePrefix && relative.startsWith(`${routePrefix}/`)) {
    relative = relative.slice(routePrefix.length);
  }
  relative = relative.replace(/^\/+|\/+$/g, "");
  return relative ? path.join(generatedRoot, relative, "index.html") : path.join(generatedRoot, "index.html");
}

function canonicalFromHtml(html) {
  return html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1] ?? "";
}

function robotsFromHtml(html) {
  return html.match(/<meta name="robots" content="([^"]+)"/i)?.[1] ?? "";
}

function normalizeCloudflareHtml(html) {
  return html
    .replace(
      /<a\b(?=[^>]*\/cdn-cgi\/content\?id=)[^>]*>\s*<\/a>/g,
      "",
    )
    .replace(
      /[ \t]*<script\b(?=[^>]*\/cdn-cgi\/challenge-platform\/scripts\/(?:jsd|precursor)\/main\.js)[^>]*>\s*<\/script>/g,
      "",
    )
    .replace(
      /[ \t]*<script\b[^>]*>(?:(?!<\/script>)[\s\S])*?\/cdn-cgi\/challenge-platform\/scripts\/(?:jsd|precursor)\/main\.js(?:(?!<\/script>)[\s\S])*?<\/script>/g,
      "",
    );
}

function normalizeHtmlWhitespace(html) {
  return html.replace(
    /\n[ \t]*<\/body>[ \t]*\n[ \t]*<\/html>[ \t]*\n?$/,
    "\n</body>\n</html>\n",
  );
}

function managedRobotsMatches(liveText, localText) {
  return liveText.includes("# BEGIN Cloudflare Managed content")
    && liveText.includes("# END Cloudflare Managed Content")
    && liveText.endsWith(localText);
}

async function walkFiles(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile()) files.push(fullPath);
    }
  }
  await walk(root);
  return files.sort();
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  const results = new Array(items.length);
  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}

async function verifyTarget(target, version) {
  const response = await fetch(withVersion(target.url, version), {
    redirect: "manual",
    headers: {
      "cache-control": "no-cache",
      "user-agent": `MasterflowReleaseVerifier/${version}`,
    },
  });
  const liveBytes = Buffer.from(await response.arrayBuffer());
  const localBytes = await fs.readFile(target.localFile);
  const failures = [];
  let comparableLiveBytes = liveBytes;
  let comparableLocalBytes = localBytes;
  let edgeModified = false;
  let unrecognizedEdgeFragments = [];
  if (response.status !== 200) failures.push(`status ${response.status}`);

  if (target.kind === "html" || target.kind === "html-static") {
    const html = liveBytes.toString("utf8");
    const strippedHtml = normalizeCloudflareHtml(html);
    comparableLiveBytes = Buffer.from(normalizeHtmlWhitespace(strippedHtml));
    comparableLocalBytes = Buffer.from(normalizeHtmlWhitespace(localBytes.toString("utf8")));
    edgeModified = strippedHtml !== html;
    if (strippedHtml.includes("/cdn-cgi/challenge-platform/")) {
      unrecognizedEdgeFragments = Array.from(
        strippedHtml.matchAll(/.{0,160}\/cdn-cgi\/challenge-platform\/.{0,480}/gs),
        (match) => match[0],
      ).slice(0, 3);
      failures.push("unrecognized Cloudflare edge injection remained");
    }
    if (target.kind === "html") {
      if (canonicalFromHtml(html) !== target.canonical) failures.push("canonical mismatch");
      const liveRobots = robotsFromHtml(html);
      if (liveRobots !== target.robots && !(target.robots === "index,follow" && liveRobots === "")) {
        failures.push("robots mismatch");
      }
    }
  } else if (target.kind === "robots") {
    const liveText = liveBytes.toString("utf8");
    const localText = localBytes.toString("utf8");
    if (managedRobotsMatches(liveText, localText)) {
      comparableLiveBytes = localBytes;
      edgeModified = true;
    }
  }
  if (!comparableLiveBytes.equals(comparableLocalBytes)) {
    failures.push("live content does not match the release artifact");
  }

  return {
    id: target.id,
    kind: target.kind,
    url: target.url,
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    bytes: liveBytes.length,
    sha256: sha256(liveBytes),
    releaseSha256: sha256(localBytes),
    normalizedSha256: sha256(comparableLiveBytes),
    normalizedReleaseSha256: sha256(comparableLocalBytes),
    edgeModified,
    ...(unrecognizedEdgeFragments.length > 0 ? { unrecognizedEdgeFragments } : {}),
    pass: failures.length === 0,
    failures,
  };
}

const options = parseArgs();
const commercial = options.variant === "commercial";
const routePrefix = commercial ? "/commercial" : "";
const generatedRoot = path.join(
  siteDir,
  ".generated.nosync",
  commercial ? "commercial-production" : "seo-production",
);
const pageLedgerFile = commercial ? "pages-sitemap-commercial.json" : "pages-sitemap.json";
const releaseSuffix = commercial ? "-commercial" : "";
const pageLedger = JSON.parse(await fs.readFile(path.join(reportsDir, pageLedgerFile), "utf8"));
const releaseFile = path.join(reportsDir, `cdn-release-${options.version}${releaseSuffix}.json`);
const releaseManifest = JSON.parse(await fs.readFile(releaseFile, "utf8"));
const targets = [];

for (const page of pageLedger.pages) {
  targets.push({
    id: `page:${page.path}`,
    kind: "html",
    url: `${options.base}${page.path}`,
    localFile: localPageFile(page.path, generatedRoot, routePrefix),
    canonical: page.canonical,
    robots: page.robots,
  });
}

const aliasPaths = commercial
  ? [
      "/commercial/about/",
      "/commercial/service-area/",
      "/commercial/blog/",
      "/commercial/services/emergency-plumbing/",
      "/commercial/blog/multifamily-sewer-backup-response-plan/",
      "/commercial/industries/property-management-portfolios/",
    ]
  : [
      "/about/",
      "/service-area/",
      "/blog/",
      "/services/emergency-plumber/",
      "/blog/what-to-do-when-a-pipe-bursts/",
      "/murrieta-plumber/",
    ];
for (const route of aliasPaths) {
  const page = pageLedger.pages.find((entry) => entry.path === route);
  if (!page) throw new Error(`Alias verification route is missing from the page ledger: ${route}`);
  for (const alias of [route.slice(0, -1), `${route}index.html`]) {
    targets.push({
      id: `alias:${alias}`,
      kind: "html",
      url: `${options.base}${alias}`,
      localFile: localPageFile(route, generatedRoot, routePrefix),
      canonical: page.canonical,
      robots: page.robots,
    });
  }
}

const staticFiles = new Set([
  "sitemap.xml",
  "sitemap_index.xml",
  ...pageLedger.sitemapFamilies.map((family) => family.filename),
  "sitemap.xsl",
  "sitemap-assets/valen-systems-logo.png",
  "sitemap-assets/squarish-sans-ct-regular.woff2",
  "sitemap-assets/SQUARISH-SANS-CT-NOTICE.txt",
  "robots.txt",
  "llms.txt",
  "LLM.txt",
  ...(!commercial ? ["privacy.html", "terms.html", "sitemap.html"] : []),
]);
for (const filename of staticFiles) {
  targets.push({
    id: `static:${filename}`,
    kind: filename === "robots.txt"
      ? "robots"
      : filename.endsWith(".xml") || filename.endsWith(".xsl")
        ? "xml"
        : filename.endsWith(".png") || filename.endsWith(".woff2")
          ? "media"
          : filename.endsWith(".html")
            ? "html-static"
            : "text",
    url: `${options.base}${routePrefix}/${filename}`,
    localFile: path.join(generatedRoot, filename),
  });
}

for (const mediaFile of await walkFiles(path.join(siteDir, "media"))) {
  const relative = path.relative(siteDir, mediaFile).split(path.sep).join("/");
  targets.push({
    id: `media:${relative}`,
    kind: "media",
    url: `${options.base}/${relative}`,
    localFile: mediaFile,
  });
}

targets.push({
  id: `release:${options.version}`,
  kind: "json",
  url: `${options.base}${routePrefix}/releases/${options.version}.json`,
  localFile: releaseFile,
});

const checks = await runPool(targets, options.concurrency, (target) => verifyTarget(target, options.version));
const failures = checks.filter((check) => !check.pass);
const report = {
  version: options.version,
  variant: options.variant,
  verifiedAt: new Date().toISOString(),
  base: options.base,
  pass: failures.length === 0,
  expected: {
    generatedPages: pageLedger.counts.generatedPages,
    searchIndexablePages: pageLedger.counts.searchIndexablePages,
    noindexPages: pageLedger.counts.noindexPages,
    objectCountIncludingReleaseManifest: releaseManifest.objectCountIncludingReleaseManifest,
  },
  checked: {
    total: checks.length,
    pages: checks.filter((check) => check.id.startsWith("page:")).length,
    aliases: checks.filter((check) => check.id.startsWith("alias:")).length,
    staticFiles: checks.filter((check) => check.id.startsWith("static:")).length,
    media: checks.filter((check) => check.id.startsWith("media:")).length,
    releaseManifests: checks.filter((check) => check.id.startsWith("release:")).length,
  },
  failures,
  checks,
};
const reportFile = path.join(reportsDir, `live-release-${options.version}${releaseSuffix}.json`);
await fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);

console.log(
  `${report.pass ? "verified" : "failed"} ${checks.length} live artifacts: `
  + `${report.checked.pages} pages, ${report.checked.aliases} aliases, `
  + `${report.checked.staticFiles} static files, ${report.checked.media} media files`,
);
console.log(`report: ${path.relative(siteDir, reportFile)}`);
if (!report.pass) {
  for (const failure of failures.slice(0, 20)) {
    console.error(`${failure.id}: ${failure.failures.join("; ")}`);
  }
  process.exitCode = 1;
}
