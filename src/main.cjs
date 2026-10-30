"use strict";
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  dialog,
  session,
  shell,
  powerMonitor,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  staleMs,
  DEFAULT_PREFERENCES,
  display,
  menuTitle,
  normalizePreferences,
  importObservations,
} = require("./model.cjs");
const {
  SOURCES,
  providerURL,
  providerScope,
  providerAccount,
  parserKey,
  matchesPage,
} = require("./providers.cjs");
const updater = require("./updater.cjs");

// This override is for isolated automated tests. It never touches the real profile.
if (process.env.AI_CREDIT_CHECKER_TEST_PROFILE && !app.isPackaged)
  app.setPath("userData", process.env.AI_CREDIT_CHECKER_TEST_PROFILE);
const windows = new Map(),
  busy = new Set();
let dashboard,
  tray,
  timer,
  trayTimer,
  nextCheckAt = null,
  quitting = false;
let updateTimer,
  updateStartupTimer,
  updateBusy = false,
  updateRelease = null;
let updateState = {
  status: "idle",
  message: "Updates come from the public GitHub repository.",
  version: null,
  progress: null,
};
let state = {
  schema: 1,
  background: false,
  preferences: { ...DEFAULT_PREFERENCES },
  providers: {},
  history: [],
  migration: null,
};
const storageFile = () =>
  path.join(app.getPath("userData"), "observations.json");
const parser = fs.readFileSync(path.join(__dirname, "parser.js"), "utf8");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const uiURL = pathToFileURL(path.join(__dirname, "index.html")).href;

function persist() {
  fs.mkdirSync(app.getPath("userData"), { recursive: true, mode: 0o700 });
  const file = storageFile();
  fs.writeFileSync(file + ".tmp", JSON.stringify(state, null, 2), {
    mode: 0o600,
  });
  fs.renameSync(file + ".tmp", file);
}
function snapshot() {
  return {
    ...state,
    version: app.getVersion(),
    storageFile: storageFile(),
    running: [...busy],
    now: Date.now(),
    staleAfter: staleMs(state.preferences),
    menuTitle: menuTitle(state),
    nextCheckAt,
    update: updateState,
  };
}
function publish() {
  if (dashboard && !dashboard.isDestroyed())
    dashboard.webContents.send("state", snapshot());
  updateTray();
}
function updateTray() {
  if (!tray || tray.isDestroyed()) return;
  const title = menuTitle(state);
  if (process.platform === "darwin")
    tray.setTitle(title, { fontType: "monospacedDigit" });
  tray.setToolTip(
    "AI Credit Checker\n" +
      Object.keys(SOURCES)
        .map(
          (id) =>
            `${SOURCES[id].name}: ${display(id, state.providers[id], false, Date.now(), staleMs(state.preferences))} ${SOURCES[id].unit}`,
        )
        .join("\n"),
  );
  const balanceRows = Object.keys(SOURCES).map((id) => ({
    label: `${SOURCES[id].name}   ${display(id, state.providers[id], false, Date.now(), staleMs(state.preferences))}${busy.has(id) ? "  (checking)" : ""}`,
    submenu: [
      { label: "Open account", click: () => openAccount(id) },
      {
        label: "Check now",
        enabled: !busy.has(id),
        click: () => void check(id),
      },
      {
        label: state.providers[id]?.observedAt
          ? `Observed ${new Date(state.providers[id].observedAt).toLocaleString()}`
          : "No observation yet",
        enabled: false,
      },
    ],
  }));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open AI Credit Checker", click: showDashboard },
      { type: "separator" },
      ...balanceRows,
      { type: "separator" },
      { label: "Check all accounts", enabled: !busy.size, click: checkAll },
      {
        label: "Automatic checks",
        type: "checkbox",
        checked: state.background,
        click: (item) => setBackground(item.checked),
      },
      {
        label: "Balance check interval",
        submenu: [10, 30, 60].map((minutes) => ({
          label: `Every ${minutes} minutes`,
          type: "radio",
          checked: state.preferences.checkIntervalMinutes === minutes,
          click: () => setPreferences({ checkIntervalMinutes: minutes }),
        })),
      },
      {
        label: "Menu bar display",
        submenu: [
          {
            label: "All counters",
            click: () => setPreferences({ menuBar: Object.keys(SOURCES) }),
          },
          {
            label: "None (icon only)",
            click: () => setPreferences({ menuBar: [] }),
          },
          { type: "separator" },
          ...Object.keys(SOURCES).map((id) => ({
            label: SOURCES[id].name,
            type: "checkbox",
            checked: state.preferences.menuBar.includes(id),
            click: (item) =>
              setPreferences({
                menuBar: item.checked
                  ? [...state.preferences.menuBar, id]
                  : state.preferences.menuBar.filter(
                      (selected) => selected !== id,
                    ),
              }),
          })),
        ],
      },
      { type: "separator" },
      {
        label:
          updateState.status === "available"
            ? `Update to ${updateState.version}…`
            : "Check for updates…",
        enabled: !updateBusy,
        click: () => {
          showDashboard();
          const showSettings = () =>
            dashboard?.webContents.send("show-settings");
          if (dashboard.webContents.isLoading())
            dashboard.webContents.once("did-finish-load", showSettings);
          else showSettings();
          void checkForUpdates();
        },
      },
      { label: "Quit AI Credit Checker", click: () => app.quit() },
    ]),
  );
}
function setPreferences(input) {
  const prefs = normalizePreferences({ ...state.preferences, ...input });
  if (input?.flyOrganization && !prefs.flyOrganization)
    throw new Error("Enter a valid Fly.io organization slug, not a URL.");
  if (prefs.perplexityAccount !== state.preferences.perplexityAccount) {
    if (busy.has("perplexity"))
      throw new Error(
        "Wait for the Perplexity check to finish before changing account type.",
      );
    // A personal balance and an organization pool are different numbers.
    delete state.providers.perplexity;
    const win = windows.get("perplexity");
    if (win && !win.isDestroyed()) win.destroy();
    windows.delete("perplexity");
  }
  if (prefs.flyOrganization !== state.preferences.flyOrganization) {
    if (busy.has("fly"))
      throw new Error(
        "Wait for the Fly.io check to finish before changing organization.",
      );
    delete state.providers.fly;
    const win = windows.get("fly");
    if (win && !win.isDestroyed()) win.destroy();
    windows.delete("fly");
  }
  if (
    process.platform === "darwin" &&
    prefs.launchAtLogin !== state.preferences.launchAtLogin
  )
    app.setLoginItemSettings({
      openAtLogin: prefs.launchAtLogin,
      args: ["--hidden"],
    });
  const intervalChanged =
    prefs.checkIntervalMinutes !== state.preferences.checkIntervalMinutes;
  state.preferences = prefs;
  if (intervalChanged) {
    setBackground(state.background);
    return;
  }
  persist();
  publish();
}
async function checkForUpdates() {
  if (updateBusy) return;
  updateBusy = true;
  updateState = {
    ...updateState,
    status: "checking",
    message: "Checking GitHub Releases…",
    progress: null,
  };
  publish();
  try {
    updateRelease = await updater.latest(app.getVersion());
    updateState = updateRelease
      ? {
          status: "available",
          version: updateRelease.version,
          progress: null,
          message: `Version ${updateRelease.version} is available. Download and restart when ready.`,
        }
      : {
          status: "current",
          version: null,
          progress: null,
          message: `You're up to date (${app.getVersion()}).`,
        };
  } catch (error) {
    updateRelease = null;
    updateState = {
      status: "error",
      version: null,
      progress: null,
      message: error.message,
    };
  } finally {
    updateBusy = false;
    publish();
  }
}
async function installUpdate() {
  if (updateBusy || !updateRelease) return;
  if (
    !app.isPackaged ||
    process.platform !== "darwin" ||
    process.arch !== "arm64"
  ) {
    updateState = {
      ...updateState,
      status: "error",
      message:
        "Automatic installation is available in the packaged Apple Silicon Mac app. Download the ZIP from GitHub otherwise.",
    };
    publish();
    return;
  }
  const info = updateRelease;
  const answer = await dialog.showMessageBox(dashboard, {
    type: "question",
    buttons: ["Cancel", "Download & restart"],
    defaultId: 1,
    cancelId: 0,
    title: "Update AI Credit Checker",
    message: `Install AI Credit Checker ${info.version}?`,
    detail:
      "Downloads from paulfxyz/ai-credit-checker on GitHub, verifies SHA-256 and bundle integrity, then replaces and restarts this app. Account sessions and history stay untouched. A backup of the previous app is retained. This community build is not notarized; macOS may ask you to approve opening it.",
  });
  if (answer.response !== 1 || updateBusy || updateRelease !== info) return;
  updateBusy = true;
  updateState = {
    ...updateState,
    status: "downloading",
    message: "Downloading verified GitHub release…",
    progress: 0,
  };
  publish();
  let prepared;
  try {
    const dir = path.join(app.getPath("userData"), "updates");
    let last = -1;
    const archive = await updater.download(info, dir, (progress) => {
      if (progress !== last) {
        last = progress;
        updateState.progress = progress;
        publish();
      }
    });
    updateState = {
      ...updateState,
      status: "installing",
      message: "Verifying the app and preparing restart…",
      progress: 100,
    };
    publish();
    prepared = await updater.prepare(
      archive,
      info.version,
      path.resolve(process.execPath, "../../.."),
    );
    await updater.launchInstaller(prepared, path.join(dir, "install.log"));
    app.quit();
  } catch (error) {
    if (prepared)
      await fs.promises.rm(prepared.dir, { recursive: true, force: true });
    updateState = {
      ...updateState,
      status: "error",
      message: `${error.message} The current app has not been replaced. You can install the ZIP from GitHub manually.`,
      progress: null,
    };
    updateBusy = false;
    publish();
  }
}
function checkAll() {
  for (const id of Object.keys(SOURCES)) void check(id);
}
function openAccount(id) {
  const url = providerURL(id, state.preferences);
  if (!url) {
    showDashboard();
    record(id, {
      status: "error",
      error: "Set your Fly.io organization slug in its card before connecting.",
    });
    return;
  }
  const win = providerWindow(id, true);
  if (!win.webContents.getURL()) void navigate(win, url).catch(() => {});
}
function record(id, result) {
  const old = state.providers[id] || {};
  const now = new Date().toISOString();
  state.providers[id] = { ...old, ...result, checkedAt: now };
  state.history.push({ provider: id, checkedAt: now, ...result });
  state.history = state.history.slice(-2000);
  persist();
  publish();
}
function sourceMatches(id, value) {
  return matchesPage(id, value, state.preferences);
}
// Fly.io's sign-in cookie (_fly) is a session cookie: it has no expiry, so
// Chromium deletes it when the app quits and Fly.io asks for a new sign-in on
// every launch. Perplexity, OpenRouter and Runware use expiring cookies and are
// unaffected. Inside the isolated Fly.io partition only, give first-party
// fly.io session cookies a 30-day local lifetime so they survive restarts.
// Fly.io's server still decides whether the session is valid; signing out on
// fly.io removes the cookie as usual.
const PERSIST_SESSION_COOKIES = { fly: /(^|\.)fly\.io$/i };
const SESSION_COOKIE_DAYS = 30;
function persistSessionCookies(id, s) {
  const domain = PERSIST_SESSION_COOKIES[id];
  if (!domain) return;
  s.cookies.on("changed", (_event, cookie, _cause, removed) => {
    if (removed || !cookie.session || cookie.expirationDate) return;
    const host = String(cookie.domain || "").replace(/^\./, "");
    if (!domain.test(host)) return;
    const details = {
      url: `${cookie.secure ? "https" : "http"}://${host}${cookie.path || "/"}`,
      name: cookie.name,
      value: cookie.value,
      path: cookie.path || "/",
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      expirationDate:
        Math.floor(Date.now() / 1000) + SESSION_COOKIE_DAYS * 86400,
    };
    // Host-only cookies must stay host-only; only pass a domain when it had one.
    if (String(cookie.domain || "").startsWith("."))
      details.domain = cookie.domain;
    if (cookie.sameSite && cookie.sameSite !== "unspecified")
      details.sameSite = cookie.sameSite;
    s.cookies
      .set(details)
      .then(() => s.cookies.flushStore())
      .catch(() => {});
  });
}
function securePreferences(id) {
  return {
    partition: `persist:ai-credit-checker-${id}`,
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    backgroundThrottling: false,
  };
}
function guardRemote(win, id) {
  const wc = win.webContents;
  wc.on("will-navigate", (event, url) => {
    if (!url.startsWith("https://")) event.preventDefault();
  });
  wc.on("will-redirect", (event, url) => {
    if (!url.startsWith("https://")) event.preventDefault();
  });
  wc.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith("https://")) return { action: "deny" };
    return {
      action: "allow",
      overrideBrowserWindowOptions: {
        width: 980,
        height: 780,
        autoHideMenuBar: true,
        webPreferences: securePreferences(id),
      },
    };
  });
  wc.on("did-create-window", (child) => guardRemote(child, id));
}
function providerWindow(id, show) {
  let win = windows.get(id);
  if (!win || win.isDestroyed()) {
    win = new BrowserWindow({
      width: 1100,
      height: 830,
      show: !!show,
      title: `${SOURCES[id].name} · AI Credit Checker`,
      autoHideMenuBar: true,
      webPreferences: securePreferences(id),
    });
    guardRemote(win, id);
    win.on("close", (event) => {
      if (!quitting) {
        event.preventDefault();
        win.hide();
      }
    });
    windows.set(id, win);
  }
  if (show) {
    win.show();
    win.focus();
  }
  return win;
}
// A login window that was shown and then closed is only hidden. macOS/Chromium
// stop producing frames for it, so client-rendered pages that wait for
// requestAnimationFrame (Runware Billing) never show their balance. Closed-window
// checks therefore use a short-lived offscreen reader on the same persistent
// session partition: same cookies, no visible window, frames always produced.
function readerWindow(id) {
  const win = new BrowserWindow({
    width: 1100,
    height: 830,
    show: false,
    title: `${SOURCES[id].name} reader · AI Credit Checker`,
    webPreferences: { ...securePreferences(id), offscreen: true },
  });
  win.webContents.setFrameRate(10);
  guardRemote(win, id);
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  return win;
}
function collectionWindow(id) {
  const login = windows.get(id);
  // Keep reading the person's visible window, so checks reflect what they see.
  if (login && !login.isDestroyed() && login.isVisible())
    return { win: login, temporary: false };
  return { win: readerWindow(id), temporary: true };
}
async function navigate(win, url) {
  // Wait for the new document, not every analytics request/image on the page.
  await new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(
      () =>
        done(
          new Error(
            "Page navigation timed out. Open the login window and check the connection.",
          ),
        ),
      30000,
    );
    const ready = () => done();
    const failed = (_event, code, _description, _url, mainFrame) => {
      if (mainFrame && code !== -3)
        done(
          new Error(
            `Page navigation failed (${code}). Open the login window to inspect it.`,
          ),
        );
    };
    function done(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      win.webContents.removeListener("dom-ready", ready);
      win.webContents.removeListener("did-fail-load", failed);
      error ? reject(error) : resolve();
    }
    win.webContents.once("dom-ready", ready);
    win.webContents.on("did-fail-load", failed);
    win
      .loadURL(url, {
        extraHeaders: "Cache-Control: no-cache\nPragma: no-cache\n",
      })
      .catch(() => {});
  });
}
async function readBalance(win, id) {
  const deadline = Date.now() + 35000;
  let lastMessage = "Balance is not visible yet. Open the login window.";
  while (Date.now() < deadline) {
    if (win.isDestroyed()) throw new Error("Login window was closed.");
    if (!sourceMatches(id, win.webContents.getURL())) {
      lastMessage =
        "Sign-in, verification, or organization selection is required. Open the login window.";
      await sleep(750);
      continue;
    }
    try {
      const result = await Promise.race([
        win.webContents.executeJavaScript(`(() => {
          // The main process checked the full address with matchesPage; recheck
          // the origin here in case the page navigated in between.
          if (location.origin !== ${JSON.stringify(new URL(win.webContents.getURL()).origin)})
            return { error: 'Sign-in or verification is required.' };
          ${parser}
          try { return CreditParser.read(document, ${JSON.stringify(parserKey(id, state.preferences))}); }
          catch (error) {
            // Fixed parser messages only; never export arbitrary page exceptions.
            const allowed = [
              'Ambiguous balance: multiple different values next to the available-credit label.',
              'Available-credit label found, but its exact balance could not be identified.',
              'Available-credit label not found. Open the credit page and check login, org access and English page language.',
              'Waiting for page content.'
            ];
            return { error: allowed.includes(error.message) ? error.message :
              'The page reader failed. Open the credit page and check the displayed available-balance label.' };
          }
        })()`),
        sleep(4000).then(() => ({
          error: "Page has not responded to the balance reader yet.",
        })),
      ]);
      if (
        Number.isFinite(result?.value) &&
        result.value >= 0 &&
        (id !== "perplexity" || Number.isSafeInteger(result.value))
      )
        return result;
      lastMessage = result?.error || lastMessage;
    } catch {
      lastMessage =
        "Page changed while reading. Open the login window and complete sign-in.";
    }
    await sleep(750);
  }
  throw new Error(lastMessage);
}
async function check(id) {
  if (!SOURCES[id] || busy.has(id)) return;
  busy.add(id);
  publish();
  try {
    const url = providerURL(id, state.preferences);
    if (!url)
      throw new Error(
        "Set your Fly.io organization slug in its card before connecting.",
      );
    const collector = collectionWindow(id);
    let result;
    try {
      await navigate(collector.win, url);
      result = await readBalance(collector.win, id);
    } finally {
      if (collector.temporary && !collector.win.isDestroyed())
        collector.win.destroy();
    }
    const observedAt = new Date().toISOString();
    record(id, {
      value: result.value,
      method: result.method,
      observedAt,
      unit: SOURCES[id].unit,
      scope: providerScope(id, state.preferences),
      account: providerAccount(id, state.preferences),
      status: "ok",
      error: null,
    });
  } catch (error) {
    // Only messages generated by this app are recorded. No page dumps, headers or cookies.
    record(id, { status: "error", error: error.message });
  } finally {
    busy.delete(id);
    publish();
  }
}
function setBackground(enabled) {
  state.background = !!enabled;
  const interval = state.preferences.checkIntervalMinutes * 60 * 1000;
  clearInterval(timer);
  nextCheckAt = state.background ? Date.now() + interval : null;
  if (state.background)
    timer = setInterval(() => {
      // Don't interfere with a person completing login in a visible window.
      for (const id of Object.keys(SOURCES)) {
        const win = windows.get(id);
        if (
          state.providers[id]?.observedAt &&
          state.providers[id].status !== "imported" &&
          !win?.isVisible()
        )
          void check(id);
      }
      nextCheckAt = Date.now() + interval;
      publish();
    }, interval);
  persist();
  publish();
}
function showDashboard() {
  if (dashboard && !dashboard.isDestroyed()) {
    dashboard.show();
    dashboard.focus();
    return;
  }
  dashboard = new BrowserWindow({
    width: 1180,
    height: 920,
    minWidth: 820,
    minHeight: 700,
    backgroundColor: "#f7f8f5",
    title: "AI Credit Checker",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "../assets/app.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  dashboard.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  dashboard.webContents.on("will-navigate", (event) => event.preventDefault());
  dashboard.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      dashboard.hide();
    }
  });
  dashboard.loadFile(path.join(__dirname, "index.html"));
}
function installIPC() {
  ipcMain.handle("command", async (event, command, id) => {
    if (
      event.sender !== dashboard?.webContents ||
      event.senderFrame.url !== uiURL
    )
      throw new Error("Untrusted sender");
    if (command === "state") return snapshot();
    if (command === "open" && SOURCES[id]) {
      openAccount(id);
    } else if (command === "check" && SOURCES[id]) void check(id);
    else if (command === "check-all") checkAll();
    else if (command === "background") setBackground(id === true);
    else if (command === "preferences") setPreferences(id);
    else if (command === "update-check") void checkForUpdates();
    else if (command === "update-install") void installUpdate();
    else if (command === "update-releases")
      void shell.openExternal(
        "https://github.com/paulfxyz/ai-credit-checker/releases/latest",
      );
    else if (command === "repository")
      void shell.openExternal("https://github.com/paulfxyz/ai-credit-checker");
    else if (command === "show-data") shell.showItemInFolder(storageFile());
    else if (command === "quit") app.quit();
    else if (command === "export") {
      const result = await dialog.showSaveDialog(dashboard, {
        defaultPath: "ai-credit-checker-observations.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!result.canceled && result.filePath)
        fs.writeFileSync(
          result.filePath,
          JSON.stringify(
            { schema: 1, providers: state.providers, history: state.history },
            null,
            2,
          ),
          { mode: 0o600 },
        );
    }
    return snapshot();
  });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => showDashboard());
  app.on("before-quit", () => {
    quitting = true;
    clearInterval(timer);
    clearInterval(trayTimer);
    clearInterval(updateTimer);
    clearTimeout(updateStartupTimer);
    // Write pending cookie changes before exit so sign-ins survive restarts.
    for (const id of Object.keys(SOURCES))
      session
        .fromPartition(`persist:ai-credit-checker-${id}`)
        .cookies.flushStore()
        .catch(() => {});
  });
  app.on("window-all-closed", () => {});
  app.on("activate", showDashboard);
  app.whenReady().then(() => {
    try {
      const saved = JSON.parse(fs.readFileSync(storageFile(), "utf8"));
      if (saved.schema === 1 && saved.providers && Array.isArray(saved.history))
        state = saved;
    } catch {
      // Only numeric observations are migrated. Browser cookies/passwords are never copied.
      if (!process.env.AI_CREDIT_CHECKER_TEST_PROFILE) {
        try {
          const oldFile = path.join(
            app.getPath("appData"),
            "Credit Monitor POC",
            "observations.json",
          );
          const migrated = importObservations(
            JSON.parse(fs.readFileSync(oldFile, "utf8")),
          );
          state = {
            ...state,
            ...migrated,
            migration:
              "POC history imported. Sign in once in this new app to connect your accounts.",
          };
        } catch {}
      }
    }
    state.preferences = normalizePreferences(state.preferences);
    // Before 2.1.6 Perplexity always read the organization pool. Upgrades
    // default to the personal balance, so do not show an old pool reading as it.
    const savedPerplexity = state.providers?.perplexity;
    if (
      savedPerplexity &&
      savedPerplexity.scope !== providerScope("perplexity", state.preferences)
    )
      delete state.providers.perplexity;
    if (process.platform === "darwin")
      state.preferences.launchAtLogin = app.getLoginItemSettings().openAtLogin;
    for (const id of Object.keys(SOURCES)) {
      const s = session.fromPartition(`persist:ai-credit-checker-${id}`);
      s.setPermissionRequestHandler((_wc, _permission, callback) =>
        callback(false),
      );
      s.setPermissionCheckHandler(() => false);
      s.on("will-download", (event) => event.preventDefault());
      persistSessionCookies(id, s);
    }
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: "AI Credit Checker",
          submenu: [
            { label: "Open dashboard", click: showDashboard },
            { role: "quit" },
          ],
        },
        { role: "editMenu" },
        { role: "windowMenu" },
      ]),
    );
    const icon = nativeImage.createFromPath(
      path.join(__dirname, "../assets/menuTemplate.png"),
    );
    icon.setTemplateImage(true);
    tray = new Tray(icon);
    installIPC();
    if (!process.argv.includes("--hidden")) showDashboard();
    setBackground(state.background);
    if (app.isPackaged) {
      updateStartupTimer = setTimeout(() => {
        if (state.preferences.autoUpdateChecks) void checkForUpdates();
      }, 15000);
      updateTimer = setInterval(
        () => {
          if (state.preferences.autoUpdateChecks) void checkForUpdates();
        },
        6 * 60 * 60 * 1000,
      );
    }
    trayTimer = setInterval(updateTray, 30000);
    powerMonitor.on("resume", () => {
      if (state.background) {
        for (const id of Object.keys(SOURCES))
          if (
            state.providers[id]?.observedAt &&
            state.providers[id].status !== "imported" &&
            !windows.get(id)?.isVisible()
          )
            void check(id);
      }
    });
  });
}
