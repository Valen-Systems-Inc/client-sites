import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const reportsDir = path.join(seoDir, "reports");

const DEFAULT_SOURCE = {
  accountId: "f3c8cc51d06b88d2dc0f3ff25f5aeacf",
  bucket: "masterflowplumbing-cdn",
};

const DEFAULT_DESTINATION = {
  accountId: "956cd86d8e5c90c6156a7a7d937c6415",
  bucket: "valen-clients-cdn",
  prefix: "masterflow-plumbing",
  publicBaseUrl: "https://clients.valen-systems.com/masterflow-plumbing",
};

const API_BASE = "https://api.cloudflare.com/client/v4";
const WRANGLER_CONFIG = path.join(
  os.homedir(),
  "Library",
  "Preferences",
  ".wrangler",
  "config",
  "default.toml",
);

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    apply: false,
    verifyOnly: false,
    concurrency: 2,
    reportFile: "valen-clients-cdn-migration.json",
    source: { ...DEFAULT_SOURCE },
    destination: { ...DEFAULT_DESTINATION },
  };

  for (const arg of argv) {
    if (arg === "--apply") options.apply = true;
    else if (arg === "--verify-only") options.verifyOnly = true;
    else if (arg.startsWith("--concurrency=")) {
      const parsed = Number.parseInt(arg.slice("--concurrency=".length), 10);
      options.concurrency = Math.max(1, Math.min(Number.isFinite(parsed) ? parsed : 2, 32));
    } else if (arg.startsWith("--source-account=")) {
      options.source.accountId = arg.slice("--source-account=".length);
    } else if (arg.startsWith("--source-bucket=")) {
      options.source.bucket = arg.slice("--source-bucket=".length);
    } else if (arg.startsWith("--destination-account=")) {
      options.destination.accountId = arg.slice("--destination-account=".length);
    } else if (arg.startsWith("--destination-bucket=")) {
      options.destination.bucket = arg.slice("--destination-bucket=".length);
    } else if (arg.startsWith("--destination-prefix=")) {
      options.destination.prefix = normalizePrefix(arg.slice("--destination-prefix=".length));
    } else if (arg.startsWith("--destination-public-base=")) {
      options.destination.publicBaseUrl = arg
        .slice("--destination-public-base=".length)
        .replace(/\/+$/, "");
    } else if (arg.startsWith("--report-file=")) {
      const reportFile = path.basename(arg.slice("--report-file=".length));
      if (!reportFile.endsWith(".json")) throw new Error("Migration report file must end in .json.");
      options.reportFile = reportFile;
    }
  }

  if (options.verifyOnly) options.apply = false;
  return options;
}

function normalizePrefix(value) {
  return String(value ?? "").replace(/^\/+|\/+$/g, "");
}

function encodeObjectKey(key) {
  return String(key)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function destinationKey(prefix, sourceKey) {
  const cleanPrefix = normalizePrefix(prefix);
  if (!cleanPrefix) return sourceKey;
  if (!sourceKey) return `${cleanPrefix}/`;
  return `${cleanPrefix}/${sourceKey}`;
}

function objectApiUrl(accountId, bucket, key) {
  return `${API_BASE}/accounts/${accountId}/r2/buckets/${encodeURIComponent(bucket)}/objects/${encodeObjectKey(key)}`;
}

function listApiUrl(accountId, bucket, cursor = "") {
  const url = new URL(
    `${API_BASE}/accounts/${accountId}/r2/buckets/${encodeURIComponent(bucket)}/objects`,
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
  if (!tokenMatch) {
    throw new Error(`No CLOUDFLARE_API_TOKEN and no oauth_token in ${WRANGLER_CONFIG}`);
  }
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
          : Math.min(5000 * attempt, 30000);
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      const delay = retryAfterMs || Math.min(attempt * 1000, 8000);
      await new Promise((resolve) =>
        setTimeout(resolve, delay + Math.floor(Math.random() * 500)),
      );
    }
  }
  throw lastError;
}

async function listObjects(target, token, prefix = "") {
  const objects = [];
  let cursor = "";

  do {
    const response = await cloudflareFetch(
      listApiUrl(target.accountId, target.bucket, cursor),
      token,
    );
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(`Object listing failed: ${JSON.stringify(payload.errors ?? payload)}`);
    }

    const pageObjects = Array.isArray(payload.result)
      ? payload.result
      : payload.result?.objects ?? [];
    for (const object of pageObjects) {
      if (!prefix || String(object.key).startsWith(prefix)) objects.push(object);
    }
    const resultInfo = payload.result_info ?? payload.resultInfo ?? {};
    const truncated =
      resultInfo.is_truncated ??
      resultInfo.isTruncated ??
      payload.result?.truncated ??
      false;
    cursor = truncated
      ? resultInfo.cursor ?? payload.result?.cursor ?? ""
      : "";
  } while (cursor);

  return objects;
}

function comparableEtag(value) {
  return String(value ?? "").replace(/^W\//, "").replaceAll('"', "");
}

function normalizedHttpMetadata(object) {
  const metadata = object?.http_metadata ?? object?.httpMetadata ?? {};
  const cacheExpiry = metadata.cacheExpiry ?? metadata.expires ?? "";
  return {
    contentType: metadata.contentType || "application/octet-stream",
    contentLanguage: metadata.contentLanguage || "",
    contentDisposition: metadata.contentDisposition || "",
    contentEncoding: metadata.contentEncoding || "",
    cacheControl: metadata.cacheControl || "",
    cacheExpiry: cacheExpiry ? new Date(cacheExpiry).toISOString() : "",
  };
}

function normalizedCustomMetadata(object) {
  return Object.fromEntries(
    Object.entries(
      object?.custom_metadata ?? object?.customMetadata ?? {},
    ).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function objectsMatch(source, destination) {
  if (!destination) return false;
  if (Number(source.size) !== Number(destination.size)) return false;
  const sourceEtag = comparableEtag(source.etag);
  const destinationEtag = comparableEtag(destination.etag);
  if (!sourceEtag || !destinationEtag || sourceEtag !== destinationEtag) {
    return false;
  }
  if (
    JSON.stringify(normalizedHttpMetadata(source)) !==
    JSON.stringify(normalizedHttpMetadata(destination))
  ) {
    return false;
  }
  return (
    JSON.stringify(normalizedCustomMetadata(source)) ===
    JSON.stringify(normalizedCustomMetadata(destination))
  );
}

function copyHeaders(sourceObject, sourceResponse) {
  const headers = {};
  const metadata = sourceObject.http_metadata ?? sourceObject.httpMetadata ?? {};
  const knownHeaders = {
    contentType: "content-type",
    contentLanguage: "content-language",
    contentDisposition: "content-disposition",
    contentEncoding: "content-encoding",
    cacheControl: "cache-control",
    cacheExpiry: "expires",
  };

  for (const [property, header] of Object.entries(knownHeaders)) {
    const value = metadata[property];
    if (value) headers[header] = value;
  }
  if (!headers["content-type"]) {
    headers["content-type"] =
      sourceResponse.headers.get("content-type") || "application/octet-stream";
  }

  for (const [name, value] of Object.entries(
    sourceObject.custom_metadata ?? sourceObject.customMetadata ?? {},
  )) {
    headers[`x-amz-meta-${name}`] = String(value);
  }

  return headers;
}

async function copyObject(sourceObject, options, token) {
  const sourceUrl = objectApiUrl(
    options.source.accountId,
    options.source.bucket,
    sourceObject.key,
  );
  const targetKey = destinationKey(options.destination.prefix, sourceObject.key);
  const destinationUrl = objectApiUrl(
    options.destination.accountId,
    options.destination.bucket,
    targetKey,
  );

  const sourceResponse = await cloudflareFetch(sourceUrl, token);
  const body = await sourceResponse.arrayBuffer();
  if (body.byteLength !== Number(sourceObject.size)) {
    throw new Error(
      `Source byte count changed for ${JSON.stringify(sourceObject.key)}: listed ${sourceObject.size}, fetched ${body.byteLength}`,
    );
  }

  await cloudflareFetch(destinationUrl, token, {
    method: "PUT",
    headers: copyHeaders(sourceObject, sourceResponse),
    body,
  });

  return {
    sourceKey: sourceObject.key,
    destinationKey: targetKey,
    size: body.byteLength,
  };
}

async function runQueue(items, concurrency, worker) {
  let nextIndex = 0;
  const results = new Array(items.length);
  const failures = [];

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;
        try {
          results[index] = await worker(items[index], index);
        } catch (error) {
          failures.push({
            key: items[index].key,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    },
  );

  await Promise.all(workers);
  return { results: results.filter(Boolean), failures };
}

function inventory(objects) {
  return {
    objectCount: objects.length,
    totalBytes: objects.reduce((total, object) => total + Number(object.size || 0), 0),
  };
}

function compareInventories(sourceObjects, destinationObjects, prefix) {
  const destinationByKey = new Map(
    destinationObjects.map((object) => [object.key, object]),
  );
  const missing = [];
  const mismatched = [];

  for (const source of sourceObjects) {
    const targetKey = destinationKey(prefix, source.key);
    const destination = destinationByKey.get(targetKey);
    if (!destination) {
      missing.push({ sourceKey: source.key, destinationKey: targetKey });
    } else if (!objectsMatch(source, destination)) {
      mismatched.push({
        sourceKey: source.key,
        destinationKey: targetKey,
        sourceSize: Number(source.size),
        destinationSize: Number(destination.size),
        sourceEtag: comparableEtag(source.etag),
        destinationEtag: comparableEtag(destination.etag),
        sourceHttpMetadata: normalizedHttpMetadata(source),
        destinationHttpMetadata: normalizedHttpMetadata(destination),
        sourceCustomMetadata: normalizedCustomMetadata(source),
        destinationCustomMetadata: normalizedCustomMetadata(destination),
      });
    }
  }

  return { missing, mismatched };
}

async function writeReport(report, reportFile) {
  await fs.mkdir(reportsDir, { recursive: true });
  const file = path.join(reportsDir, reportFile);
  await fs.writeFile(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}

const options = parseArgs();
const token = await resolveToken();

console.log(
  `Inventorying r2://${options.source.bucket} and r2://${options.destination.bucket}/${options.destination.prefix}/`,
);
const sourceObjects = await listObjects(options.source, token);
if (sourceObjects.length === 0) {
  throw new Error(
    `Refusing migration: source bucket ${options.source.bucket} returned zero objects.`,
  );
}
let destinationObjects = await listObjects(
  options.destination,
  token,
  `${normalizePrefix(options.destination.prefix)}/`,
);
const beforeComparison = compareInventories(
  sourceObjects,
  destinationObjects,
  options.destination.prefix,
);
const destinationByKey = new Map(
  destinationObjects.map((object) => [object.key, object]),
);
const pending = sourceObjects.filter((sourceObject) => {
  const targetKey = destinationKey(options.destination.prefix, sourceObject.key);
  return !objectsMatch(sourceObject, destinationByKey.get(targetKey));
});

console.log(
  JSON.stringify(
    {
      mode: options.verifyOnly ? "verify_only" : options.apply ? "apply" : "dry_run",
      source: { ...options.source, ...inventory(sourceObjects) },
      destinationBefore: {
        ...options.destination,
        ...inventory(destinationObjects),
      },
      pendingObjects: pending.length,
      pendingBytes: pending.reduce(
        (total, object) => total + Number(object.size || 0),
        0,
      ),
      missingBefore: beforeComparison.missing.length,
      mismatchedBefore: beforeComparison.mismatched.length,
    },
    null,
    2,
  ),
);

let copyResults = [];
let copyFailures = [];
if (options.apply && pending.length) {
  const queue = await runQueue(
    pending,
    options.concurrency,
    async (sourceObject, index) => {
      const result = await copyObject(sourceObject, options, token);
      if ((index + 1) % 25 === 0 || index + 1 === pending.length) {
        console.log(
          `copied ${index + 1}/${pending.length}; latest ${JSON.stringify(sourceObject.key)}`,
        );
      }
      return result;
    },
  );
  copyResults = queue.results;
  copyFailures = queue.failures;
}

if (options.apply || options.verifyOnly) {
  destinationObjects = await listObjects(
    options.destination,
    token,
    `${normalizePrefix(options.destination.prefix)}/`,
  );
}
const afterComparison = compareInventories(
  sourceObjects,
  destinationObjects,
  options.destination.prefix,
);
const report = {
  generatedAt: new Date().toISOString(),
  mode: options.verifyOnly ? "verify_only" : options.apply ? "apply" : "dry_run",
  source: { ...options.source, ...inventory(sourceObjects) },
  destination: {
    ...options.destination,
    ...inventory(destinationObjects),
  },
  copiedObjects: copyResults.length,
  copiedBytes: copyResults.reduce((total, result) => total + result.size, 0),
  copyFailures,
  verification: {
    passed:
      copyFailures.length === 0 &&
      afterComparison.missing.length === 0 &&
      afterComparison.mismatched.length === 0,
    missing: afterComparison.missing,
    mismatched: afterComparison.mismatched,
  },
};
const reportFile = await writeReport(report, options.reportFile);
console.log(`Migration report: ${reportFile}`);

if ((options.apply || options.verifyOnly) && !report.verification.passed) {
  process.exitCode = 1;
}
