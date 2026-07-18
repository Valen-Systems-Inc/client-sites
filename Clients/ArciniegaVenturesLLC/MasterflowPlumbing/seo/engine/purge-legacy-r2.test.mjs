import assert from "node:assert/strict";
import test from "node:test";
import { compareArchive, parsePurgeArgs } from "./purge-legacy-r2.mjs";

const source = {
  key: "sitemap.xml",
  size: 42,
  etag: "abc123",
  http_metadata: { contentType: "application/xml; charset=utf-8" },
  custom_metadata: {},
};
const archived = {
  ...source,
  key: "masterflow-plumbing/_rollback/masterflowplumbing-cdn-2026-07-16/sitemap.xml",
};

test("requires an explicit destructive confirmation", () => {
  assert.throws(() => parsePurgeArgs(["--apply"]), /Refusing deletion/);
  assert.equal(
    parsePurgeArgs(["--apply", "--confirm=EMPTY-masterflowplumbing-cdn"]).apply,
    true,
  );
});

test("accepts a byte-identical archive and detects drift", () => {
  assert.deepEqual(compareArchive([source], [archived]), {
    missing: [],
    mismatched: [],
    unexpected: [],
  });
  const result = compareArchive([source], [{ ...archived, size: 41 }]);
  assert.equal(result.mismatched.length, 1);
});

test("detects archive omissions and unexpected objects", () => {
  assert.equal(compareArchive([source], []).missing.length, 1);
  assert.equal(
    compareArchive([], [{ ...archived, key: `${archived.key}.extra` }]).unexpected.length,
    1,
  );
});
