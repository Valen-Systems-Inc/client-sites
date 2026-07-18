import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerDir = path.resolve(__dirname, "..");
const configPath = path.join(workerDir, "wrangler.toml");
const action = process.argv[2] ?? "list";
const id = process.argv[3] ?? "";
const moderator = process.argv.find((arg) => arg.startsWith("--by="))?.slice(5) || "William";

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function wranglerCommand() {
  const configured = process.env.WRANGLER_BIN;
  if (configured && fs.existsSync(configured)) return { bin: configured, prefix: [] };
  return { bin: process.env.NPX_BIN || "npx", prefix: ["--yes", "wrangler@4.107.0"] };
}

function runSql(sql) {
  const command = wranglerCommand();
  const result = spawnSync(command.bin, [
    ...command.prefix,
    "d1",
    "execute",
    "masterflow_reviews",
    "--remote",
    "--config",
    configPath,
    "--command",
    sql,
    "--json",
    "--yes",
  ], {
    cwd: workerDir,
    env: {
      ...process.env,
      WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH || "/private/tmp/masterflow-review-moderation.log",
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || "Review moderation command failed.\n");
    process.exit(result.status || 1);
  }
  process.stdout.write(result.stdout);
}

if (action === "list") {
  runSql(`
    SELECT id, created_at, reviewer_name, reviewer_email, reviewer_phone,
           rating, review_text, consent_display, status
    FROM review_submissions
    WHERE status = 'pending'
    ORDER BY created_at DESC;
  `);
} else {
  if (!/^rev_[a-f0-9]{32}$/.test(id)) {
    throw new Error("A valid review id is required, for example rev_ followed by 32 lowercase hex characters.");
  }

  if (action === "approve") {
    runSql(`
      UPDATE review_submissions
      SET status = 'approved',
          moderated_at = ${sqlString(new Date().toISOString())},
          moderated_by = ${sqlString(moderator)}
      WHERE id = ${sqlString(id)} AND consent_display = 1;
      SELECT id, status, consent_display, moderated_at, moderated_by
      FROM review_submissions WHERE id = ${sqlString(id)};
    `);
  } else if (action === "reject") {
    runSql(`
      UPDATE review_submissions
      SET status = 'rejected',
          moderated_at = ${sqlString(new Date().toISOString())},
          moderated_by = ${sqlString(moderator)}
      WHERE id = ${sqlString(id)};
      SELECT id, status, consent_display, moderated_at, moderated_by
      FROM review_submissions WHERE id = ${sqlString(id)};
    `);
  } else if (action === "unpublish") {
    runSql(`
      UPDATE review_submissions
      SET status = 'pending',
          moderated_at = ${sqlString(new Date().toISOString())},
          moderated_by = ${sqlString(moderator)}
      WHERE id = ${sqlString(id)};
      SELECT id, status, consent_display, moderated_at, moderated_by
      FROM review_submissions WHERE id = ${sqlString(id)};
    `);
  } else {
    throw new Error("Use one of: list, approve <id>, reject <id>, or unpublish <id>.");
  }
}
