// valen-seo-build-report
// SCOPE: report/preview ingestion ONLY. No R2 upload, no DNS, no publish,
// no ads, no outreach, no contact writes.

function asRows(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  if (result && Array.isArray(result.data)) return result.data;
  if (result && Array.isArray(result.insertedRows)) return result.insertedRows;
  return [];
}

function safeParse(value) {
  if (value == null) return value;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
}

function normalizeGuardName(name) {
  return String(name || "")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function normalizeGuards(report) {
  const rawGuards = report && report.guards;
  if (Array.isArray(rawGuards)) {
    return rawGuards.map((guard) => ({
      gate: normalizeGuardName(guard.name || guard.gate || guard.key || "guard"),
      pass: guard.pass === true,
      detail: guard,
    }));
  }

  if (rawGuards && typeof rawGuards === "object") {
    return Object.keys(rawGuards).map((key) => {
      const guard = rawGuards[key] || {};
      return {
        gate: normalizeGuardName(key),
        pass: guard.pass === true || guard.status === "pass",
        detail: guard,
      };
    });
  }

  if (report && report.allPass === true) {
    return [
      { gate: "all_pass", pass: true, detail: { source: "report.allPass" } },
    ];
  }

  return [];
}

function reportPageCount(report) {
  const counts = report.counts || {};
  const pages = report.pages || {};
  return Number(
    counts.pages ||
      counts.totalPages ||
      pages.total ||
      pages.count ||
      report.pages_total ||
      report.page_count ||
      0,
  );
}

function compactReport(report) {
  const counts = report.counts || {};
  const pipeline = report.pipeline || {};
  return {
    allPass: report.allPass === true,
    generatedAt: report.generatedAt || report.generated_at || null,
    client_slug: report.client_slug || "masterflow-plumbing",
    milestone: report.milestone || "strt-7-private-preview",
    counts,
    indexable: report.indexable === true,
    pipeline: {
      framework: pipeline.framework || "ValenFramework",
      pattern: pipeline.pattern || "Build -> Match -> Verify -> Execute",
      currentPhase: pipeline.currentPhase || "usage",
      verifyBeforeExecute: pipeline.verifyBeforeExecute !== false,
      approvalGate:
        (pipeline.runtimeBridge && pipeline.runtimeBridge.approvalGate) ||
        "queue-runtime-shipment before indexable publish, DNS, ads, outreach, or contact writes",
    },
    issues: Array.isArray(report.issues) ? report.issues.slice(0, 25) : [],
  };
}

async function latestFor(clientSlug) {
  const rows = asRows(
    await db.query("seo_build_reports", {
      filters: [{ column: "client_slug", operator: "eq", value: clientSlug }],
      limit: 100,
    }),
  ).sort((a, b) => {
    const at = new Date(a.created_at || a.createdAt || 0).getTime();
    const bt = new Date(b.created_at || b.createdAt || 0).getTime();
    return bt - at;
  });
  const latest = rows[0] || null;
  if (!latest) return null;
  latest.report_json = safeParse(latest.report_json);
  latest.gates_json = safeParse(latest.gates_json);
  return latest;
}

async function historyFor(clientSlug) {
  return asRows(
    await db.query("seo_build_reports", {
      filters: [{ column: "client_slug", operator: "eq", value: clientSlug }],
      limit: 100,
    }),
  )
    .sort((a, b) => {
      const at = new Date(a.created_at || a.createdAt || 0).getTime();
      const bt = new Date(b.created_at || b.createdAt || 0).getTime();
      return bt - at;
    })
    .slice(0, 20)
    .map((row) => ({
      id: row.id,
      milestone: row.milestone,
      pages_total: row.pages_total,
      gates_passed: row.gates_passed,
      gates_total: row.gates_total,
      status: row.status,
      created_at: row.created_at || row.createdAt || null,
    }));
}

async function handle() {
  const method = (request.method || "GET").toUpperCase();
  const query = request.query || {};

  if (method === "GET") {
    const clientSlug = query.client_slug || "masterflow-plumbing";
    return respond(200, {
      ok: true,
      mode: "report-read",
      client_slug: clientSlug,
      latest: await latestFor(clientSlug),
      history: await historyFor(clientSlug),
      privacy_model:
        "private permalink UI + report hook; no publish, DNS, R2, ads, outreach, or contact writes",
      note: "This is the always-on Audos report surface for the Masterflow SEO engine.",
    });
  }

  if (method === "POST") {
    const body = request.body || {};
    const report = body.report || body;
    const clientSlug = report.client_slug || body.client_slug || "masterflow-plumbing";
    const gates = normalizeGuards(report);
    const passed = gates.filter((gate) => gate.pass).length;
    const total = gates.length;
    const pagesTotal = reportPageCount(report);
    const allPass = report.allPass === true || (total > 0 && passed === total);
    const status = allPass ? "pass" : "fail";
    const normalized = compactReport(report);

    const inserted = await db.insert("seo_build_reports", {
      client_slug: clientSlug,
      report_version: report.report_version || "2",
      milestone: report.milestone || "strt-7-private-preview",
      pages_total: pagesTotal || null,
      gates_passed: passed,
      gates_total: total,
      status,
      report_json: JSON.stringify({ ...normalized, raw: report }),
      gates_json: JSON.stringify(gates),
    });
    const insertedRows = asRows(inserted);
    const created = insertedRows[0] || inserted || {};

    return respond(200, {
      ok: true,
      mode: "report-ingest",
      client_slug: clientSlug,
      stored_id: created.id || null,
      pages_total: pagesTotal || null,
      gates_passed: passed,
      gates_total: total,
      status,
      allPass,
      gates,
      note:
        "Ingested as private preview/report only. No site published, no DNS, no R2 upload, no ads/outreach/contact writes.",
    });
  }

  return respond(405, {
    ok: false,
    error: "method_not_allowed",
    allowed: ["GET", "POST"],
  });
}

return handle();
