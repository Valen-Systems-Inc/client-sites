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

const accountId = "f3c8cc51d06b88d2dc0f3ff25f5aeacf";
const expectedEmail = "masterflowplumbing2024@gmail.com";
const bucket = "masterflowplumbing-cdn";
const defaultWrangler = "/tmp/wrangler-masterflow-client-home/.npm/_npx/32026684e21afda6/node_modules/.bin/wrangler";
const wranglerBin = process.env.WRANGLER_BIN || defaultWrangler;
const npxBin = process.env.NPX_BIN || "npx";
const clientHome = process.env.MASTERFLOW_WRANGLER_HOME || "/tmp/wrangler-masterflow-client-home";
const clientConfig = process.env.MASTERFLOW_WRANGLER_CONFIG_HOME || "/tmp/wrangler-masterflow-client-config";
let wranglerCommand;

function parseArgs(argv = process.argv.slice(2)) {
  const opts = { root: "seo-preview", targetPrefix: "seo-preview", dryRun: false, includeMedia: true, concurrency: 4 };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--skip-media") opts.includeMedia = false;
    else if (arg.startsWith("--prefix=")) {
      const prefix = normalizeR2Prefix(arg.slice("--prefix=".length));
      opts.root = prefix;
      opts.targetPrefix = prefix;
    }
    else if (arg.startsWith("--root=")) opts.root = arg.slice("--root=".length).replace(/^\/+|\/+$/g, "");
    else if (arg.startsWith("--target-prefix=")) opts.targetPrefix = normalizeR2Prefix(arg.slice("--target-prefix=".length));
    else if (arg.startsWith("--concurrency=")) opts.concurrency = Math.max(1, Number(arg.slice("--concurrency=".length)) || 1);
  }
  return opts;
}

function normalizeR2Prefix(value) {
  return String(value ?? "").replace(/^\/+|\/+$/g, "");
}

function escapeGlob(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function r2Key(targetPrefix, relUnderRoot) {
  return [targetPrefix, relUnderRoot].filter(Boolean).join("/");
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".xml") return "application/xml; charset=utf-8";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".mov") return "video/quicktime";
  return "application/octet-stream";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
        HOME: clientHome,
        XDG_CONFIG_HOME: clientConfig,
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
    wranglerCommand = { bin: npxBin, prefixArgs: ["--yes", "wrangler@latest"] };
    return wranglerCommand;
  }
}

async function assertWrangler() {
  const whoami = await run(["whoami"], { quiet: true });
  const text = `${whoami.stdout}\n${whoami.stderr}`;
  if (!text.includes(expectedEmail)) {
    throw new Error(`Refusing R2 deploy: Wrangler is not authenticated as ${expectedEmail}. Output:\n${text}`);
  }
  if (!text.includes(accountId)) {
    throw new Error(`Refusing R2 deploy: Wrangler is not scoped to Masterflow account ${accountId}. Output:\n${text}`);
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
  const sourceRoot = path.join(siteDir, opts.root);
  await fs.access(sourceRoot);
  const sourceFiles = await fg(`${escapeGlob(opts.root)}/**/*`, {
    cwd: siteDir,
    onlyFiles: true,
    dot: false,
  });
  const uploads = [];
  for (const rel of sourceFiles) {
    const relUnderRoot = path.relative(opts.root, rel).split(path.sep).join("/");
    const key = r2Key(opts.targetPrefix, relUnderRoot);
    uploads.push({ localFile: path.join(siteDir, rel), key });
    if (rel.endsWith("/index.html")) {
      const slashKey = key.slice(0, -"index.html".length);
      uploads.push({ localFile: path.join(siteDir, rel), key: slashKey });
    }
  }
  if (opts.includeMedia) {
    const mediaFiles = await fg("media/**/*", { cwd: siteDir, onlyFiles: true, dot: false });
    for (const rel of mediaFiles) uploads.push({ localFile: path.join(siteDir, rel), key: rel });
  }
  return uploads;
}

const opts = parseArgs();
await assertWrangler();
const uploads = await collectUploads(opts);
let cursor = 0;
async function uploadWorker() {
  while (cursor < uploads.length) {
    const upload = uploads[cursor];
    cursor += 1;
    await uploadFile(upload.localFile, upload.key, opts.dryRun);
  }
}
await Promise.all(Array.from({ length: Math.min(opts.concurrency, uploads.length) }, uploadWorker));
console.log(`${opts.dryRun ? "would upload" : "uploaded"} ${uploads.length} objects to ${bucket} from ${opts.root} to ${opts.targetPrefix || "(bucket root)"}`);
