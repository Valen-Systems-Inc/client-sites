const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const SALES_EMAIL = "sales@masterflowplumbing.us";
const WEBSITE_EMAIL = "website@masterflowplumbing.us";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ORIGINS = new Set([
  "https://masterflowplumbing.us",
  "https://www.masterflowplumbing.us",
  "https://clients.valen-systems.com",
]);

function cleanText(value, maxLength) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function boolFromFormValue(value) {
  return value === true || value === "true" || value === "1" || value === "on" || value === "yes";
}

function emailIsValid(value) {
  return EMAIL_PATTERN.test(value);
}

function requestOrigin(request) {
  const origin = request?.headers?.get("origin") ?? "";
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  if (/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin)) return origin;
  return "";
}

function responseHeaders(request, extra = {}) {
  const origin = requestOrigin(request);
  return {
    ...JSON_HEADERS,
    ...(origin ? { "access-control-allow-origin": origin, vary: "Origin" } : {}),
    ...extra,
  };
}

function publicReviewRow(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    reviewerName: row.reviewer_name,
    rating: row.rating,
    reviewText: row.review_text,
  };
}

async function parsePayload(request) {
  const contentLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > 32_768) throw new Error("Submission is too large.");
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return request.json();
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function requestMetadata(request) {
  const headers = request.headers;
  return {
    ipAddress: cleanText(headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown", 80),
    userAgent: cleanText(headers.get("user-agent"), 500),
    country: cleanText(headers.get("cf-ipcountry"), 12),
    cfRay: cleanText(headers.get("cf-ray"), 80),
    referer: cleanText(headers.get("referer"), 500),
  };
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function jsonResponse(body, status = 200, request = null) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(request) });
}

export function validateReviewPayload(payload) {
  const reviewerName = cleanText(payload.reviewerName ?? payload.name, 80);
  const reviewerEmail = cleanText(payload.reviewerEmail ?? payload.email, 160).toLowerCase();
  const reviewerPhone = cleanText(payload.reviewerPhone ?? payload.phone, 40);
  const reviewText = cleanText(payload.reviewText ?? payload.text, 2000);
  const sourcePath = cleanText(payload.sourcePath, 220) || "/reviews/";
  const rating = Number.parseInt(payload.rating, 10);
  const consentIpCollection = boolFromFormValue(payload.consentIpCollection);
  const consentDisplay = boolFromFormValue(payload.consentDisplay);

  if (cleanText(payload.companyWebsite, 200)) return { ok: false, spam: true, error: "Submission rejected." };
  if (reviewerName.length < 2) return { ok: false, error: "Please enter your name." };
  if (!emailIsValid(reviewerEmail)) return { ok: false, error: "Please enter a valid email address." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: "Please choose a rating from 1 to 5." };
  if (reviewText.length < 20) return { ok: false, error: "Please write at least 20 characters about your experience." };
  if (!consentIpCollection) return { ok: false, error: "Consent is required so Masterflow can privately verify and audit the review." };

  return {
    ok: true,
    value: {
      reviewerName,
      reviewerEmail,
      reviewerPhone,
      rating,
      reviewText,
      sourcePath,
      consentIpCollection,
      consentDisplay,
    },
  };
}

export function validateServiceRequestPayload(payload) {
  const siteVariant = cleanText(payload.siteVariant, 24).toLowerCase() === "commercial" ? "commercial" : "residential";
  const customerName = cleanText(payload.customerName ?? payload.name, 80);
  const companyName = cleanText(payload.companyName, 120);
  const propertyType = cleanText(payload.propertyType, 80);
  const accessWindow = cleanText(payload.accessWindow, 160);
  const phone = cleanText(payload.phone, 40);
  const email = cleanText(payload.email, 160).toLowerCase();
  const serviceLocation = cleanText(payload.serviceLocation ?? payload.city, 160);
  const serviceNeeded = cleanText(payload.serviceNeeded ?? payload.service, 100) || "Plumbing service";
  const urgency = cleanText(payload.urgency, 40) || "Scheduling";
  const preferredContact = cleanText(payload.preferredContact, 20) || "Phone";
  const details = cleanText(payload.details ?? payload.message, 2500);
  const sourcePath = cleanText(payload.sourcePath, 220) || (siteVariant === "commercial" ? "/commercial/contact/" : "/contact/");
  const consentContact = boolFromFormValue(payload.consentContact);

  if (cleanText(payload.companyWebsite, 200)) return { ok: false, spam: true, error: "Submission rejected." };
  if (customerName.length < 2) return { ok: false, error: "Please enter your name." };
  if (siteVariant === "commercial" && companyName.length < 2) return { ok: false, error: "Please enter the company or property name." };
  if (siteVariant === "commercial" && propertyType.length < 2) return { ok: false, error: "Please choose a property type." };
  if (phone.replace(/\D/g, "").length < 10) return { ok: false, error: "Please enter a valid phone number." };
  if (email && !emailIsValid(email)) return { ok: false, error: "Please enter a valid email address." };
  if (preferredContact.toLowerCase() === "email" && !email) return { ok: false, error: "Please enter your email address or choose phone or text." };
  if (serviceLocation.length < 2) return { ok: false, error: "Please enter the city or service location." };
  if (details.length < 10) return { ok: false, error: "Please tell us a little more about the plumbing problem." };
  if (!consentContact) return { ok: false, error: "Please allow Masterflow to contact you about this request." };

  return {
    ok: true,
    value: {
      siteVariant,
      customerName,
      companyName,
      propertyType,
      accessWindow,
      phone,
      email,
      serviceLocation,
      serviceNeeded,
      urgency,
      preferredContact,
      details,
      sourcePath,
      consentContact,
    },
  };
}

export async function createReviewSubmission(payload, request) {
  const validated = validateReviewPayload(payload);
  if (!validated.ok) throw new Error(validated.error);

  const metadata = requestMetadata(request);
  const createdAt = new Date().toISOString();
  const id = `rev_${crypto.randomUUID().replaceAll("-", "")}`;
  const ipHash = await sha256(`${metadata.ipAddress}|${metadata.userAgent}`);

  return {
    id,
    created_at: createdAt,
    status: "pending",
    reviewer_name: validated.value.reviewerName,
    reviewer_email: validated.value.reviewerEmail,
    reviewer_phone: validated.value.reviewerPhone,
    rating: validated.value.rating,
    review_text: validated.value.reviewText,
    contact: validated.value.reviewerEmail || validated.value.reviewerPhone,
    consent_ip_collection: validated.value.consentIpCollection ? 1 : 0,
    consent_display: validated.value.consentDisplay ? 1 : 0,
    source_path: validated.value.sourcePath,
    ip_address: metadata.ipAddress,
    ip_hash: ipHash,
    user_agent: metadata.userAgent,
    country: metadata.country,
    cf_ray: metadata.cfRay,
    referer: metadata.referer,
  };
}

export async function createServiceRequestSubmission(payload, request) {
  const validated = validateServiceRequestPayload(payload);
  if (!validated.ok) throw new Error(validated.error);

  const metadata = requestMetadata(request);
  const id = `req_${crypto.randomUUID().replaceAll("-", "")}`;
  const ipHash = await sha256(`${metadata.ipAddress}|${metadata.userAgent}`);

  return {
    id,
    created_at: new Date().toISOString(),
    status: "new",
    site_variant: validated.value.siteVariant,
    customer_name: validated.value.customerName,
    company_name: validated.value.companyName,
    property_type: validated.value.propertyType,
    access_window: validated.value.accessWindow,
    phone: validated.value.phone,
    email: validated.value.email,
    service_location: validated.value.serviceLocation,
    service_needed: validated.value.serviceNeeded,
    urgency: validated.value.urgency,
    preferred_contact: validated.value.preferredContact,
    details: validated.value.details,
    consent_contact: validated.value.consentContact ? 1 : 0,
    source_path: validated.value.sourcePath,
    ip_hash: ipHash,
    user_agent: metadata.userAgent,
    country: metadata.country,
    cf_ray: metadata.cfRay,
    referer: metadata.referer,
    email_status: "pending",
    email_message_id: "",
    email_error: "",
  };
}

async function insertReview(db, submission) {
  await db.prepare(`
    INSERT INTO review_submissions (
      id, created_at, status, reviewer_name, reviewer_email, reviewer_phone,
      rating, review_text, contact, consent_ip_collection, consent_display,
      source_path, ip_address, ip_hash, user_agent, country, cf_ray, referer
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    submission.id,
    submission.created_at,
    submission.status,
    submission.reviewer_name,
    submission.reviewer_email,
    submission.reviewer_phone,
    submission.rating,
    submission.review_text,
    submission.contact,
    submission.consent_ip_collection,
    submission.consent_display,
    submission.source_path,
    submission.ip_address,
    submission.ip_hash,
    submission.user_agent,
    submission.country,
    submission.cf_ray,
    submission.referer,
  ).run();
}

async function insertServiceRequest(db, submission) {
  await db.prepare(`
    INSERT INTO service_requests (
      id, created_at, status, site_variant, customer_name, company_name,
      property_type, access_window, phone, email, service_location, service_needed,
      urgency, preferred_contact, details, consent_contact, source_path, ip_hash,
      user_agent, country, cf_ray, referer, email_status, email_message_id, email_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    submission.id,
    submission.created_at,
    submission.status,
    submission.site_variant,
    submission.customer_name,
    submission.company_name,
    submission.property_type,
    submission.access_window,
    submission.phone,
    submission.email,
    submission.service_location,
    submission.service_needed,
    submission.urgency,
    submission.preferred_contact,
    submission.details,
    submission.consent_contact,
    submission.source_path,
    submission.ip_hash,
    submission.user_agent,
    submission.country,
    submission.cf_ray,
    submission.referer,
    submission.email_status,
    submission.email_message_id,
    submission.email_error,
  ).run();
}

async function updateServiceRequestEmail(db, id, { status, messageId = "", error = "" }) {
  await db.prepare(`
    UPDATE service_requests
    SET email_status = ?, email_message_id = ?, email_error = ?
    WHERE id = ?
  `).bind(status, messageId, cleanText(error, 500), id).run();
}

async function listApprovedReviews(db) {
  const result = await db.prepare(`
    SELECT id, created_at, reviewer_name, rating, review_text
    FROM review_submissions
    WHERE status = 'approved' AND consent_display = 1
    ORDER BY created_at DESC
    LIMIT 50
  `).all();
  return (result.results ?? []).map(publicReviewRow);
}

async function exceedsRateLimit(db, tableName, ipHash, cutoff, limit) {
  const allowedTables = new Set(["review_submissions", "service_requests"]);
  if (!allowedTables.has(tableName)) throw new Error("Invalid rate-limit table.");
  const row = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM ${tableName}
    WHERE ip_hash = ? AND created_at >= ?
  `).bind(ipHash, cutoff).first();
  return Number(row?.count ?? 0) >= limit;
}

export function serviceRequestEmail(submission) {
  const commercial = submission.site_variant === "commercial";
  const subject = `[New ${commercial ? "commercial " : ""}service request] ${submission.service_needed} - ${submission.service_location}`;
  const rows = [
    ["Request ID", submission.id],
    ["Site", commercial ? "Commercial" : "Residential"],
    ["Name", submission.customer_name],
    ...(commercial || submission.company_name ? [["Company or property", submission.company_name || "Not provided"]] : []),
    ...(commercial || submission.property_type ? [["Property type", submission.property_type || "Not provided"]] : []),
    ...(commercial || submission.access_window ? [["Access or service window", submission.access_window || "Not provided"]] : []),
    ["Phone", submission.phone],
    ["Email", submission.email || "Not provided"],
    ["Preferred contact", submission.preferred_contact],
    ["Service location", submission.service_location],
    ["Service", submission.service_needed],
    ["Timing", submission.urgency],
    ["Details", submission.details],
    ["Source page", submission.source_path],
    ["Submitted", submission.created_at],
  ];
  const text = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
  const html = `
    <h1>New Masterflow website request</h1>
    <table cellpadding="8" cellspacing="0" style="border-collapse:collapse">
      ${rows.map(([label, value]) => `<tr><th align="left" valign="top">${htmlEscape(label)}</th><td>${htmlEscape(value)}</td></tr>`).join("")}
    </table>
    <p><strong>Call or reply using the customer details above.</strong></p>
  `;
  return { subject, text, html };
}

async function sendServiceRequestEmail(emailBinding, submission) {
  if (!emailBinding) throw new Error("Sales email delivery is unavailable.");
  const content = serviceRequestEmail(submission);
  return emailBinding.send({
    to: SALES_EMAIL,
    from: { email: WEBSITE_EMAIL, name: "Masterflow Website" },
    ...(submission.email ? { replyTo: { email: submission.email, name: submission.customer_name } } : {}),
    subject: content.subject,
    text: content.text,
    html: content.html,
    headers: {
      "X-Masterflow-Request-ID": submission.id,
      Importance: submission.urgency.toLowerCase().includes("emergency") ? "high" : "normal",
    },
  });
}

function wantsHtml(request) {
  return (request.headers.get("accept") ?? "").includes("text/html");
}

function redirectFor(request, path, status = 303) {
  return Response.redirect(new URL(path, request.url).href, status);
}

function serviceRequestReturnPath(siteVariant) {
  return siteVariant === "commercial" ? "/commercial/contact/" : "/contact/";
}

async function handleReviews(request, env, url) {
  if (!env.DB) return jsonResponse({ ok: false, error: "review_database_unavailable" }, 503, request);

  if (request.method === "GET" && url.pathname.endsWith("/health")) {
    return jsonResponse({ ok: true, service: "masterflow-site-api", database: true }, 200, request);
  }

  if (request.method === "GET") {
    return jsonResponse({ ok: true, reviews: await listApprovedReviews(env.DB) }, 200, request);
  }

  if (request.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, request);

  try {
    const payload = await parsePayload(request);
    const validated = validateReviewPayload(payload);
    if (validated.spam) return jsonResponse({ ok: true, status: "pending" }, 202, request);
    if (!validated.ok) throw new Error(validated.error);
    const submission = await createReviewSubmission(payload, request);
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    if (await exceedsRateLimit(env.DB, "review_submissions", submission.ip_hash, cutoff, 5)) {
      return jsonResponse({ ok: false, error: "Too many review submissions. Please try again later." }, 429, request);
    }
    await insertReview(env.DB, submission);
    if (wantsHtml(request)) return redirectFor(request, "/reviews/?review=submitted#leave-review");
    return jsonResponse({ ok: true, id: submission.id, status: submission.status }, 201, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review submission failed.";
    if (wantsHtml(request)) return redirectFor(request, `/reviews/?review=error&message=${encodeURIComponent(message)}#leave-review`);
    return jsonResponse({ ok: false, error: message }, 400, request);
  }
}

async function handleServiceRequest(request, env, url) {
  if (request.method === "GET" && url.pathname.endsWith("/health")) {
    return jsonResponse({
      ok: Boolean(env.DB && env.SALES_EMAIL),
      service: "masterflow-site-api",
      database: Boolean(env.DB),
      email: Boolean(env.SALES_EMAIL),
    }, env.DB && env.SALES_EMAIL ? 200 : 503, request);
  }
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, request);
  if (!env.DB) return jsonResponse({ ok: false, error: "request_database_unavailable" }, 503, request);

  let submission;
  let siteVariant = "residential";
  try {
    const payload = await parsePayload(request);
    const validated = validateServiceRequestPayload(payload);
    if (validated.spam) return jsonResponse({ ok: true, status: "received" }, 202, request);
    if (!validated.ok) throw new Error(validated.error);
    siteVariant = validated.value.siteVariant;
    submission = await createServiceRequestSubmission(payload, request);
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    if (await exceedsRateLimit(env.DB, "service_requests", submission.ip_hash, cutoff, 6)) {
      return jsonResponse({ ok: false, error: "Too many requests. Please call 951-612-7912 if you need help now." }, 429, request);
    }
    await insertServiceRequest(env.DB, submission);

    try {
      const emailResult = await sendServiceRequestEmail(env.SALES_EMAIL, submission);
      await updateServiceRequestEmail(env.DB, submission.id, { status: "sent", messageId: emailResult.messageId });
      if (wantsHtml(request)) return redirectFor(request, `${serviceRequestReturnPath(submission.site_variant)}?request=submitted#request-service`);
      return jsonResponse({ ok: true, id: submission.id, status: "received", emailMessageId: emailResult.messageId }, 201, request);
    } catch (emailError) {
      const message = emailError instanceof Error ? emailError.message : "Email delivery failed.";
      await updateServiceRequestEmail(env.DB, submission.id, { status: "failed", error: message });
      return jsonResponse({
        ok: false,
        id: submission.id,
        saved: true,
        error: "Your request was saved, but the email notification failed. Please call 951-612-7912.",
      }, 502, request);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Service request failed.";
    if (wantsHtml(request)) {
      return redirectFor(
        request,
        `${serviceRequestReturnPath(siteVariant)}?request=error&message=${encodeURIComponent(message)}#request-service`,
      );
    }
    return jsonResponse({ ok: false, error: message }, 400, request);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: responseHeaders(request, {
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "Content-Type",
          "access-control-max-age": "86400",
        }),
      });
    }
    if (url.pathname.startsWith("/api/reviews")) return handleReviews(request, env, url);
    if (url.pathname.startsWith("/api/request-service")) return handleServiceRequest(request, env, url);
    return jsonResponse({ ok: false, error: "not_found" }, 404, request);
  },
};
