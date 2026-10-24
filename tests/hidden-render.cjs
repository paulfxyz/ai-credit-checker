"use strict";
// Runs Electron directly, WITHOUT Playwright: an attached automation client can
// keep hidden pages rendering and mask this bug. Reproduces the 2.1.4 Runware
// failure: a window that was shown and then hidden (the account window after the
// close button) stops running animation frames, so a client-rendered balance
// never appears. The offscreen reader used by 2.1.5 must keep rendering.
const { spawnSync } = require("node:child_process");
const path = require("node:path");
if (!process.versions.electron) {
  const run = spawnSync(require("electron"), ["--no-sandbox", __filename], {
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
    timeout: 90000,
  });
  const line = (run.stdout || "")
    .split("\n")
    .find((l) => l.startsWith("RESULT "));
  if (!line) {
    console.error(run.stdout);
    throw new Error("Hidden-render probe produced no result.");
  }
  const result = JSON.parse(line.slice(7));
  console.log("Hidden-render probe:", JSON.stringify(result));
  if (result.offscreen !== "rendered")
    throw new Error("Offscreen reader did not render the client-side page.");
  if (result.hiddenAfterShown !== "rendered")
    console.log(
      "NOTE this platform stops rendering hidden windows that were shown; the offscreen reader is required.",
    );
  console.log(
    "PASS offscreen reader renders client-side pages without a visible window",
  );
  return;
}
const { app, BrowserWindow, session } = require("electron");
const page =
  '<main id="m">loading</main><script>requestAnimationFrame(() => requestAnimationFrame(() => { document.getElementById("m").textContent = "rendered"; }));</script>';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  session
    .fromPartition("hidden-render-probe")
    .protocol.handle(
      "https",
      () => new Response(page, { headers: { "content-type": "text/html" } }),
    );
  const make = (extra = {}) =>
    new BrowserWindow({
      show: false,
      webPreferences: {
        partition: "hidden-render-probe",
        sandbox: true,
        contextIsolation: true,
        backgroundThrottling: false,
        ...extra,
      },
    });
  const read = async (win) => {
    await win.loadURL("https://probe.test/billing");
    for (let i = 0; i < 40; i++) {
      const text = await win.webContents.executeJavaScript(
        'document.getElementById("m").textContent',
      );
      if (text === "rendered") return text;
      await wait(100);
    }
    return "not rendered";
  };
  const shown = make();
  shown.show();
  await wait(700);
  shown.hide();
  const result = {
    hiddenAfterShown: await read(shown),
    offscreen: await read(make({ offscreen: true })),
  };
  process.stdout.write(`RESULT ${JSON.stringify(result)}\n`);
  app.exit(0);
});
