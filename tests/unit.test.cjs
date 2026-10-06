"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const {
  menuTitle,
  reading,
  importObservations,
  normalizePreferences,
} = require("../src/model.cjs");
const now = Date.now();
const ok = (value) => ({
  value,
  status: "ok",
  observedAt: new Date(now).toISOString(),
});
test("menu-bar modes, compact/exact, zero and stale states", () => {
  const state = {
    providers: { perplexity: ok(12400), openrouter: ok(85.2) },
    preferences: { menuBar: "both", compact: true },
  };
  assert.equal(menuTitle(state, now), "12.4K · $85.20");
  state.preferences.compact = false;
  assert.equal(menuTitle(state, now), "12,400 · $85.20");
  state.preferences.menuBar = "perplexity";
  assert.equal(menuTitle(state, now), "12,400");
  state.preferences.menuBar = "icon";
  assert.equal(menuTitle(state, now), "");
  state.preferences.menuBar = "openrouter";
  state.providers.openrouter.value = 0;
  assert.equal(menuTitle(state, now), "$0.00");
  assert.equal(reading(ok(5), now + 20 * 60000), false);
  assert.equal(reading({ ...ok(5), status: "error" }, now), false);
  assert.equal(reading({ ...ok(5), status: "imported" }, now), false);
  assert.equal(reading({ ...ok(5), observedAt: "bad" }, now), false);
  assert.equal(reading(ok(-1), now), false);
});
test("preferences are allowlisted, not arbitrary IPC settings", () => {
  assert.deepEqual(
    normalizePreferences({
      menuBar: "unknown",
      compact: false,
      launchAtLogin: "true",
      token: "secret",
    }),
    { menuBar: "both", compact: false, launchAtLogin: false },
  );
});
test("migration preserves numeric history, not cookies or connected status", () => {
  const old = {
    schema: 1,
    providers: { perplexity: { ...ok(12400), cookie: "never-copy-me" } },
    history: [
      {
        ...ok(12400),
        provider: "perplexity",
        checkedAt: new Date(now).toISOString(),
        cookie: "never-copy-me",
      },
    ],
  };
  const clean = importObservations(old);
  assert.equal(clean.providers.perplexity.status, "imported");
  assert.equal(clean.history[0].value, 12400);
  assert.equal(JSON.stringify(clean).includes("never-copy-me"), false);
  assert.throws(() => importObservations({ schema: 8 }), /Unsupported/);
});
const parser = fs.readFileSync(
  path.join(__dirname, "../src/parser.js"),
  "utf8",
);
function read(html, provider = "perplexity") {
  const dom = new JSDOM(html, { runScripts: "outside-only" });
  dom.window.HTMLElement.prototype.getClientRects = () => [
    { width: 100, height: 20 },
  ];
  dom.window.eval(parser);
  try {
    return dom.window.CreditParser.read(dom.window.document, provider);
  } finally {
    dom.window.close();
  }
}
test("all supported English organization labels and zero", () => {
  for (const label of ["org", "organization", "organisation"]) {
    assert.equal(
      read(
        `<section><p>Available ${label} credits</p><h2>12,400</h2><p>Refill: 20,000</p></section>`,
      ).value,
      12400,
    );
    assert.equal(
      read(`<p aria-label="Available ${label} credits: 0">0</p>`).value,
      0,
    );
  }
});
test("no substitution of usage, refills, ambiguous amounts or malformed balances", () => {
  assert.throws(
    () => read("<div>Organisation credits used</div><p>12,400</p>"),
    /not found/,
  );
  assert.throws(
    () => read("<p>Auto refill</p><span>20,000</span>"),
    /not found/,
  );
  assert.throws(
    () =>
      read(
        "<section><p>Available org credits</p><span>12,400</span><span>50,000</span></section>",
      ),
    /Ambiguous/,
  );
  assert.throws(() =>
    read("<section><p>Available org credits</p><span>12.4K</span></section>"),
  );
  assert.equal(
    read(
      '<div aria-label="Total available credits: $85.20">$85.20</div>',
      "openrouter",
    ).value,
    85.2,
  );
});
