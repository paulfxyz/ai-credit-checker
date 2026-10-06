(function (root) {
  "use strict";
  const norm = (text) =>
    String(text || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  function number(text, provider) {
    let s = norm(text);
    if (provider === "openrouter") {
      if (!/^\$(?:\d+|\d{1,3}(?:,\d{3})+)\.\d{2}$/.test(s)) return null;
      return Number(s.replace(/[$,]/g, ""));
    }
    s = s.replace(/\s+credits$/i, "");
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,3}(?: \d{3})+)$/.test(s)) return null;
    const n = Number(s.replace(/[, ]/g, ""));
    return Number.isSafeInteger(n) ? n : null;
  }
  function visible(el) {
    if (
      !el ||
      el.closest('[hidden],[aria-hidden="true"],script,style,template')
    )
      return false;
    const style = root.getComputedStyle(el);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      el.getClientRects().length > 0
    );
  }
  function exact(values) {
    const set = [...new Set(values.filter((v) => v !== null))];
    if (set.length > 1)
      throw new Error(
        "Ambiguous balance: multiple different values next to the available-credit label.",
      );
    return set.length ? set[0] : null;
  }
  function read(doc, provider) {
    if (!doc.body) throw new Error("Waiting for page content.");
    // The live UK-English account page says "Available organisation credits".
    // Accept only these explicit available-pool labels, not generic credits/usage.
    const expected =
      provider === "perplexity"
        ? [
            "available org credits",
            "available organization credits",
            "available organisation credits",
          ]
        : ["total available"];
    const isLabel = (text) => expected.includes(norm(text).toLowerCase());
    // Use the account-specific available-balance label, not personal header usage.
    const aria = [...doc.querySelectorAll("[aria-label]")]
      .filter(visible)
      .map((el) => {
        const text = norm(el.getAttribute("aria-label"));
        const re =
          provider === "perplexity"
            ? /^Available (?:org|organization|organisation) credits:\s*(.+)$/i
            : /^Total available credits:\s*(.+)$/i;
        const match = text.match(re);
        return match ? number(match[1], provider) : null;
      });
    const ariaValue = exact(aria);
    if (ariaValue !== null)
      return { value: ariaValue, method: "available-balance accessible label" };

    // Direct text anchoring tolerates tooltip wrappers nested inside a label.
    const elements = [...doc.body.querySelectorAll("*")].filter(
      (el) =>
        visible(el) &&
        !["SCRIPT", "STYLE", "SVG", "PATH", "BUTTON"].includes(el.tagName),
    );
    const labels = elements.filter((el) => {
      const own = norm(
        [...el.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent)
          .join(" "),
      ).toLowerCase();
      return (
        isLabel(own) ||
        (isLabel(el.textContent) &&
          ![...el.children].some((c) => isLabel(c.textContent)))
      );
    });
    const found = [];
    for (const label of labels) {
      let card = label.parentElement;
      for (
        let level = 0;
        card && level < 6;
        level++, card = card.parentElement
      ) {
        if (
          ["BODY", "MAIN", "TABLE"].includes(card.tagName) ||
          norm(card.textContent).length > 1800
        )
          break;
        // Every tag is eligible: balances may be headings, outputs, or nested spans.
        const candidates = [...card.querySelectorAll("*")]
          .filter(
            (el) => visible(el) && !el.closest('button,table,[role="tooltip"]'),
          )
          .map((el) => number(el.textContent, provider));
        const value = exact(candidates);
        if (value !== null) {
          found.push(value);
          break;
        }
      }
    }
    const domValue = exact(found);
    if (domValue !== null)
      return { value: domValue, method: "available-balance card" };

    // Rendered text fallback: exact label followed by the exact amount on the next nonempty line.
    // No broad first-number scan; refill amounts and usage-table numbers cannot substitute.
    const lines = String(doc.body.innerText || "")
      .split(/\r?\n/)
      .map(norm)
      .filter(Boolean);
    const values = [];
    for (let i = 0; i < lines.length; i++) {
      if (isLabel(lines[i])) values.push(number(lines[i + 1], provider));
      const inline = lines[i].match(
        provider === "perplexity"
          ? /^Available (?:org|organization|organisation) credits\s*:?\s+([\d, ]+(?:\s+credits)?)$/i
          : /^Total available\s*:?\s+(\$[\d,]+\.\d{2})$/i,
      );
      if (inline) values.push(number(inline[1], provider));
    }
    const lineValue = exact(values);
    if (lineValue !== null)
      return { value: lineValue, method: "exact rendered-text label" };
    throw new Error(
      labels.length
        ? "Available-credit label found, but its exact balance could not be identified."
        : "Available-credit label not found. Open the credit page and check login, org access and English page language.",
    );
  }
  root.CreditParser = { read, number };
  if (typeof module !== "undefined") module.exports = root.CreditParser;
})(globalThis);
