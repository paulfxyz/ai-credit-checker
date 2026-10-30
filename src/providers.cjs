"use strict";
const SOURCES = {
  perplexity: {
    name: "Perplexity",
    short: "P",
    // Default: personal Usage page ("N credits left"). Organization pools stay
    // available as an option for Enterprise accounts.
    url: "https://www.perplexity.ai/account/usage",
    organizationURL: "https://www.perplexity.ai/account/org/credits-usage",
    unit: "credits",
    scope: "account",
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
function perplexityAccount(preferences = {}) {
  return preferences.perplexityAccount === "organization"
    ? "organization"
    : "personal";
}
// The balance scope recorded with each observation.
function providerScope(id, preferences = {}) {
  if (id === "perplexity")
    return perplexityAccount(preferences) === "organization"
      ? "organization"
      : "account";
  return SOURCES[id].scope;
}
// Account identity used to keep histories from different accounts apart.
function providerAccount(id, preferences = {}) {
  if (id === "fly") return organizationSlug(preferences.flyOrganization);
  if (id === "perplexity") return perplexityAccount(preferences);
  return undefined;
}
// The parser rule for this provider and account type.
function parserKey(id, preferences = {}) {
  return id === "perplexity" && perplexityAccount(preferences) === "personal"
    ? "perplexity-personal"
    : id;
}
function providerURL(id, preferences = {}) {
  if (!Object.hasOwn(SOURCES, id)) return null;
  if (id === "perplexity")
    return perplexityAccount(preferences) === "organization"
      ? SOURCES.perplexity.organizationURL
      : SOURCES.perplexity.url;
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
module.exports = {
  SOURCES,
  organizationSlug,
  perplexityAccount,
  providerScope,
  providerAccount,
  parserKey,
  providerURL,
  matchesPage,
};
