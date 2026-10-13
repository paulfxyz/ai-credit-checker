"use strict";
const STALE_MS = 20 * 60 * 1000;
const { SOURCES, organizationSlug } = require("./providers.cjs");
const DEFAULT_PREFERENCES = {
  menuBar: "all",
  compact: true,
  launchAtLogin: false,
  flyOrganization: "",
};
function reading(item, now = Date.now()) {
  const time = Date.parse(item?.observedAt);
  return (
    !!item &&
    item.status === "ok" &&
    typeof item.value === "number" &&
    Number.isFinite(item.value) &&
    item.value >= 0 &&
    Number.isFinite(time) &&
    time <= now + 120000 &&
    now - time < STALE_MS
  );
}
function compact(value) {
  if (value < 1000) return String(value);
  const scale = value < 1e6 ? 1000 : 1e6;
  return (
    (Math.trunc((value / scale) * 10) / 10).toFixed(1) +
    (scale === 1000 ? "K" : "M")
  );
}
function display(id, item, short = false, now = Date.now()) {
  if (!reading(item, now)) return "∞";
  return id !== "perplexity"
    ? `$${item.value.toFixed(2)}`
    : short
      ? compact(item.value)
      : new Intl.NumberFormat("en-US").format(item.value);
}
function menuTitle(state, now = Date.now()) {
  const prefs = normalizePreferences(state.preferences);
  const ids =
    prefs.menuBar === "icon"
      ? []
      : prefs.menuBar === "all"
        ? Object.keys(SOURCES)
        : [prefs.menuBar];
  return ids
    .map(
      (id) =>
        `${ids.length > 1 ? SOURCES[id].short + " " : ""}${display(id, state.providers[id], prefs.compact, now)}`,
    )
    .join(" · ");
}
function normalizePreferences(input) {
  return {
    menuBar: ["all", ...Object.keys(SOURCES), "icon"].includes(input?.menuBar)
      ? input.menuBar
      : "all",
    compact: input?.compact !== false,
    launchAtLogin: input?.launchAtLogin === true,
    flyOrganization: organizationSlug(input?.flyOrganization),
  };
}
function importObservations(old) {
  if (old?.schema !== 1 || !old.providers || !Array.isArray(old.history))
    throw new Error("Unsupported history format");
  function clean(row, id, imported = false) {
    if (
      !Object.hasOwn(SOURCES, id) ||
      typeof row?.value !== "number" ||
      !Number.isFinite(row.value) ||
      row.value < 0 ||
      !Number.isFinite(Date.parse(row.observedAt)) ||
      (id === "perplexity" && !Number.isSafeInteger(row.value))
    )
      return null;
    return {
      value: row.value,
      unit: SOURCES[id].unit,
      scope: SOURCES[id].scope,
      observedAt: row.observedAt,
      checkedAt: row.checkedAt || row.observedAt,
      status: imported ? "imported" : row.status === "ok" ? "ok" : "error",
      error: null,
      method: "Imported local observation",
    };
  }
  const providers = {};
  for (const id of Object.keys(SOURCES)) {
    const row = clean(old.providers[id], id, true);
    if (row) providers[id] = row;
  }
  const history = old.history.slice(-2000).flatMap((row) => {
    const cleanRow = clean(row, row.provider);
    return cleanRow ? [{ ...cleanRow, provider: row.provider }] : [];
  });
  return { providers, history };
}
module.exports = {
  STALE_MS,
  DEFAULT_PREFERENCES,
  reading,
  compact,
  display,
  menuTitle,
  normalizePreferences,
  importObservations,
};
