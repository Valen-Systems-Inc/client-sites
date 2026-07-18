import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import fg from "fast-glob";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const siteDir = path.dirname(seoDir);
const reportsDir = path.join(seoDir, "reports");

const accountId = "956cd86d8e5c90c6156a7a7d937c6415";
const expectedEmail = process.env.VALEN_WRANGLER_EMAIL || "robinson.williamp2000@gmail.com";
const bucket = "valen-clients-cdn";
const keyPrefix = normalizeR2Prefix(
  process.env.MASTERFLOW_CDN_PREFIX || "masterflow-plumbing",
);
const publicBaseUrl = `https://clients.valen-systems.com/${keyPrefix}`;
const defaultWrangler = "";
const wranglerBin = process.env.WRANGLER_BIN || defaultWrangler;
const npxBin = process.env.NPX_BIN || "npx";
const wranglerHome = process.env.VALEN_WRANGLER_HOME || process.env.HOME;
const wranglerVersion = "4.107.0";
let wranglerCommand;

function parseArgs(argv = process.argv.slice(2)) {
  const opts = {
    root: "seo-preview",
    targetPrefix: "seo-preview",
    dryRun: false,
    includeMedia: true,
    concurrency: 4,
    sitemapOnly: false,
    excludeSitemaps: false,
    version: process.env.MASTERFLOW_CDN_VERSION || "",
  };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--skip-media") opts.includeMedia = false;
    else if (arg === "--sitemap-only") opts.sitemapOnly = true;
    else if (arg === "--exclude-sitemaps") opts.excludeSitemaps = true;
    else if (arg.startsWith("--prefix=")) {
      const prefix = normalizeR2Prefix(arg.slice("--prefix=".length));
      opts.root = prefix;
      opts.targetPrefix = prefix;
    }
    else if (arg.startsWith("--root=")) opts.root = arg.slice("--root=".length).replace(/^\/+|\/+$/g, "");
    else if (arg.startsWith("--target-prefix=")) opts.targetPrefix = normalizeR2Prefix(arg.slice("--target-prefix=".length));
    else if (arg.startsWith("--concurrency=")) opts.concurrency = Math.max(1, Number(arg.slice("--concurrency=".length)) || 1);
    else if (arg.startsWith("--version=")) opts.version = normalizeReleaseVersion(arg.slice("--version=".length));
  }
  opts.version = normalizeReleaseVersion(opts.version);
  return opts;
}

function normalizeR2Prefix(value) {
  return String(value ?? "").replace(/^\/+|\/+$/g, "");
}

function normalizeReleaseVersion(value) {
  const version = String(value ?? "").trim();
  if (!version) return "";
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(version)) {
    throw new Error(`Invalid release version "${version}". Use letters, numbers, dots, underscores, or hyphens.`);
  }
  return version;
}

function generatedSourceRoot(root) {
  const normalized = String(root ?? "").replace(/^\/+|\/+$/g, "");
  if (normalized.startsWith(".generated.nosync/")) return normalized;
  return [".generated.nosync", normalized].filter(Boolean).join("/");
}

function hasNumberedConflictSegment(relativePath) {
  return String(relativePath)
    .split("/")
    .some((segment) => / \d+(?:\.[^.]+)?$/.test(segment));
}

function isSitemapArtifact(relativePath) {
  const normalized = String(relativePath).replace(/^\/+/, "");
  const filename = path.posix.basename(normalized);
  return filename === "sitemap.xml"
    || filename === "sitemap_index.xml"
    || filename.endsWith("-sitemap.xml")
    || filename === "sitemap.xsl"
    || normalized.startsWith("sitemap-assets/");
}

function r2Key(targetPrefix, relUnderRoot) {
  return [keyPrefix, targetPrefix, relUnderRoot].filter(Boolean).join("/");
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".xml") return "application/xml; charset=utf-8";
  if (ext === ".xsl") return "text/xsl; charset=utf-8";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".woff2") return "font/woff2";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".mov") return "video/quicktime";
  return "application/octet-stream";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function gitInfo() {
  try {
    const [head, branch, remote] = await Promise.all([
      execFileAsync("git", ["rev-parse", "--short", "HEAD"], { cwd: siteDir }),
      execFileAsync("git", ["branch", "--show-current"], { cwd: siteDir }),
      execFileAsync("git", ["remote", "get-url", "origin"], { cwd: siteDir }),
    ]);
    return {
      head: head.stdout.trim(),
      branch: branch.stdout.trim(),
      remote: remote.stdout.trim(),
    };
  } catch {
    return null;
  }
}

async function run(args, { quiet = false, timeoutMs = 90000 } = {}) {
  const command = await resolveWranglerCommand();
  try {
    const result = await execFileAsync(command.bin, [...command.prefixArgs, ...args], {
      cwd: siteDir,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 4,
      env: {
        ...process.env,
        CI: "1",
        WRANGLER_SEND_METRICS: "false",
        npm_config_yes: "true",
        HOME: wranglerHome,
        CLOUDFLARE_ACCOUNT_ID: accountId,
      },
    });
    if (!quiet) {
      process.stdout.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
    }
    return result;
  } catch (error) {
    const stdout = error.stdout ?? "";
    const stderr = error.stderr ?? "";
    throw new Error(`${[command.bin, ...command.prefixArgs, ...args].join(" ")} failed\n${stdout}\n${stderr}`);
  }
}

async function resolveWranglerCommand() {
  if (wranglerCommand) return wranglerCommand;
  try {
    await fs.access(wranglerBin);
    wranglerCommand = { bin: wranglerBin, prefixArgs: [] };
    return wranglerCommand;
  } catch {
    wranglerCommand = { bin: npxBin, prefixArgs: ["--yes", `wrangler@${wranglerVersion}`] };
    return wranglerCommand;
  }
}

async function assertWrangler() {
  const whoami = await run(["whoami"], { quiet: true });
  const text = `${whoami.stdout}\n${whoami.stderr}`;
  if (!text.toLowerCase().includes(expectedEmail.toLowerCase())) {
    throw new Error(`Refusing R2 deploy: Wrangler is not authenticated as ${expectedEmail}. Output:\n${text}`);
  }
  if (!text.includes(accountId)) {
    throw new Error(`Refusing R2 deploy: Wrangler is not scoped to Valen clients CDN account ${accountId}. Output:\n${text}`);
  }
}

async function uploadFile(localFile, key, dryRun) {
  const rel = path.relative(siteDir, localFile);
  if (dryRun) {
    console.log(`[dry-run] ${rel} -> r2://${bucket}/${key}`);
    return;
  }
  const args = [
    "r2",
    "object",
    "put",
    `${bucket}/${key}`,
    "--remote",
    "--file",
    localFile,
    "--content-type",
    contentType(localFile),
  ];
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await run(args, { quiet: true });
      console.log(`uploaded ${rel} -> ${key}`);
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      const delay = attempt * 1500;
      console.warn(`retry ${attempt}/3 after ${delay}ms: ${rel} -> ${key}`);
      await sleep(delay);
    }
  }
}

async function collectUploads(opts) {
  const physicalRoot = generatedSourceRoot(opts.root);
  const sourceRoot = path.join(siteDir, physicalRoot);
  await fs.access(sourceRoot);
  const sourceFiles = await fg("**/*", {
    cwd: sourceRoot,
    onlyFiles: true,
    dot: true,
  });
  const uploads = [];
  for (const relUnderRoot of sourceFiles) {
    if (hasNumberedConflictSegment(relUnderRoot)) continue;
    const sitemapArtifact = isSitemapArtifact(relUnderRoot);
    if (opts.sitemapOnly && !sitemapArtifact) continue;
    if (opts.excludeSitemaps && sitemapArtifact) continue;
    if (opts.version && relUnderRoot === `releases/${opts.version}.json`) continue;
    const localFile = path.join(sourceRoot, relUnderRoot);
    const key = r2Key(opts.targetPrefix, relUnderRoot);
    uploads.push({ localFile, key });
    if (relUnderRoot === "index.html" || relUnderRoot.endsWith("/index.html")) {
      const slashKey = key.slice(0, -"index.html".length);
      uploads.push({ localFile, key: slashKey });
      const extensionlessKey = slashKey.replace(/\/$/, "");
      if (extensionlessKey && extensionlessKey !== slashKey) {
        uploads.push({ localFile, key: extensionlessKey });
      }
    }
  }
  if (opts.includeMedia) {
    const mediaFiles = await fg("media/**/*", { cwd: siteDir, onlyFiles: true, dot: false });
    for (const rel of mediaFiles) {
      uploads.push({
        localFile: path.join(siteDir, rel),
        key: r2Key("", rel),
      });
    }
  }
  return uploads;
}

const opts = parseArgs();
await assertWrangler();
const uploads = await collectUploads(opts);
if (opts.version) {
  const releaseManifest = {
    version: opts.version,
    generatedAt: new Date().toISOString(),
    bucket,
    root: opts.root,
    physicalRoot: generatedSourceRoot(opts.root),
    keyPrefix,
    targetPrefix: r2Key(opts.targetPrefix, ""),
    cdnNamespaceBaseUrl: publicBaseUrl,
    publicBaseUrl: `${publicBaseUrl}${opts.targetPrefix ? `/${opts.targetPrefix}` : ""}`,
    canonicalDomain: "https://masterflowplumbing.us",
    dryRun: opts.dryRun,
    includeMedia: opts.includeMedia,
    objectCountExcludingReleaseManifest: uploads.length,
    objectCountIncludingReleaseManifest: uploads.length + 2,
    sampleKeys: uploads.slice(0, 20).map((upload) => upload.key),
    git: await gitInfo(),
  };
  const releaseJson = `${JSON.stringify(releaseManifest, null, 2)}\n`;
  const releaseFile = path.join(siteDir, generatedSourceRoot(opts.root), "releases", `${opts.version}.json`);
  const reportVariant = opts.targetPrefix ? `-${opts.targetPrefix.replaceAll("/", "-")}` : "";
  const reportFile = path.join(reportsDir, `cdn-release-${opts.version}${reportVariant}.json`);
  if (!opts.dryRun) {
    await fs.mkdir(path.dirname(releaseFile), { recursive: true });
    await fs.mkdir(path.dirname(reportFile), { recursive: true });
    await fs.writeFile(releaseFile, releaseJson);
    await fs.writeFile(reportFile, releaseJson);
  }
  uploads.push({ localFile: releaseFile, key: r2Key(opts.targetPrefix, `releases/${opts.version}.json`) });
  uploads.push({ localFile: reportFile, key: r2Key(opts.targetPrefix, `reports/cdn-release-${opts.version}.json`) });
}
let cursor = 0;
async function uploadWorker() {
  while (cursor < uploads.length) {
    const upload = uploads[cursor];
    cursor += 1;
    await uploadFile(upload.localFile, upload.key, opts.dryRun);
  }
}
await Promise.all(Array.from({ length: Math.min(opts.concurrency, uploads.length) }, uploadWorker));
console.log(
  `${opts.dryRun ? "would upload" : "uploaded"} ${uploads.length} objects to `
  + `${bucket} from ${opts.root} to ${r2Key(opts.targetPrefix, "")}`,
);
