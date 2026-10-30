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
  display,
  staleMs,
} = require("../src/model.cjs");
const {
  providerURL,
  matchesPage,
  providerScope,
  parserKey,
} = require("../src/providers.cjs");
const now = Date.now();
const ok = (value) => ({
  value,
  status: "ok",
  observedAt: new Date(now).toISOString(),
});
test("menu-bar modes, compact/exact, zero and stale states", () => {
  const state = {
    providers: {
      perplexity: ok(12400),
      openrouter: ok(85.2),
      fly: ok(24.5),
      runware: ok(39.872),
    },
    preferences: { menuBar: "both", compact: true },
  };
  assert.equal(
    menuTitle(state, now),
    "P 12.4K · O $85.20 · F $24.50 · R $39.87",
  );
  state.preferences.compact = false;
  assert.equal(
    menuTitle(state, now),
    "P 12,400 · O $85.20 · F $24.50 · R $39.87",
  );
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
    {
      menuBar: ["perplexity", "openrouter", "fly", "runware"],
      compact: false,
      launchAtLogin: false,
      flyOrganization: "",
      perplexityAccount: "personal",
      autoUpdateChecks: true,
      checkIntervalMinutes: 10,
    },
  );
});
test("v2 preferences migrate; Fly URL is exact, configurable and constrained", () => {
  assert.deepEqual(normalizePreferences({ menuBar: "both" }).menuBar, [
    "perplexity",
    "openrouter",
    "fly",
    "runware",
  ]);
  assert.deepEqual(normalizePreferences({ menuBar: "icon" }).menuBar, []);
  const prefs = normalizePreferences({ flyOrganization: " sample-org " });
  assert.equal(
    providerURL("fly", prefs),
    "https://fly.io/dashboard/sample-org/billing",
  );
  assert.equal(providerURL("fly"), null);
  assert.equal(
    normalizePreferences({ flyOrganization: "../another" }).flyOrganization,
    "",
  );
  assert.equal(
    matchesPage("fly", "https://fly.io/dashboard/other-org/billing", prefs),
    false,
  );
  assert.equal(
    matchesPage(
      "fly",
      "https://evil.example/dashboard/sample-org/billing",
      prefs,
    ),
    false,
  );
  assert.equal(
    matchesPage(
      "fly",
      "https://fly.io/dashboard/sample-org/billing/?tab=credits",
      prefs,
    ),
    true,
  );
  assert.equal(providerURL("runware"), "https://runware.ai/settings/billing");
  assert.equal(
    matchesPage("runware", "https://runware.ai/settings/billing/?tab=credits"),
    true,
  );
  assert.equal(matchesPage("runware", "https://runware.ai/wallet"), false);
  assert.equal(
    matchesPage("runware", "https://evil.example/settings/billing"),
    false,
  );
  assert.equal(matchesPage("runware", "https://runware.ai/usage"), false);
});
test("new provider formatting keeps stored precision and supports all modes", () => {
  const entry = ok(39.872);
  assert.equal(display("runware", entry), "$39.87");
  assert.equal(entry.value, 39.872);
  assert.equal(display("runware", ok(39.879)), "$39.88");
  assert.equal(display("runware", ok(0)), "$0.00");
  assert.equal(display("fly", ok(0)), "$0.00");
  for (const id of ["fly", "runware"]) {
    assert.equal(
      menuTitle({
        providers: { [id]: ok(24.5) },
        preferences: { menuBar: id },
      }),
      "$24.50",
    );
  }
  assert.equal(
    menuTitle({ providers: {}, preferences: { menuBar: "all" } }),
    "P ∞ · O ∞ · F ∞ · R ∞",
  );
});
test("all 16 counter combinations, migration, deduplication and stable ordering", () => {
  const ids = ["perplexity", "openrouter", "fly", "runware"];
  const prefixes = ["P", "O", "F", "R"];
  for (let mask = 0; mask < 16; mask++) {
    const selected = ids.filter((_, i) => mask & (1 << i));
    const prefs = normalizePreferences({ menuBar: selected });
    assert.deepEqual(prefs.menuBar, selected);
    assert.equal(
      menuTitle({ providers: {}, preferences: prefs }),
      selected
        .map((id) =>
          selected.length === 1 ? "∞" : `${prefixes[ids.indexOf(id)]} ∞`,
        )
        .join(" · "),
    );
  }
  assert.deepEqual(
    normalizePreferences({ menuBar: ["runware", "fly", "fly", "bogus"] })
      .menuBar,
    ["fly", "runware"],
  );
  for (const id of ids)
    assert.deepEqual(normalizePreferences({ menuBar: id }).menuBar, [id]);
  assert.deepEqual(normalizePreferences({ menuBar: "all" }).menuBar, ids);
});
test("balance cadence is allowlisted and stale thresholds follow twice the selected interval", () => {
  assert.equal(
    normalizePreferences({ checkIntervalMinutes: 5 }).checkIntervalMinutes,
    10,
  );
  for (const minutes of [10, 30, 60]) {
    const preferences = {
      checkIntervalMinutes: minutes,
      menuBar: ["openrouter"],
    };
    assert.equal(staleMs(preferences), minutes * 120000);
    assert.equal(
      menuTitle(
        { preferences, providers: { openrouter: ok(1) } },
        now + minutes * 60000,
      ),
      "$1.00",
    );
    assert.equal(
      menuTitle(
        { preferences, providers: { openrouter: ok(1) } },
        now + minutes * 120000,
      ),
      "∞",
    );
  }
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
test("Fly reads Credit Balance, not invoices, purchases, or active-credit usage", () => {
  const html = `<main><section><h2>Account Overview</h2><div><div>Account Status</div><p>Good Standing</p></div>
    <div><div>Credit Balance</div><span>$24.50</span></div></section>
    <section>Invoices <span>$500.00</span></section><aside>Buy Credits <span>$25.00</span></aside>
    <aside>Active Credits <span>$400.00 / $850.00</span></aside></main>`;
  assert.equal(read(html, "fly").value, 24.5);
  assert.throws(
    () => read("<section>Last Invoice <span>$500.00</span></section>", "fly"),
    /not found/,
  );
  assert.throws(
    () =>
      read(
        "<section><p>Credit Balance</p><span>$24.50</span><span>$25.50</span></section>",
        "fly",
      ),
    /Ambiguous/,
  );
  assert.equal(
    read('<span aria-label="Credit Balance: $0.00">Zero</span>', "fly").value,
    0,
  );
});
test("Runware reads wallet precision including styled fractional digit, not spend or top-ups", () => {
  const html = `<main><section><div><div><h2>Current Balance</h2><p>Available credits for API usage</p></div>
    <span><span>$39.87</span><small>2</small></span></div><button>One-Time Payment</button><button>Add Funds</button></section>
    <section><h2>Spend This Month</h2><span>$6.72</span><p>One-time payments</p><span>$0.00</span></section></main>`;
  assert.equal(read(html, "runware").value, 39.872);
  assert.equal(
    read(
      '<div aria-label="Current Balance: $12.345678">wallet</div>',
      "runware",
    ).value,
    12.345678,
  );
  assert.throws(
    () =>
      read(
        "<section><h2>Total spend</h2><span>$6.72</span></section>",
        "runware",
      ),
    /not found/,
  );
  assert.throws(
    () =>
      read(
        "<section><h2>Current Balance</h2><span>$39.872</span><span>$39.99</span></section>",
        "runware",
      ),
    /Ambiguous/,
  );
});

test("Runware billing Available balance excludes nearby monthly spend", () => {
  // Synthetic reconstruction of the supplied screenshot, not captured live DOM.
  for (const [amount, expected] of [
    ["$39.872", 39.872],
    ["$0.00", 0],
    ["$1,234.56", 1234.56],
  ]) {
    const html = `<main><section><header><h2>Inference credits</h2>
      <p>Image, video, audio and language model requests</p>
      <button>Configure</button><button>Add funds</button></header>
      <div><p>Available balance</p><div>${amount}</div>
      <p>Spent this month <span>$6.72</span></p></div>
      <footer>Auto top-up <button>$25.00</button></footer></section>
      <section><h2>Payment methods</h2><button>Add payment method</button></section></main>`;
    assert.equal(read(html, "runware").value, expected);
  }
  assert.equal(
    read(
      "<section><p>Available balance</p><div><span>$39.87</span><small>2</small></div><p>Spent this month <b>$6.72</b></p></section>",
      "runware",
    ).value,
    39.872,
  );
  assert.equal(
    read('<p aria-label="Available balance: $0.00">Zero</p>', "runware").value,
    0,
  );
  assert.equal(
    read(
      "<section><p>Available balance</p><div>$39.87</div><p>Spend this month <span>$6.72</span></p></section>",
      "runware",
    ).value,
    39.87,
  );
  for (const html of [
    "<section><p>Available balance</p><p>Spent this month <span>$6.72</span></p></section>",
    "<section><p>Available balance</p><span hidden>$39.87</span><p>Spent this month <span>$6.72</span></p></section>",
    "<section><p>Available balance</p><span>-$1.00</span><p>Spent this month <span>$6.72</span></p></section>",
  ])
    assert.throws(() => read(html, "runware"), /could not be identified/);
  assert.throws(
    () =>
      read(
        "<section><p>Available balance</p><span>$39.87</span><span>$40.00</span></section>",
        "runware",
      ),
    /Ambiguous/,
  );
  assert.throws(
    () =>
      read(
        "<main><section><p>Available balance</p><span>$39.87</span></section><section><p>Available balance</p><span>$40.00</span></section></main>",
        "runware",
      ),
    /Ambiguous/,
  );
});

test("Runware spend labels do not require whitespace between HTML elements", () => {
  for (const spend of [
    "<p><span>Spent this month</span><b>$6.72</b></p>",
    "<p>Spent this month:<b>$6.72</b></p>",
    "<p>Spend this month<b>$6.72</b></p>",
  ]) {
    assert.equal(
      read(
        `<section><p>Available balance</p><div>$39.87</div>${spend}</section>`,
        "runware",
      ).value,
      39.87,
    );
    assert.throws(
      () =>
        read(`<section><p>Available balance</p>${spend}</section>`, "runware"),
      /could not be identified/,
    );
  }
});

test("Perplexity personal plan is the default; Enterprise pool is an option", () => {
  assert.equal(normalizePreferences({}).perplexityAccount, "personal");
  assert.equal(
    normalizePreferences({ perplexityAccount: "nonsense" }).perplexityAccount,
    "personal",
  );
  assert.equal(
    normalizePreferences({ perplexityAccount: "organization" })
      .perplexityAccount,
    "organization",
  );
  assert.equal(
    providerURL("perplexity"),
    "https://www.perplexity.ai/account/usage",
  );
  assert.equal(providerScope("perplexity", {}), "account");
  assert.equal(parserKey("perplexity", {}), "perplexity-personal");
  const org = { perplexityAccount: "organization" };
  assert.equal(
    providerURL("perplexity", org),
    "https://www.perplexity.ai/account/org/credits-usage",
  );
  assert.equal(providerScope("perplexity", org), "organization");
  assert.equal(parserKey("perplexity", org), "perplexity");
  assert.equal(
    matchesPage("perplexity", "https://www.perplexity.ai/account/usage/"),
    true,
  );
  assert.equal(
    matchesPage(
      "perplexity",
      "https://www.perplexity.ai/account/org/credits-usage",
    ),
    false,
  );
  assert.equal(
    matchesPage(
      "perplexity",
      "https://www.perplexity.ai/account/org/credits-usage",
      org,
    ),
    true,
  );
  assert.equal(
    matchesPage("perplexity", "https://evil.example/account/usage"),
    false,
  );
});

test("Perplexity personal reads credits left, never plan, purchased or bonus", () => {
  const p = (html) => read(html, "perplexity-personal");
  // Settings → Usage and credits, as in the user's screenshot.
  assert.equal(
    p(
      "<section><h2>Credits</h2><div><span>75,134 credits left</span><button>Add more</button></div><div>Turn on auto-refill</div></section>",
    ).value,
    75134,
  );
  // Styled number inside the label.
  assert.equal(
    p(
      "<div><strong>75,134</strong> credits left</div><p>Plan credits 10,000</p>",
    ).value,
    75134,
  );
  // Usage menu: total available is the first number, not the plan total.
  assert.equal(
    p(
      "<ul><li>Plan credits Max 10,000</li><li>Purchased credits 758,377</li><li>Bonus credits 5,500</li><li><span>Total available credits</span> <span>75,134 / 773,877</span></li></ul>",
    ).value,
    75134,
  );
  assert.equal(
    p(
      "<div><span>Total available credits</span><span>75,134 / 773,877</span></div><p>75,134 credits left</p>",
    ).value,
    75134,
  );
  assert.equal(p("<p>0 credits left</p>").value, 0);
  assert.equal(p("<p>1 credit left</p>").value, 1);
  assert.equal(p('<p aria-label="75,134 credits left">75K</p>').value, 75134);
  assert.throws(
    () => p("<p>Plan credits 10,000</p><p>Purchased credits 758,377</p>"),
    /not found/,
  );
  assert.throws(
    () => p("<p>75,134 credits left</p><p>80,000 credits left</p>"),
    /Ambiguous/,
  );
  assert.throws(() => p("<p hidden>75,134 credits left</p>"), /not found/);
  assert.throws(
    () => p("<div><span>Total available credits</span><span>lots</span></div>"),
    /could not be identified/,
  );
});
