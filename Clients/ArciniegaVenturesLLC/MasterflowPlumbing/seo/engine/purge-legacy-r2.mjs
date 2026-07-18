import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const reportsDir = path.join(seoDir, "reports");
const archiveProofFile = path.join(reportsDir, "valen-clients-cdn-rollback-migration.json");

const SOURCE = {
  accountId: "f3c8cc51d06b88d2dc0f3ff25f5aeacf",
  bucket: "masterflowplumbing-cdn",
};
const ARCHIVE = {
  accountId: "956cd86d8e5c90c6156a7a7d937c6415",
  bucket: "valen-clients-cdn",
  prefix: "masterflow-plumbing/_rollback/masterflowplumbing-cdn-2026-07-16",
};
const REQUIRED_CONFIRMATION = `EMPTY-${SOURCE.bucket}`;
const API_BASE = "https://api.cloudflare.com/client/v4";
const WRANGLER_CONFIG = path.join(
  os.homedir(),
  "Library",
  "Preferences",
  ".wrangler",
  "config",
  "default.toml",
);

export function parsePurgeArgs(argv = process.argv.slice(2)) {
  const options = {
    apply: false,
    confirmation: "",
    concurrency: 8,
    reportFile: "legacy-r2-purge.json",
  };
  for (const arg of argv) {
    if (arg === "--apply") options.apply = true;
    else if (arg.startsWith("--confirm=")) options.confirmation = arg.slice("--confirm=".length);
    else if (arg.startsWith("--concurrency=")) {
      options.concurrency = Number.parseInt(arg.slice("--concurrency=".length), 10);
    } else if (arg.startsWith("--report-file=")) {
      options.reportFile = path.basename(arg.slice("--report-file=".length));
    } else {
      throw new Error(`Unknown legacy R2 purge argument: ${arg}`);
    }
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 32) {
    throw new Error("--concurrency must be an integer from 1 to 32.");
  }
  if (options.apply && options.confirmation !== REQUIRED_CONFIRMATION) {
    throw new Error(`Refusing deletion without --confirm=${REQUIRED_CONFIRMATION}`);
  }
  return options;
}

function encodeObjectKey(key) {
  return String(key)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function objectApiUrl(target, key) {
  return `${API_BASE}/accounts/${target.accountId}/r2/buckets/${encodeURIComponent(target.bucket)}/objects/${encodeObjectKey(key)}`;
}

function listApiUrl(target, cursor = "") {
  const url = new URL(
    `${API_BASE}/accounts/${target.accountId}/r2/buckets/${encodeURIComponent(target.bucket)}/objects`,
  );
  url.searchParams.set("per_page", "1000");
  if (cursor) url.searchParams.set("cursor", cursor);
  return url;
}

async function resolveToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  const config = await fs.readFile(WRANGLER_CONFIG, "utf8");
  const tokenMatch = config.match(/^oauth_token\s*=\s*"([^"]+)"/m);
  const expirationMatch = config.match(/^expiration_time\s*=\s*"([^"]+)"/m);
  if (!tokenMatch) throw new Error(`No Cloudflare token found in ${WRANGLER_CONFIG}`);
  if (expirationMatch && Date.parse(expirationMatch[1]) <= Date.now()) {
    throw new Error(`Wrangler OAuth token expired at ${expirationMatch[1]}`);
  }
  return tokenMatch[1];
}

async function cloudflareFetch(url, token, init = {}, attempts = 8) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let retryAfterMs = 0;
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          authorization: `Bearer ${token}`,
          ...(init.headers ?? {}),
        },
      });
      if (response.ok) return response;
      const detail = await response.text();
      if (response.status < 500 && response.status !== 429) {
        throw new Error(`Cloudflare API ${response.status}: ${detail}`);
      }
      lastError = new Error(`Cloudflare API ${response.status}: ${detail}`);
      if (response.status === 429) {
        const retryAfterSeconds = Number(response.headers.get("retry-after"));
        retryAfterMs = Number.isFinite(retryAfterSeconds)
          ? retryAfterSeconds * 1000
          : Math.min(5000 * attempt, 30_000);
      }
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) {
      const delay = retryAfterMs || Math.min(attempt * 1000, 8000);
      await new Promise((resolve) => setTimeout(resolve, delay + Math.floor(Math.random() * 500)));
    }
  }
  throw lastError;
}

async function listObjects(target, token, prefix = "") {
  const objects = [];
  let cursor = "";
  do {
    const response = await cloudflareFetch(listApiUrl(target, cursor), token);
    const payload = await response.json();
    if (!payload.success) throw new Error(`R2 listing failed: ${JSON.stringify(payload.errors ?? payload)}`);
    const pageObjects = Array.isArray(payload.result) ? payload.result : payload.result?.objects ?? [];
    for (const object of pageObjects) {
      if (!prefix || String(object.key).startsWith(prefix)) objects.push(object);
    }
    const info = payload.result_info ?? payload.resultInfo ?? {};
    const truncated = info.is_truncated ?? info.isTruncated ?? payload.result?.truncated ?? false;
    cursor = truncated ? info.cursor ?? payload.result?.cursor ?? "" : "";
  } while (cursor);
  return objects;
}

function comparableEtag(value) {
  return String(value ?? "").replace(/^W\//, "").replaceAll('"', "");
}

function normalizedHttpMetadata(object) {
  const metadata = object?.http_metadata ?? object?.httpMetadata ?? {};
  return {
    contentType: metadata.contentType || "application/octet-stream",
    contentLanguage: metadata.contentLanguage || "",
    contentDisposition: metadata.contentDisposition || "",
    contentEncoding: metadata.contentEncoding || "",
    cacheControl: metadata.cacheControl || "",
    cacheExpiry: metadata.cacheExpiry || metadata.expires || "",
  };
}

function normalizedCustomMetadata(object) {
  return Object.fromEntries(
    Object.entries(object?.custom_metadata ?? object?.customMetadata ?? {})
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function archiveKey(sourceKey) {
  return sourceKey ? `${ARCHIVE.prefix}/${sourceKey}` : `${ARCHIVE.prefix}/`;
}

export function compareArchive(sourceObjects, archiveObjects) {
  const archiveByKey = new Map(archiveObjects.map((object) => [object.key, object]));
  const missing = [];
  const mismatched = [];
  for (const source of sourceObjects) {
    const targetKey = archiveKey(source.key);
    const archived = archiveByKey.get(targetKey);
    if (!archived) {
      missing.push({ sourceKey: source.key, archiveKey: targetKey });
      continue;
    }
    const matches = Number(source.size) === Number(archived.size)
      && comparableEtag(source.etag) === comparableEtag(archived.etag)
      && JSON.stringify(normalizedHttpMetadata(source)) === JSON.stringify(normalizedHttpMetadata(archived))
      && JSON.stringify(normalizedCustomMetadata(source)) === JSON.stringify(normalizedCustomMetadata(archived));
    if (!matches) {
      mismatched.push({
        sourceKey: source.key,
        archiveKey: targetKey,
        sourceSize: Number(source.size),
        archiveSize: Number(archived.size),
        sourceEtag: comparableEtag(source.etag),
        archiveEtag: comparableEtag(archived.etag),
      });
    }
  }
  const expectedKeys = new Set(sourceObjects.map((object) => archiveKey(object.key)));
  const unexpected = archiveObjects
    .filter((object) => !expectedKeys.has(object.key))
    .map((object) => object.key);
  return { missing, mismatched, unexpected };
}

async function runQueue(items, concurrency, worker) {
  let cursor = 0;
  const failures = [];
  let completed = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        await worker(items[index]);
        completed += 1;
        if (completed % 100 === 0 || completed === items.length) {
          console.log(`deleted ${completed}/${items.length} legacy objects`);
        }
      } catch (error) {
        failures.push({
          key: items[index].key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });
  await Promise.all(workers);
  return failures;
}

function inventory(objects) {
  return {
    objectCount: objects.length,
    totalBytes: objects.reduce((total, object) => total + Number(object.size || 0), 0),
  };
}

async function writeReport(report, fileName) {
  await fs.mkdir(reportsDir, { recursive: true });
  const file = path.join(reportsDir, fileName);
  await fs.writeFile(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}

export async function runPurge(options) {
  const token = await resolveToken();
  const sourceObjects = await listObjects(SOURCE, token);
  const archiveObjects = await listObjects(ARCHIVE, token, `${ARCHIVE.prefix}/`);
  const comparison = compareArchive(sourceObjects, archiveObjects);
  let archiveVerified;
  let archiveProof = null;
  if (sourceObjects.length === 0) {
    archiveProof = JSON.parse(await fs.readFile(archiveProofFile, "utf8"));
    archiveVerified = archiveProof.verification?.passed === true
      && Number(archiveProof.destination?.objectCount) === archiveObjects.length
      && Number(archiveProof.destination?.totalBytes) === inventory(archiveObjects).totalBytes
      && archiveProof.destination?.bucket === ARCHIVE.bucket
      && archiveProof.destination?.prefix === ARCHIVE.prefix;
  } else {
    archiveVerified = comparison.missing.length === 0
      && comparison.mismatched.length === 0
      && comparison.unexpected.length === 0
      && sourceObjects.length === archiveObjects.length;
  }

  if (!archiveVerified) {
    throw new Error(
      `Refusing legacy purge: rollback archive differs (missing ${comparison.missing.length}, mismatched ${comparison.mismatched.length}, unexpected ${comparison.unexpected.length}).`,
    );
  }

  let deleteFailures = [];
  if (options.apply && sourceObjects.length) {
    deleteFailures = await runQueue(sourceObjects, options.concurrency, async (object) => {
      await cloudflareFetch(objectApiUrl(SOURCE, object.key), token, { method: "DELETE" });
    });
  }
  const remainingObjects = options.apply ? await listObjects(SOURCE, token) : sourceObjects;
  const report = {
    generatedAt: new Date().toISOString(),
    mode: options.apply ? "apply" : "dry_run",
    source: { ...SOURCE, ...inventory(sourceObjects) },
    archive: { ...ARCHIVE, ...inventory(archiveObjects) },
    sourceAlreadyEmpty: sourceObjects.length === 0,
    archiveVerification: {
      passed: archiveVerified,
      proofFile: sourceObjects.length === 0 ? "seo/reports/valen-clients-cdn-rollback-migration.json" : null,
      proofGeneratedAt: archiveProof?.generatedAt ?? null,
      ...(sourceObjects.length === 0
        ? { missing: [], mismatched: [], unexpected: [] }
        : comparison),
    },
    deletedObjects: options.apply ? sourceObjects.length - deleteFailures.length : 0,
    deleteFailures,
    remaining: { ...SOURCE, ...inventory(remainingObjects) },
    passed: archiveVerified && deleteFailures.length === 0 && (!options.apply || remainingObjects.length === 0),
  };
  const reportFile = await writeReport(report, options.reportFile);
  return { report, reportFile };
}

async function main() {
  const options = parsePurgeArgs();
  const { report, reportFile } = await runPurge(options);
  console.log(
    `${options.apply ? "purged" : "would purge"} ${report.source.objectCount} objects from ${SOURCE.bucket}; report ${reportFile}`,
  );
  if (!report.passed) process.exitCode = 1;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
