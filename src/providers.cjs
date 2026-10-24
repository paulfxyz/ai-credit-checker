"use strict";
const SOURCES = {
  perplexity: {
    name: "Perplexity",
    short: "P",
    url: "https://www.perplexity.ai/account/org/credits-usage",
    unit: "credits",
    scope: "organization",
  },
  openrouter: {
    name: "OpenRouter",
    short: "O",
    url: "https://openrouter.ai/settings/credits",
    unit: "USD",
    scope: "account",
  },
  fly: {
    name: "Fly.io",
    short: "F",
    url: null,
    unit: "USD",
    scope: "organization",
  },
  runware: {
    name: "Runware",
    short: "R",
    url: "https://runware.ai/settings/billing",
    unit: "USD",
    scope: "account",
  },
};
function organizationSlug(value) {
  const s = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s) ? s : "";
}
function providerURL(id, preferences = {}) {
  if (!Object.hasOwn(SOURCES, id)) return null;
  if (id !== "fly") return SOURCES[id].url;
  const org = organizationSlug(preferences.flyOrganization);
  return org ? `https://fly.io/dashboard/${org}/billing` : null;
}
function matchesPage(id, value, preferences = {}) {
  try {
    const expected = new URL(providerURL(id, preferences));
    const actual = new URL(value);
    return (
      actual.origin === expected.origin &&
      actual.pathname.replace(/\/$/, "") === expected.pathname
    );
  } catch {
    return false;
  }
}
module.exports = { SOURCES, organizationSlug, providerURL, matchesPage };
