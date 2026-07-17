import assert from "node:assert/strict";
import {
  createReviewSubmission,
  createServiceRequestSubmission,
  jsonResponse,
  serviceRequestEmail,
  validateReviewPayload,
  validateServiceRequestPayload,
} from "./worker.js";
import worker from "./worker.js";

const goodPayload = {
  reviewerName: "Test Customer",
  reviewerEmail: "customer@example.com",
  reviewerPhone: "951-555-0100",
  rating: "5",
  reviewText: "Fast response, clear communication, and clean work.",
  consentIpCollection: "on",
  consentDisplay: "on",
  sourcePath: "/reviews/",
};

const validated = validateReviewPayload(goodPayload);
assert.equal(validated.ok, true);
assert.equal(validated.value.rating, 5);
assert.equal(validated.value.reviewerName, "Test Customer");
assert.equal(validated.value.reviewerEmail, "customer@example.com");
assert.equal(validated.value.consentIpCollection, true);

const missingConsent = validateReviewPayload({ ...goodPayload, consentIpCollection: "" });
assert.equal(missingConsent.ok, false);
assert.match(missingConsent.error, /consent/i);

const missingReviewEmail = validateReviewPayload({ ...goodPayload, reviewerEmail: "" });
assert.equal(missingReviewEmail.ok, false);
assert.match(missingReviewEmail.error, /email/i);

const submission = await createReviewSubmission(goodPayload, {
  headers: new Headers({
    "cf-connecting-ip": "203.0.113.10",
    "user-agent": "node-test",
    "cf-ipcountry": "US",
    "cf-ray": "test-ray",
    referer: "https://masterflowplumbing.us/reviews",
  }),
});

assert.match(submission.id, /^rev_/);
assert.equal(submission.status, "pending");
assert.equal(submission.reviewer_name, "Test Customer");
assert.equal(submission.reviewer_email, "customer@example.com");
assert.equal(submission.reviewer_phone, "951-555-0100");
assert.equal(submission.rating, 5);
assert.equal(submission.consent_ip_collection, 1);
assert.equal(submission.ip_address, "203.0.113.10");
assert.match(submission.ip_hash, /^[a-f0-9]{64}$/);
assert.equal(submission.user_agent, "node-test");

const servicePayload = {
  customerName: "Website Test",
  phone: "951-555-0123",
  email: "lead@example.com",
  serviceLocation: "Corona, CA",
  serviceNeeded: "Drain cleaning",
  urgency: "Today if available",
  preferredContact: "Phone",
  details: "The kitchen sink is backing up into the other basin.",
  consentContact: "on",
  sourcePath: "/contact/",
};

const validatedServiceRequest = validateServiceRequestPayload(servicePayload);
assert.equal(validatedServiceRequest.ok, true);
assert.equal(validatedServiceRequest.value.siteVariant, "residential");
assert.equal(validatedServiceRequest.value.customerName, "Website Test");
assert.equal(validatedServiceRequest.value.serviceLocation, "Corona, CA");

const invalidServiceRequest = validateServiceRequestPayload({ ...servicePayload, phone: "123" });
assert.equal(invalidServiceRequest.ok, false);
assert.match(invalidServiceRequest.error, /phone/i);

const serviceSubmission = await createServiceRequestSubmission(servicePayload, {
  headers: new Headers({
    "cf-connecting-ip": "203.0.113.11",
    "user-agent": "node-service-test",
    "cf-ipcountry": "US",
    "cf-ray": "service-test-ray",
    referer: "https://masterflowplumbing.us/contact/",
  }),
});

assert.match(serviceSubmission.id, /^req_/);
assert.equal(serviceSubmission.status, "new");
assert.equal(serviceSubmission.site_variant, "residential");
assert.equal(serviceSubmission.customer_name, "Website Test");
assert.equal(serviceSubmission.email_status, "pending");
assert.match(serviceSubmission.ip_hash, /^[a-f0-9]{64}$/);

const email = serviceRequestEmail({ ...serviceSubmission, details: "Leak near <main> & garage" });
assert.match(email.subject, /Drain cleaning - Corona, CA/);
assert.match(email.text, /Phone: 951-555-0123/);
assert.match(email.html, /Leak near &lt;main&gt; &amp; garage/);
assert.doesNotMatch(email.html, /Leak near <main>/);

const commercialPayload = {
  ...servicePayload,
  siteVariant: "commercial",
  companyName: "Canyon Business Park",
  propertyType: "Office or industrial",
  accessWindow: "After 6 PM; check in with security",
  sourcePath: "/commercial/contact/",
};
const validatedCommercialRequest = validateServiceRequestPayload(commercialPayload);
assert.equal(validatedCommercialRequest.ok, true);
assert.equal(validatedCommercialRequest.value.siteVariant, "commercial");
assert.equal(validatedCommercialRequest.value.companyName, "Canyon Business Park");
assert.equal(
  validateServiceRequestPayload({ ...commercialPayload, companyName: "" }).ok,
  false,
  "commercial requests require the company or property name",
);
assert.equal(
  validateServiceRequestPayload({ ...commercialPayload, propertyType: "" }).ok,
  false,
  "commercial requests require a property type",
);

const commercialSubmission = await createServiceRequestSubmission(commercialPayload, {
  headers: new Headers({
    "cf-connecting-ip": "203.0.113.12",
    "user-agent": "node-commercial-test",
    "cf-ipcountry": "US",
    "cf-ray": "commercial-test-ray",
    referer: "https://masterflowplumbing.us/commercial/contact/",
  }),
});
assert.equal(commercialSubmission.site_variant, "commercial");
assert.equal(commercialSubmission.company_name, "Canyon Business Park");
assert.equal(commercialSubmission.property_type, "Office or industrial");
assert.equal(commercialSubmission.access_window, "After 6 PM; check in with security");

const commercialEmail = serviceRequestEmail(commercialSubmission);
assert.match(commercialEmail.subject, /\[New commercial service request\]/);
assert.match(commercialEmail.text, /Company or property: Canyon Business Park/);
assert.match(commercialEmail.text, /Property type: Office or industrial/);
assert.match(commercialEmail.text, /Access or service window: After 6 PM; check in with security/);

const response = jsonResponse({ ok: true }, 201);
assert.equal(response.status, 201);
assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");

const allowedPreflight = await worker.fetch(new Request("https://masterflowplumbing.us/api/reviews", {
  method: "OPTIONS",
  headers: { origin: "https://masterflowplumbing.us" },
}), {});
assert.equal(allowedPreflight.headers.get("access-control-allow-origin"), "https://masterflowplumbing.us");

const retiredDomainPreflight = await worker.fetch(new Request("https://masterflowplumbing.us/api/reviews", {
  method: "OPTIONS",
  headers: { origin: "https://masterflowplumbing.net" },
}), {});
assert.equal(retiredDomainPreflight.headers.get("access-control-allow-origin"), null);

console.log("Masterflow site API unit tests passed.");
