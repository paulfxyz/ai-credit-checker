"use strict";
const { _electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const versionParts = require("../package.json").version.split(".").map(Number);
const nextVersion = `${versionParts[0]}.${versionParts[1]}.${versionParts[2] + 1}`;
let app;
async function fixture(app, negative = false) {
  await app.evaluate(({ session }, negative) => {
    for (const id of ["perplexity", "openrouter", "fly", "runware"]) {
      const s = session.fromPartition(`persist:ai-credit-checker-${id}`);
      if (s.protocol.isProtocolHandled("https")) {
        // unhandle is harmless when there is no custom handler.
        try {
          s.protocol.unhandle("https");
        } catch {}
      }
      s.protocol.handle(
        "https",
        (request) =>
          (globalThis.requestedURLs ??= []).push(request.url) &&
          new Response(
            negative
              ? "<h1>Please sign in</h1>"
              : id === "perplexity" &&
                  new URL(request.url).pathname === "/account/usage"
                ? "<main><h1>Usage and credits</h1><p>Learn more about how credits work</p><section><h2>Credits</h2><div><span>75,134 credits left</span><button>Add more</button></div><div>Turn on auto-refill</div><details><summary>More details</summary><p>Plan credits 10,000</p><p>Purchased credits 758,377</p><p>Bonus credits 5,500</p></details></section></main>"
                : id === "perplexity"
                  ? "<main><h1>Usage</h1><section><div><div>Available organisation credits</div><h2>12,400</h2><button>Add more</button></div><p>Auto-refill enabled. 20,000 will be added when org balance is low</p></section><table><tr><td>Manual top-up</td><td>50,000</td></tr></table></main>"
                  : id === "fly"
                    ? "<main><section><h2>Account Overview</h2><div><p>Account Status</p><span>Good Standing</span></div><div><p>Credit Balance</p><span>$24.50</span></div></section><section><p>Last Invoice</p><span>$500.00</span></section></main>"
                    : id === "runware"
                      ? '<main id="app">Loading</main><script>requestAnimationFrame(() => requestAnimationFrame(() => { document.getElementById("app").innerHTML = "<section><header><h2>Inference credits</h2><p>Image, video, audio and language model requests</p><button>Configure</button><button>Add funds</button></header><div><p>Available balance</p><div><span>$39.87</span><small>2</small></div><p><span>Spent this month</span><span>$6.72</span></p></div><footer>Auto top-up <button>$25.00</button></footer></section><section><h2>Payment methods</h2></section>"; }));</script>'
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
async function requested(app) {
  return app.evaluate(() => globalThis.requestedURLs || []);
}
async function waitForPage(app, host) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const page = app.windows().find((p) => p.url().includes(host));
    if (page) {
      await page.waitForLoadState("domcontentloaded");
      return page;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No account window for ${host}`);
}
async function hideAccount(app, host) {
  await app.evaluate(({ BrowserWindow }, host) => {
    const win = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes(host),
    );
    // The app intercepts close and hides the window, like the red close button.
    win.close();
    if (win.isVisible()) throw new Error("Account window did not hide");
  }, host);
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
async function verifyScrolling(ui) {
  const original = await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().startsWith("file:"),
    );
    return window.getBounds();
  });
  for (const [width, height] of [
    [1180, 920],
    [820, 700],
  ]) {
    await app.evaluate(
      ({ BrowserWindow }, size) => {
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().startsWith("file:"))
          .setContentSize(...size);
      },
      [width, height],
    );
    for (const view of ["overview", "activity", "settings"]) {
      await ui.locator(`[data-view="${view}"]`).click();
      const layout = await ui.evaluate(() => {
        const workspace = document.querySelector(".workspace");
        const root = document.scrollingElement;
        workspace.scrollTop = workspace.scrollHeight;
        return {
          documentOverflow: root.scrollHeight - innerHeight,
          horizontalOverflow: workspace.scrollWidth - workspace.clientWidth,
          paneHeight: workspace.getBoundingClientRect().height,
          viewportHeight: innerHeight,
          atBottom:
            Math.abs(
              workspace.scrollHeight -
                workspace.clientHeight -
                workspace.scrollTop,
            ) <= 1,
          rootOverflowY: getComputedStyle(document.documentElement).overflowY,
        };
      });
      assert.ok(
        layout.documentOverflow <= 1,
        `${view} ${width}: outer document overflows ${JSON.stringify(layout)}`,
      );
      assert.ok(
        layout.horizontalOverflow <= 1,
        `${view} ${width}: horizontal overflow`,
      );
      assert.ok(Math.abs(layout.paneHeight - layout.viewportHeight) <= 1);
      assert.equal(
        layout.atBottom,
        true,
        `${view}: bottom content is unreachable`,
      );
    }
  }
  await app.evaluate(({ BrowserWindow }, bounds) => {
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().startsWith("file:"))
      .setBounds(bounds);
  }, original);
  await ui.locator('[data-view="overview"]').click();
  console.log(
    "PASS single-scroll layout: all three views at default and minimum window sizes; bottom controls reachable",
  );
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
    await ui.locator("#fly-organization").fill("sample-org");
    await ui.locator("#fly-save").click();
    await ui.waitForFunction(
      () => document.getElementById("notice").textContent === "",
    );
    await command(ui, "preferences", { flyOrganization: "sample-org" });
    // 2.1.6: personal plans (Pro/Max) are the default and read "credits left".
    let state = await command(ui, "state");
    assert.equal(state.preferences.perplexityAccount, "personal");
    assert.equal(
      await ui.locator("#perplexity-scope").textContent(),
      "Personal credits",
    );
    await command(ui, "check", "perplexity");
    state = await checked(ui, "perplexity");
    assert.equal(
      state.providers.perplexity.status,
      "ok",
      state.providers.perplexity.error,
    );
    assert.equal(state.providers.perplexity.value, 75134);
    assert.equal(state.providers.perplexity.scope, "account");
    assert.equal(state.providers.perplexity.account, "personal");
    assert.ok(
      (await requested(app)).includes(
        "https://www.perplexity.ai/account/usage",
      ),
    );
    assert.equal(await ui.locator("#perplexity-value").textContent(), "75,134");
    // Switching to an Enterprise pool clears the personal reading and URL.
    await ui.locator("#perplexity-account").selectOption("organization");
    await ui.waitForFunction(
      () =>
        document.getElementById("perplexity-scope").textContent ===
        "Organization credit pool",
    );
    state = await command(ui, "state");
    assert.equal(state.preferences.perplexityAccount, "organization");
    assert.equal(state.providers.perplexity, undefined);
    console.log(
      "PASS Perplexity personal plan default: credits left 75,134; Enterprise pool option clears it",
    );
    await command(ui, "check-all");
    state = await checked(ui, "perplexity");
    state = await checked(ui, "openrouter");
    state = await checked(ui, "fly");
    state = await checked(ui, "runware");
    assert.equal(state.providers.perplexity.value, 12400);
    assert.equal(state.providers.openrouter.value, 85.2);
    assert.equal(state.providers.fly.value, 24.5);
    assert.equal(state.providers.fly.account, "sample-org");
    assert.equal(state.providers.runware.value, 39.872);
    assert.ok(
      (await requested(app)).includes("https://runware.ai/settings/billing"),
      "Runware collector must use the new billing URL",
    );
    await verifyScrolling(ui);
    assert.equal(await ui.locator("#runware-value").textContent(), "$39.87");
    assert.equal(await ui.locator(".balance-card").count(), 4);
    assert.equal(state.providers.perplexity.scope, "organization");
    assert.equal(state.providers.openrouter.unit, "USD");
    console.log(
      "PASS real Electron: four providers, precise stored Runware value, two-decimal UI, 2x2 grid",
    );
    await command(ui, "open", "perplexity");
    const remote = await waitForPage(app, "perplexity.ai");
    assert.equal(await remote.evaluate(() => typeof require), "undefined");
    assert.equal(
      await remote.evaluate(() => typeof window.monitor),
      "undefined",
    );
    await hideAccount(app, "perplexity.ai");
    console.log(
      "PASS remote page has no Node require or privileged monitor bridge",
    );
    // Regression for 2.1.5: an account window that was opened and then closed
    // is only hidden and stops producing animation frames. The client-rendered
    // Runware fixture must still be read, via the offscreen collector.
    await command(ui, "open", "runware");
    await waitForPage(app, "runware.ai");
    await hideAccount(app, "runware.ai");
    await app.evaluate(({ app }) => {
      globalThis.createdReaders = [];
      app.on("browser-window-created", (_event, win) =>
        globalThis.createdReaders.push({
          win,
          offscreen: win.webContents.isOffscreen(),
        }),
      );
    });
    const beforeHiddenCheck = state.providers.runware.checkedAt;
    await command(ui, "check", "runware");
    state = await checked(ui, "runware", beforeHiddenCheck);
    assert.equal(
      state.providers.runware.status,
      "ok",
      state.providers.runware.error,
    );
    assert.equal(state.providers.runware.value, 39.872);
    // Playwright keeps attached hidden windows rendering, which can mask the
    // bug here; tests/hidden-render.cjs covers rendering without automation.
    // This asserts the routing: a closed window is read by a temporary
    // offscreen reader, never by the hidden login window, and it is cleaned up.
    const readers = await app.evaluate(() =>
      globalThis.createdReaders.map(({ win, offscreen }) => ({
        offscreen,
        destroyed: win.isDestroyed(),
      })),
    );
    assert.equal(readers.length, 1, JSON.stringify(readers));
    assert.equal(readers[0].offscreen, true);
    assert.equal(readers[0].destroyed, true);
    console.log(
      "PASS closed account window: client-rendered Runware balance read offscreen with the same session",
    );
    assert.equal(state.menuTitle, "P 12.4K · O $85.20 · F $24.50 · R $39.87");
    await command(ui, "preferences", { menuBar: "perplexity", compact: false });
    assert.equal((await command(ui, "state")).menuTitle, "12,400");
    await command(ui, "preferences", { menuBar: "openrouter", compact: true });
    assert.equal((await command(ui, "state")).menuTitle, "$85.20");
    await command(ui, "preferences", { menuBar: "fly" });
    assert.equal((await command(ui, "state")).menuTitle, "$24.50");
    await command(ui, "preferences", { menuBar: "runware" });
    assert.equal((await command(ui, "state")).menuTitle, "$39.87");
    await app.evaluate(({ Menu }) => {
      const original = Menu.buildFromTemplate;
      Menu.buildFromTemplate = function (template) {
        const menu = original.call(this, template);
        global.lastTrayLabels = template
          .map((row) => row.label)
          .filter(Boolean);
        global.lastTrayTemplate = template;
        return menu;
      };
    });
    await command(ui, "preferences", { menuBar: "icon", compact: true });
    assert.equal((await command(ui, "state")).menuTitle, "");
    const labels = await app.evaluate(() => global.lastTrayLabels);
    for (const label of [
      "Perplexity   12,400",
      "OpenRouter   $85.20",
      "Fly.io   $24.50",
      "Runware   $39.87",
    ])
      assert.ok(
        labels.includes(label),
        `Missing icon-only submenu counter: ${label}`,
      );
    await command(ui, "preferences", { menuBar: "all", compact: true });
    await ui.locator("#counters-none").click();
    await ui.waitForFunction(
      () =>
        document.querySelector("#counter-summary").textContent === "Icon only",
    );
    await ui.locator('[data-counter="perplexity"]').check();
    await ui.waitForFunction(
      () =>
        document.querySelector("#counter-summary").textContent ===
        "1 of 4 selected",
    );
    await ui.locator('[data-counter="runware"]').check();
    await ui.waitForFunction(
      () =>
        document.querySelector("#counter-summary").textContent ===
        "2 of 4 selected",
    );
    assert.equal((await command(ui, "state")).menuTitle, "P 12.4K · R $39.87");
    await app.evaluate(() => {
      const rows = global.lastTrayTemplate.find(
        (row) => row.label === "Menu bar display",
      ).submenu;
      rows.find((row) => row.label === "OpenRouter").click({ checked: true });
    });
    assert.deepEqual((await command(ui, "state")).preferences.menuBar, [
      "perplexity",
      "openrouter",
      "runware",
    ]);
    await ui.locator("#counters-all").click();
    await ui.waitForFunction(
      () =>
        document.querySelector("#counter-summary").textContent ===
        "4 of 4 selected",
    );
    await ui.locator("#check-interval").selectOption("60");
    await ui.waitForFunction(() =>
      document
        .querySelector("#schedule-status")
        .textContent.includes("60 minutes"),
    );
    assert.equal((await command(ui, "state")).background, false);
    assert.equal((await command(ui, "state")).nextCheckAt, null);
    await ui.locator(".menu-panel").screenshot({
      path: path.join(root, "docs/screenshot-controls.png"),
    });
    await ui.locator(".workspace").evaluate((el) => el.scrollTo(0, 0));
    await ui.screenshot({
      path: path.join(root, "docs/screenshot-overview.png"),
    });
    await ui.locator('[data-view="activity"]').click();
    await ui.screenshot({
      path: path.join(root, "docs/screenshot-activity.png"),
    });
    await ui.locator('[data-view="settings"]').click();
    await ui.locator("#auto-updates").uncheck();
    assert.equal(
      (await command(ui, "state")).preferences.autoUpdateChecks,
      false,
    );
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
    await app.evaluate((_electron, nextVersion) => {
      const https = process.getBuiltinModule("https");
      const { EventEmitter } = process.getBuiltinModule("events");
      const { Readable } = process.getBuiltinModule("stream");
      global.originalUpdateGet = https.get;
      https.get = (_url, _options, callback) => {
        const req = new EventEmitter();
        req.setTimeout = () => req;
        queueMicrotask(() => {
          const metadata = {
            tag_name: `v${nextVersion}`,
            assets: [
              {
                name: `AI-Credit-Checker-${nextVersion}-macOS-arm64.zip`,
                state: "uploaded",
                size: 120,
                browser_download_url: `https://github.com/paulfxyz/ai-credit-checker/releases/download/v${nextVersion}/AI-Credit-Checker-${nextVersion}-macOS-arm64.zip`,
                digest: "sha256:" + "a".repeat(64),
              },
            ],
          };
          const res = Readable.from([Buffer.from(JSON.stringify(metadata))]);
          res.statusCode = 200;
          callback(res);
        });
        return req;
      };
    }, nextVersion);
    await ui.locator("#update-check").click();
    await ui.waitForFunction(
      () => !document.querySelector("#update-install").hidden,
    );
    assert.equal((await command(ui, "state")).update.version, nextVersion);
    await ui.locator("#update-install").click();
    await ui.waitForFunction(() =>
      document
        .querySelector("#update-status")
        .textContent.includes("packaged Apple Silicon"),
    );
    await app.evaluate(() => {
      process.getBuiltinModule("https").get = global.originalUpdateGet;
    });
    console.log(
      "PASS updater UI: available release, install action and development-build safety guard",
    );
    await ui.locator('[data-view="overview"]').click();
    console.log(
      "PASS multi-select checkboxes, all/none, native checkbox callback and icon-only dropdown counters",
    );
    await command(ui, "preferences", { menuBar: ["perplexity", "runware"] });
    await command(ui, "background", true);
    for (const minutes of [10, 30, 60]) {
      await command(ui, "preferences", { checkIntervalMinutes: minutes });
      const schedule = await command(ui, "state");
      assert.equal(schedule.preferences.checkIntervalMinutes, minutes);
      assert.equal(schedule.staleAfter, minutes * 120000);
      assert.ok(
        Math.abs(schedule.nextCheckAt - Date.now() - minutes * 60000) < 3000,
      );
    }
    console.log(
      "PASS 10/30/60-minute schedule resets, paused state and cadence-aware freshness",
    );
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
      // Fly.io's real sign-in cookie (_fly) is a session cookie with no expiry.
      const fly = session.fromPartition("persist:ai-credit-checker-fly");
      await fly.cookies.set({
        url: "https://fly.io/",
        name: "_fly",
        value: "fly-session-fixture",
        path: "/",
        secure: true,
        httpOnly: true,
      });
      await fly.cookies.set({
        url: "https://api.fly.io/",
        domain: ".fly.io",
        name: "fly_domain_session",
        value: "domain-fixture",
        secure: true,
      });
      // Not Fly.io: must stay a normal session cookie and expire on quit.
      await fly.cookies.set({
        url: "https://github.com/",
        name: "third_party_session",
        value: "must-expire",
        secure: true,
      });
      // Other providers keep Chromium's normal session-cookie behaviour.
      await session
        .fromPartition("persist:ai-credit-checker-openrouter")
        .cookies.set({
          url: "https://openrouter.ai/",
          name: "openrouter_session_fixture",
          value: "must-expire",
          secure: true,
        });
    });
    const flyBefore = await app.evaluate(async ({ session }) => {
      const s = session.fromPartition("persist:ai-credit-checker-fly");
      for (let i = 0; i < 50; i++) {
        const all = await s.cookies.get({});
        const fly = all.find((c) => c.name === "_fly");
        if (fly && !fly.session) return all;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return s.cookies.get({});
    });
    const flyCookie = flyBefore.find((c) => c.name === "_fly");
    assert.equal(
      flyCookie.session,
      false,
      "Fly.io session cookie must be persisted",
    );
    assert.equal(flyCookie.httpOnly, true);
    assert.equal(flyCookie.secure, true);
    assert.equal(
      flyCookie.domain,
      "fly.io",
      "host-only cookie stays host-only",
    );
    assert.ok(
      flyCookie.expirationDate > Date.now() / 1000 + 29 * 86400 &&
        flyCookie.expirationDate < Date.now() / 1000 + 31 * 86400,
    );
    assert.equal(
      flyBefore.find((c) => c.name === "third_party_session").session,
      true,
    );
    await app.close();
    app = null;
    launched = await launch(profile);
    app = launched.a;
    ui = launched.ui;
    await fixture(app);
    state = await command(ui, "state");
    assert.equal(state.providers.perplexity.value, 12400);
    assert.equal(state.providers.runware.value, 39.872);
    assert.equal(state.preferences.flyOrganization, "sample-org");
    assert.deepEqual(state.preferences.menuBar, ["perplexity", "runware"]);
    assert.equal(state.preferences.autoUpdateChecks, false);
    assert.equal(state.preferences.checkIntervalMinutes, 60);
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
    const flyAfter = await app.evaluate(async ({ session }) =>
      session.fromPartition("persist:ai-credit-checker-fly").cookies.get({}),
    );
    assert.equal(
      flyAfter.find((c) => c.name === "_fly")?.value,
      "fly-session-fixture",
      "Fly.io sign-in must survive an app restart",
    );
    assert.equal(
      flyAfter.find((c) => c.name === "fly_domain_session")?.domain,
      ".fly.io",
    );
    assert.equal(
      flyAfter.some((c) => c.name === "third_party_session"),
      false,
    );
    const openrouterAfter = await app.evaluate(async ({ session }) =>
      session
        .fromPartition("persist:ai-credit-checker-openrouter")
        .cookies.get({ name: "openrouter_session_fixture" }),
    );
    assert.equal(openrouterAfter.length, 0);
    console.log(
      "PASS Fly.io sign-in survives restart; other session cookies keep normal behaviour",
    );
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
    await command(ui, "preferences", { flyOrganization: "another-sample-org" });
    assert.equal((await command(ui, "state")).providers.fly, undefined);
    await command(ui, "check", "fly");
    state = await checked(ui, "fly");
    assert.equal(state.providers.fly.account, "another-sample-org");
    assert.ok(
      (await requested(app)).includes(
        "https://fly.io/dashboard/another-sample-org/billing",
      ),
    );
    console.log(
      "PASS Fly organization changes invalidate old balance and target exact new URL",
    );
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
      state.providers.perplexity.error,
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
