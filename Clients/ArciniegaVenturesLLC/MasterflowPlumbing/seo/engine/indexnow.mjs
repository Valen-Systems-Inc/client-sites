import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as cheerio from "cheerio";

export const INDEXNOW_MAX_URLS = 10_000;
export const DEFAULT_INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
export const DEFAULT_INDEXNOW_HOST = "masterflowplumbing.us";

const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const siteDir = path.dirname(seoDir);
const reportsDir = path.join(seoDir, "reports");
const defaultConfigFile = path.join(seoDir, "config", "indexnow.json");

const DEFAULT_SITEMAPS = [
  path.join(siteDir, ".generated.nosync", "seo-production", "sitemap_index.xml"),
  path.join(siteDir, ".generated.nosync", "commercial-production", "sitemap_index.xml"),
];

export function validateIndexNowKey(value) {
  const key = String(value ?? "").trim();
  if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) {
    throw new Error("INDEXNOW_KEY must be 8-128 characters using only letters, numbers, or dashes.");
  }
  return key;
}

export function parseIndexNowArgs(argv = process.argv.slice(2)) {
  const options = {
    submit: false,
    host: DEFAULT_INDEXNOW_HOST,
    endpoint: DEFAULT_INDEXNOW_ENDPOINT,
    key: process.env.INDEXNOW_KEY || "",
    keyLocation: "",
    sitemaps: [],
    urls: [],
    urlsFiles: [],
    maxUrls: INDEXNOW_MAX_URLS,
    changedSince: null,
    reportFile: "indexnow-plan.json",
  };

  for (const arg of argv) {
    if (arg === "--submit") options.submit = true;
    else if (arg.startsWith("--host=")) options.host = arg.slice("--host=".length).trim().toLowerCase();
    else if (arg.startsWith("--endpoint=")) options.endpoint = arg.slice("--endpoint=".length).trim();
    else if (arg.startsWith("--key=")) options.key = arg.slice("--key=".length).trim();
    else if (arg.startsWith("--key-location=")) options.keyLocation = arg.slice("--key-location=".length).trim();
    else if (arg.startsWith("--sitemap=")) options.sitemaps.push(arg.slice("--sitemap=".length).trim());
    else if (arg.startsWith("--url=")) options.urls.push(arg.slice("--url=".length).trim());
    else if (arg.startsWith("--urls-file=")) options.urlsFiles.push(arg.slice("--urls-file=".length).trim());
    else if (arg.startsWith("--max-urls=")) {
      options.maxUrls = Number.parseInt(arg.slice("--max-urls=".length), 10);
    } else if (arg.startsWith("--changed-since=")) {
      const value = arg.slice("--changed-since=".length).trim();
      const timestamp = Date.parse(value);
      if (!Number.isFinite(timestamp)) throw new Error(`Invalid --changed-since value: ${value}`);
      options.changedSince = new Date(timestamp);
    } else if (arg.startsWith("--report-file=")) {
      options.reportFile = path.basename(arg.slice("--report-file=".length));
    } else {
      throw new Error(`Unknown IndexNow argument: ${arg}`);
    }
  }

  if (!options.host || options.host.includes(":")) {
    throw new Error("--host must be a hostname without a scheme or port.");
  }
  if (!Number.isInteger(options.maxUrls) || options.maxUrls < 1 || options.maxUrls > INDEXNOW_MAX_URLS) {
    throw new Error(`--max-urls must be an integer from 1 to ${INDEXNOW_MAX_URLS}.`);
  }
  new URL(options.endpoint);

  const explicitInputs = options.sitemaps.length || options.urls.length || options.urlsFiles.length;
  if (!explicitInputs) options.sitemaps = [...DEFAULT_SITEMAPS];
  return options;
}

function isHttpSource(value) {
  return /^https?:\/\//i.test(String(value));
}

function resolveInputFile(value) {
  if (path.isAbsolute(value)) return value;
  return path.resolve(process.cwd(), value);
}

async function readTextSource(source) {
  if (isHttpSource(source)) {
    const response = await fetch(source, {
      headers: { accept: "application/xml,text/xml,text/plain;q=0.9,*/*;q=0.1" },
    });
    if (!response.ok) throw new Error(`Unable to read ${source}: HTTP ${response.status}`);
    return response.text();
  }
  return fs.readFile(resolveInputFile(source), "utf8");
}

function childSitemapSource(parentSource, childLocation) {
  if (isHttpSource(parentSource)) return new URL(childLocation, parentSource).toString();
  const childUrl = new URL(childLocation);
  return path.join(path.dirname(resolveInputFile(parentSource)), path.posix.basename(childUrl.pathname));
}

export async function collectSitemapEntries(source, visited = new Set()) {
  const sourceKey = isHttpSource(source) ? new URL(source).toString() : resolveInputFile(source);
  if (visited.has(sourceKey)) return [];
  visited.add(sourceKey);

  const xml = await readTextSource(sourceKey);
  const $ = cheerio.load(xml, { xmlMode: true });
  const childLocations = $("sitemap > loc")
    .map((_, element) => $(element).text().trim())
    .get()
    .filter(Boolean);

  if (childLocations.length) {
    const nested = [];
    for (const location of childLocations) {
      nested.push(...await collectSitemapEntries(childSitemapSource(sourceKey, location), visited));
    }
    return nested;
  }

  const entries = [];
  $("url").each((_, element) => {
    const loc = $(element).find("loc").first().text().trim();
    if (!loc) return;
    entries.push({
      loc,
      lastmod: $(element).find("lastmod").first().text().trim() || null,
      source: sourceKey,
    });
  });
  if (!entries.length) throw new Error(`No sitemap entries found in ${sourceKey}`);
  return entries;
}

function normalizeSubmissionUrl(value, host) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`IndexNow URL must use HTTPS: ${value}`);
  if (url.hostname !== host) throw new Error(`IndexNow URL does not belong to ${host}: ${value}`);
  if (url.username || url.password) throw new Error(`IndexNow URL cannot include credentials: ${value}`);
  url.hash = "";
  return url.toString();
}

async function readUrlsFile(file) {
  const body = await fs.readFile(resolveInputFile(file), "utf8");
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

export async function collectIndexNowUrls(options) {
  const entries = [];
  for (const sitemap of options.sitemaps) {
    entries.push(...await collectSitemapEntries(sitemap));
  }
  for (const value of options.urls) entries.push({ loc: value, lastmod: null, source: "--url" });
  for (const file of options.urlsFiles) {
    for (const value of await readUrlsFile(file)) {
      entries.push({ loc: value, lastmod: null, source: resolveInputFile(file) });
    }
  }

  const changedSince = options.changedSince?.getTime() ?? null;
  const selected = entries.filter((entry) => {
    if (changedSince === null || !entry.lastmod) return true;
    const lastmod = Date.parse(entry.lastmod);
    return !Number.isFinite(lastmod) || lastmod >= changedSince;
  });
  const urls = [...new Set(selected.map((entry) => normalizeSubmissionUrl(entry.loc, options.host)))].sort();
  if (!urls.length) throw new Error("IndexNow input resolved to zero URLs.");
  if (urls.length > options.maxUrls) {
    throw new Error(
      `Refusing IndexNow plan with ${urls.length} URLs; configured cap is ${options.maxUrls} and protocol maximum is ${INDEXNOW_MAX_URLS}.`,
    );
  }
  return urls;
}

export function createIndexNowPayload(options, urls) {
  const configuredKey = options.key ? validateIndexNowKey(options.key) : "";
  if (options.submit && !configuredKey) throw new Error("INDEXNOW_KEY is required with --submit.");
  const key = configuredKey || "INDEXNOW-KEY-NOT-CONFIGURED";
  const keyLocation = options.keyLocation || `https://${options.host}/${key}.txt`;
  const parsedKeyLocation = new URL(keyLocation);
  if (parsedKeyLocation.protocol !== "https:" || parsedKeyLocation.hostname !== options.host) {
    throw new Error(`IndexNow key location must be HTTPS on ${options.host}.`);
  }
  return {
    configuredKey,
    payload: {
      host: options.host,
      key,
      keyLocation,
      urlList: urls,
    },
  };
}

async function verifyKeyLocation(payload) {
  const response = await fetch(payload.keyLocation, { cache: "no-store" });
  const body = await response.text();
  if (!response.ok || body.trim() !== payload.key) {
    throw new Error(`IndexNow key verification failed at ${payload.keyLocation}: HTTP ${response.status}`);
  }
}

async function submitPayload(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  if (response.status !== 200 && response.status !== 202) {
    throw new Error(`IndexNow rejected the payload with HTTP ${response.status}: ${body.slice(0, 1000)}`);
  }
  return { status: response.status, body: body.slice(0, 1000) };
}

function reportPayload(payload, configuredKey) {
  return {
    ...payload,
    key: configuredKey ? "[configured]" : "[not configured]",
    keyLocation: configuredKey
      ? payload.keyLocation.replace(configuredKey, "[configured]")
      : payload.keyLocation,
  };
}

export async function runIndexNow(options) {
  if (!options.key) {
    let config = {};
    try {
      config = JSON.parse(await fs.readFile(defaultConfigFile, "utf8"));
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    options = {
      ...options,
      key: config.key || "",
      keyLocation: options.keyLocation || config.keyLocation || "",
    };
  }
  const urls = await collectIndexNowUrls(options);
  const { configuredKey, payload } = createIndexNowPayload(options, urls);
  const payloadSha256 = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  let response = null;
  if (options.submit) {
    await verifyKeyLocation(payload);
    response = await submitPayload(options.endpoint, payload);
  }
  return {
    generatedAt: new Date().toISOString(),
    mode: options.submit ? "submitted" : "dry_run",
    endpoint: options.endpoint,
    protocolMaximumUrls: INDEXNOW_MAX_URLS,
    configuredMaximumUrls: options.maxUrls,
    urlCount: urls.length,
    keyConfigured: Boolean(configuredKey),
    payloadSha256,
    payload: reportPayload(payload, configuredKey),
    response,
  };
}

async function main() {
  const options = parseIndexNowArgs();
  const report = await runIndexNow(options);
  await fs.mkdir(reportsDir, { recursive: true });
  const reportFile = path.join(reportsDir, options.reportFile);
  await fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `${report.mode === "submitted" ? "submitted" : "planned"} ${report.urlCount} IndexNow URLs; report ${reportFile}`,
  );
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
