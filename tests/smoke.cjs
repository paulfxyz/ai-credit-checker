"use strict";
const { _electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
let app;
async function fixture(app, negative = false) {
  await app.evaluate(({ session }, negative) => {
    for (const id of ["perplexity", "openrouter"]) {
      const s = session.fromPartition(`persist:ai-credit-checker-${id}`);
      if (s.protocol.isProtocolHandled("https")) {
        // unhandle is harmless when there is no custom handler.
        try {
          s.protocol.unhandle("https");
        } catch {}
      }
      s.protocol.handle(
        "https",
        () =>
          new Response(
            negative
              ? "<h1>Please sign in</h1>"
              : id === "perplexity"
                ? "<main><h1>Usage</h1><section><div><div>Available organisation credits</div><h2>12,400</h2><button>Add more</button></div><p>Auto-refill enabled. 20,000 will be added when org balance is low</p></section><table><tr><td>Manual top-up</td><td>50,000</td></tr></table></main>"
                : '<main><section aria-label="Total available credits: $85.20"><h2>TOTAL AVAILABLE</h2><div>$85.20</div></section></main>',
            {
              headers: {
                "content-type": "text/html",
                "cache-control": "no-store",
              },
            },
          ),
      );
    }
  }, negative);
}
async function launch(profile) {
  const a = await _electron.launch({
    executablePath: require("electron"),
    args: ["--no-sandbox", root],
    env: { ...process.env, AI_CREDIT_CHECKER_TEST_PROFILE: profile },
  });
  const ui = await a.firstWindow();
  await ui.waitForFunction(
    () => window.monitor && document.getElementById("version").textContent,
  );
  return { a, ui };
}
async function command(ui, name, id) {
  return ui.evaluate(
    ([name, id]) => window.monitor.command(name, id),
    [name, id],
  );
}
async function checked(ui, id, previous) {
  const deadline = Date.now() + 75000;
  while (Date.now() < deadline) {
    const s = await command(ui, "state");
    if (
      !s.running.includes(id) &&
      s.providers[id]?.checkedAt &&
      s.providers[id].checkedAt !== previous
    )
      return s;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${id}`);
}
(async () => {
  const profile = await fs.mkdtemp(
    path.join(os.tmpdir(), "ai-credit-checker-test-"),
  );
  try {
    let launched = await launch(profile);
    app = launched.a;
    let ui = launched.ui;
    await fixture(app);
    await command(ui, "check", "perplexity");
    await command(ui, "check", "openrouter");
    let state = await checked(ui, "perplexity");
    state = await checked(ui, "openrouter");
    assert.equal(state.providers.perplexity.value, 12400);
    assert.equal(state.providers.openrouter.value, 85.2);
    assert.equal(state.providers.perplexity.scope, "organization");
    assert.equal(state.providers.openrouter.unit, "USD");
    console.log(
      "PASS real Electron: both provider parsers, exact balances and separate scopes",
    );
    const remote = app.windows().find((p) => p.url().includes("perplexity.ai"));
    assert.equal(await remote.evaluate(() => typeof require), "undefined");
    assert.equal(
      await remote.evaluate(() => typeof window.monitor),
      "undefined",
    );
    console.log(
      "PASS remote page has no Node require or privileged monitor bridge",
    );
    assert.equal(state.menuTitle, "12.4K · $85.20");
    await command(ui, "preferences", { menuBar: "perplexity", compact: false });
    assert.equal((await command(ui, "state")).menuTitle, "12,400");
    await command(ui, "preferences", { menuBar: "openrouter", compact: true });
    assert.equal((await command(ui, "state")).menuTitle, "$85.20");
    await command(ui, "preferences", { menuBar: "icon", compact: true });
    assert.equal((await command(ui, "state")).menuTitle, "");
    await command(ui, "preferences", { menuBar: "both", compact: true });
    await ui.screenshot({
      path: path.join(root, "docs/screenshot-overview.png"),
    });
    await ui.locator('[data-view="activity"]').click();
    await ui.screenshot({
      path: path.join(root, "docs/screenshot-activity.png"),
    });
    await ui.locator('[data-view="settings"]').click();
    // Do not put a private machine path into a public screenshot.
    await ui
      .locator("#storage")
      .evaluate(
        (el) =>
          (el.textContent =
            "~/Library/Application Support/AI Credit Checker/observations.json"),
      );
    await ui.screenshot({
      path: path.join(root, "docs/screenshot-preferences.png"),
    });
    await ui.locator('[data-view="overview"]').click();
    console.log("PASS all four menu-bar modes and navigation views");
    await command(ui, "background", true);
    await app.evaluate(async ({ session }) => {
      const s = session.fromPartition("persist:ai-credit-checker-perplexity");
      await s.cookies.set({
        url: "https://www.perplexity.ai",
        name: "poc_fixture_only",
        value: "persisted",
        expirationDate: Date.now() / 1000 + 86400,
        secure: true,
      });
      await s.cookies.flushStore();
    });
    await app.close();
    app = null;
    launched = await launch(profile);
    app = launched.a;
    ui = launched.ui;
    await fixture(app);
    state = await command(ui, "state");
    assert.equal(state.providers.perplexity.value, 12400);
    assert.equal(state.background, true);
    const cookies = await app.evaluate(async ({ session }) =>
      session
        .fromPartition("persist:ai-credit-checker-perplexity")
        .cookies.get({ name: "poc_fixture_only" }),
    );
    assert.equal(cookies[0].value, "persisted");
    const otherCookies = await app.evaluate(async ({ session }) =>
      session
        .fromPartition("persist:ai-credit-checker-openrouter")
        .cookies.get({ name: "poc_fixture_only" }),
    );
    assert.equal(otherCookies.length, 0);
    console.log(
      "PASS restart persistence: observations, preference, isolated synthetic session cookie",
    );
    await command(ui, "check", "perplexity");
    state = await checked(
      ui,
      "perplexity",
      state.providers.perplexity.checkedAt,
    );
    assert.equal(state.providers.perplexity.status, "ok");
    console.log("PASS second hidden-window read after restart");
    await fixture(app, true);
    await command(ui, "check", "perplexity");
    state = await checked(
      ui,
      "perplexity",
      state.providers.perplexity.checkedAt,
    );
    console.log(
      "Negative fixture result:",
      state.providers.perplexity.status,
      await app
        .windows()
        .find((p) => p.url().includes("perplexity.ai"))
        .locator("body")
        .innerText(),
    );
    assert.equal(state.providers.perplexity.status, "error");
    assert.equal(state.providers.perplexity.value, 12400);
    await ui.waitForFunction(
      () => document.getElementById("perplexity-value").textContent === "∞",
    );
    assert.equal(JSON.stringify(state).includes("poc_fixture_only"), false);
    console.log(
      "PASS failed read: visible error, infinity display, last good observation retained, no cookie in state",
    );
    console.log(
      "All tests use synthetic pages, NOT live account authentication.",
    );
  } finally {
    if (app) await app.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
