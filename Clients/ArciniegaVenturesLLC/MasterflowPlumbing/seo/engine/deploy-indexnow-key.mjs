import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { validateIndexNowKey } from "./indexnow.mjs";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const engineDir = path.dirname(__filename);
const seoDir = path.dirname(engineDir);
const siteDir = path.dirname(seoDir);
const reportsDir = path.join(seoDir, "reports");
const defaultConfigFile = path.join(seoDir, "config", "indexnow.json");

const accountId = "956cd86d8e5c90c6156a7a7d937c6415";
const expectedEmail = process.env.VALEN_WRANGLER_EMAIL || "robinson.williamp2000@gmail.com";
const bucket = "valen-clients-cdn";
const wranglerVersion = "4.107.0";

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    apply: false,
    key: process.env.INDEXNOW_KEY || "",
    reportFile: "indexnow-key-deploy.json",
  };
  for (const arg of argv) {
    if (arg === "--apply") options.apply = true;
    else if (arg.startsWith("--key=")) options.key = arg.slice("--key=".length).trim();
    else if (arg.startsWith("--report-file=")) options.reportFile = path.basename(arg.slice("--report-file=".length));
    else throw new Error(`Unknown IndexNow key deploy argument: ${arg}`);
  }
  return options;
}

async function resolveKey(options) {
  if (options.key) return validateIndexNowKey(options.key);
  const config = JSON.parse(await fs.readFile(defaultConfigFile, "utf8"));
  return validateIndexNowKey(config.key);
}

async function runWrangler(args) {
  return execFileAsync("npx", ["--yes", `wrangler@${wranglerVersion}`, ...args], {
    cwd: siteDir,
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
    env: {
      ...process.env,
      CI: "1",
      WRANGLER_SEND_METRICS: "false",
      npm_config_yes: "true",
      CLOUDFLARE_ACCOUNT_ID: accountId,
    },
  });
}

async function assertWrangler() {
  const result = await runWrangler(["whoami"]);
  const output = `${result.stdout}\n${result.stderr}`;
  if (!output.toLowerCase().includes(expectedEmail.toLowerCase()) || !output.includes(accountId)) {
    throw new Error(`Wrangler is not authenticated to the Valen clients CDN account as ${expectedEmail}.`);
  }
}

async function main() {
  const options = parseArgs();
  options.key = await resolveKey(options);
  const objectKey = `masterflow-plumbing/_control/indexnow/${options.key}.txt`;
  const publicUrl = `https://clients.valen-systems.com/${objectKey}`;
  const canonicalUrl = `https://masterflowplumbing.us/${options.key}.txt`;

  if (options.apply) {
    await assertWrangler();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "masterflow-indexnow-key-"));
    const keyFile = path.join(tempDir, `${options.key}.txt`);
    try {
      await fs.writeFile(keyFile, `${options.key}\n`, "utf8");
      await runWrangler([
        "r2",
        "object",
        "put",
        `${bucket}/${objectKey}`,
        "--remote",
        "--file",
        keyFile,
        "--content-type",
        "text/plain; charset=utf-8",
      ]);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: options.apply ? "apply" : "dry_run",
    accountId,
    bucket,
    objectKey: objectKey.replace(options.key, "[indexnow-key]"),
    publicUrl: publicUrl.replace(options.key, "[indexnow-key]"),
    canonicalUrl: canonicalUrl.replace(options.key, "[indexnow-key]"),
    keyLength: options.key.length,
  };
  await fs.mkdir(reportsDir, { recursive: true });
  const reportFile = path.join(reportsDir, options.reportFile);
  await fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${options.apply ? "deployed" : "would deploy"} IndexNow key to the Valen control silo; report ${reportFile}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
