"use strict";
const $ = (id) => document.getElementById(id);
let latest;
const names = { perplexity: "Perplexity", openrouter: "OpenRouter" };
const format = (id, value) =>
  id === "openrouter"
    ? `$${value.toFixed(2)}`
    : new Intl.NumberFormat("en-US").format(value);
function relative(time) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(time)) / 1000),
  );
  return seconds < 60
    ? "just now"
    : seconds < 3600
      ? `${Math.floor(seconds / 60)} min ago`
      : new Date(time).toLocaleString();
}
function chart(id, history) {
  const svg = $(id + "-chart");
  svg.replaceChildren();
  const rows = history
    .filter(
      (r) => r.provider === id && r.status === "ok" && Number.isFinite(r.value),
    )
    .slice(-24);
  const ns = "http://www.w3.org/2000/svg";
  if (rows.length < 2) {
    const line = document.createElementNS(ns, "line");
    for (const [key, value] of Object.entries({
      x1: 0,
      y1: 24,
      x2: 300,
      y2: 24,
    }))
      line.setAttribute(key, value);
    svg.append(line);
    return;
  }
  const values = rows.map((r) => r.value),
    min = Math.min(...values),
    max = Math.max(...values);
  const line = document.createElementNS(ns, "polyline");
  line.setAttribute(
    "points",
    values
      .map(
        (value, i) =>
          `${(i / (values.length - 1)) * 300},${max === min ? 18 : 30 - ((value - min) / (max - min)) * 24}`,
      )
      .join(" "),
  );
  svg.append(line);
}
function render(state) {
  latest = state;
  $("version").textContent = `v${state.version}`;
  $("settings-version").textContent = state.version;
  $("storage").textContent = state.storageFile;
  $("background").checked = state.background;
  $("menu-mode").value = state.preferences.menuBar;
  $("compact").checked = state.preferences.compact;
  $("launch-login").checked = state.preferences.launchAtLogin;
  $("menu-preview-value").textContent = state.menuTitle;
  $("preview-clock").textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  $("migration").hidden =
    !state.migration ||
    Object.values(state.providers).every((r) => r.status !== "imported");
  $("migration").textContent = state.migration || "";
  $("schedule-status").textContent = state.background
    ? `Every 10 minutes while your Mac is awake. Next cycle ${state.nextCheckAt ? new Date(state.nextCheckAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "soon"}.`
    : "Automatic checks are paused. Turn on to check every 10 minutes.";
  $("check-all").disabled = state.running.length > 0;
  for (const id of Object.keys(names)) {
    const item = state.providers[id],
      running = state.running.includes(id);
    const time = Date.parse(item?.observedAt);
    const fresh =
      item?.status === "ok" &&
      Number.isFinite(time) &&
      Date.now() - time < state.staleAfter &&
      time <= Date.now() + 120000;
    $(id + "-value").textContent = fresh ? format(id, item.value) : "∞";
    const badge = $(id + "-badge"),
      status = $(id + "-status");
    badge.textContent = running
      ? "Checking…"
      : fresh
        ? "Up to date"
        : item?.status === "error"
          ? "Check failed"
          : item?.status === "imported"
            ? "Sign in"
            : item
              ? "Stale"
              : "Not connected";
    badge.className = `state-badge${fresh ? " ok" : item?.status === "error" ? " error" : ""}`;
    status.className = `status${item?.status === "error" && !running ? " error" : ""}`;
    status.textContent = running
      ? "Reading the credit page. Allow up to 65 seconds."
      : fresh
        ? `Updated ${relative(item.observedAt)}`
        : item?.status === "error"
          ? item.error
          : item?.status === "imported"
            ? "History imported. Open your account and sign in to reconnect."
            : item?.observedAt
              ? `Last observed ${relative(item.observedAt)}. Check again for a fresh balance.`
              : "Open your account, sign in, then check its balance.";
    document.querySelector(`[data-check="${id}"]`).disabled = running;
    chart(id, state.history);
  }
  const filter = $("history-filter").value;
  const allRows = state.history.filter(
    (row) => filter === "all" || row.provider === filter,
  );
  $("history-count").textContent =
    `${allRows.length} checks · latest 100 shown`;
  $("history").replaceChildren();
  $("history-empty").hidden = allRows.length > 0;
  for (const item of allRows.slice(-100).reverse()) {
    const row = document.createElement("tr");
    for (const value of [
      names[item.provider],
      new Date(item.checkedAt).toLocaleString(),
      item.status === "ok" ? format(item.provider, item.value) : "∞",
      item.status === "ok" ? "Observed" : "Failed",
    ]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    if (item.status !== "ok") {
      row.lastChild.className = "failed";
      row.lastChild.title = item.error || "Check failed";
    }
    $("history").append(row);
  }
}
async function command(name, id) {
  try {
    render(await window.monitor.command(name, id));
    $("notice").textContent = "";
  } catch {
    $("notice").textContent =
      "That action could not be completed. Please try again or reopen the app.";
  }
}
document.querySelectorAll("[data-view]").forEach(
  (button) =>
    (button.onclick = () => {
      document
        .querySelectorAll(".view")
        .forEach(
          (view) => (view.hidden = view.id !== "view-" + button.dataset.view),
        );
      document.querySelectorAll("[data-view]").forEach((nav) => {
        nav.classList.toggle("active", nav === button);
        if (nav === button) nav.setAttribute("aria-current", "page");
        else nav.removeAttribute("aria-current");
      });
    }),
);
document
  .querySelectorAll("[data-open]")
  .forEach(
    (button) => (button.onclick = () => command("open", button.dataset.open)),
  );
document
  .querySelectorAll("[data-check]")
  .forEach(
    (button) => (button.onclick = () => command("check", button.dataset.check)),
  );
for (const id of ["check-all", "export", "quit", "repository", "show-data"])
  $(id).onclick = () => command(id);
$("background").onchange = (event) =>
  command("background", event.target.checked);
$("menu-mode").onchange = (event) =>
  command("preferences", {
    ...latest.preferences,
    menuBar: event.target.value,
  });
$("compact").onchange = (event) =>
  command("preferences", {
    ...latest.preferences,
    compact: event.target.checked,
  });
$("launch-login").onchange = (event) =>
  command("preferences", {
    ...latest.preferences,
    launchAtLogin: event.target.checked,
  });
$("history-filter").onchange = () => latest && render(latest);
window.monitor.subscribe(render);
command("state");
setInterval(() => command("state"), 30000);
