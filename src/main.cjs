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
  STALE_MS,
  DEFAULT_PREFERENCES,
  display,
  menuTitle,
  normalizePreferences,
  importObservations,
} = require("./model.cjs");

// This override is for isolated automated tests. It never touches the real profile.
if (process.env.AI_CREDIT_CHECKER_TEST_PROFILE && !app.isPackaged)
  app.setPath("userData", process.env.AI_CREDIT_CHECKER_TEST_PROFILE);
const SOURCES = {
  perplexity: {
    name: "Perplexity",
    url: "https://www.perplexity.ai/account/org/credits-usage",
    unit: "credits",
    scope: "organization",
  },
  openrouter: {
    name: "OpenRouter",
    url: "https://openrouter.ai/settings/credits",
    unit: "USD",
    scope: "account",
  },
};
const INTERVAL = 10 * 60 * 1000;
const STALE = STALE_MS;
const windows = new Map(),
  busy = new Set();
let dashboard,
  tray,
  timer,
  trayTimer,
  nextCheckAt = null,
  quitting = false;
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
    staleAfter: STALE,
    menuTitle: menuTitle(state),
    nextCheckAt,
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
    `AI Credit Checker\nPerplexity: ${display("perplexity", state.providers.perplexity)} credits\nOpenRouter: ${display("openrouter", state.providers.openrouter)} USD`,
  );
  const balanceRows = Object.keys(SOURCES).map((id) => ({
    label: `${SOURCES[id].name}   ${display(id, state.providers[id])}${busy.has(id) ? "  (checking)" : ""}`,
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
      { label: "Check both accounts", enabled: !busy.size, click: checkAll },
      {
        label: "Automatic checks",
        type: "checkbox",
        checked: state.background,
        click: (item) => setBackground(item.checked),
      },
      {
        label: "Menu bar display",
        submenu: [
          ...[
            ["both", "Both balances"],
            ["perplexity", "Perplexity only"],
            ["openrouter", "OpenRouter only"],
            ["icon", "Icon only"],
          ].map(([value, label]) => ({
            label,
            type: "radio",
            checked: state.preferences.menuBar === value,
            click: () =>
              setPreferences({ ...state.preferences, menuBar: value }),
          })),
        ],
      },
      { type: "separator" },
      { label: "Quit AI Credit Checker", click: () => app.quit() },
    ]),
  );
}
function setPreferences(input) {
  const prefs = normalizePreferences(input);
  if (
    process.platform === "darwin" &&
    prefs.launchAtLogin !== state.preferences.launchAtLogin
  )
    app.setLoginItemSettings({
      openAtLogin: prefs.launchAtLogin,
      args: ["--hidden"],
    });
  state.preferences = prefs;
  persist();
  publish();
}
function checkAll() {
  for (const id of Object.keys(SOURCES)) void check(id);
}
function openAccount(id) {
  const win = providerWindow(id, true);
  if (!win.webContents.getURL())
    void navigate(win, SOURCES[id].url).catch(() => {});
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
  try {
    const u = new URL(value),
      expected = new URL(SOURCES[id].url);
    return (
      u.protocol === "https:" &&
      u.hostname === expected.hostname &&
      u.pathname.replace(/\/$/, "") === expected.pathname
    );
  } catch {
    return false;
  }
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
          const expected = ${JSON.stringify(SOURCES[id].url)};
          const actual = new URL(location.href), target = new URL(expected);
          if (actual.origin !== target.origin || actual.pathname.replace(/\\/$/, '') !== target.pathname)
            return { error: 'Sign-in or verification is required.' };
          ${parser}
          try { return CreditParser.read(document, ${JSON.stringify(id)}); }
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
    const win = providerWindow(id, false);
    await navigate(win, SOURCES[id].url);
    const result = await readBalance(win, id);
    const observedAt = new Date().toISOString();
    record(id, {
      value: result.value,
      method: result.method,
      observedAt,
      unit: SOURCES[id].unit,
      scope: SOURCES[id].scope,
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
  clearInterval(timer);
  nextCheckAt = state.background ? Date.now() + INTERVAL : null;
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
      nextCheckAt = Date.now() + INTERVAL;
      publish();
    }, INTERVAL);
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
    width: 1060,
    height: 820,
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
    if (process.platform === "darwin")
      state.preferences.launchAtLogin = app.getLoginItemSettings().openAtLogin;
    for (const id of Object.keys(SOURCES)) {
      const s = session.fromPartition(`persist:ai-credit-checker-${id}`);
      s.setPermissionRequestHandler((_wc, _permission, callback) =>
        callback(false),
      );
      s.setPermissionCheckHandler(() => false);
      s.on("will-download", (event) => event.preventDefault());
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
