(function (root) {
  "use strict";
  const norm = (text) =>
    String(text || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  function number(text, provider) {
    let s = norm(text);
    if (["openrouter", "fly", "runware"].includes(provider)) {
      s = s.replace(/^\$\s+/, "$");
      const currency =
        provider === "runware"
          ? /^\$(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,9})?$/
          : /^\$(?:\d+|\d{1,3}(?:,\d{3})+)\.\d{2}$/;
      if (!currency.test(s)) return null;
      const value = Number(s.replace(/[$,]/g, ""));
      return Number.isFinite(value) && value <= Number.MAX_SAFE_INTEGER
        ? value
        : null;
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
  // Personal Perplexity plans (Pro, Max) show the spendable total in Settings →
  // Usage and credits as "75,134 credits left", and in the Usage menu as
  // "Total available credits 75,134 / 773,877". Read only those totals, never
  // the plan, purchased or bonus sub-balances.
  function readPersonalPerplexity(doc) {
    const left = /^(\d[\d, ]*) credits? left$/i;
    const total =
      /^Total available credits\s*:?\s*(\d[\d, ]*)(?:\s*\/\s*\d[\d, ]*)?$/i;
    const pick = (text) => {
      const t = norm(text);
      const m = t.match(left) || t.match(total);
      return m ? number(m[1].trim(), "perplexity") : undefined;
    };
    const aria = exact(
      [...doc.querySelectorAll("[aria-label]")]
        .filter(visible)
        .map((el) => pick(el.getAttribute("aria-label")) ?? null),
    );
    if (aria !== null)
      return { value: aria, method: "credits-left accessible label" };
    const values = [];
    let labelled = false;
    for (const el of doc.body.querySelectorAll("*")) {
      if (
        !visible(el) ||
        ["SCRIPT", "STYLE", "SVG", "PATH"].includes(el.tagName)
      )
        continue;
      if (/^Total available credits$/i.test(norm(el.textContent))) {
        // Label and amount in separate elements, as in the Usage menu.
        const next = norm(el.nextElementSibling?.textContent).match(
          /^(\d[\d, ]*)(?:\s*\/\s*\d[\d, ]*)?$/,
        );
        if (
          ![...el.children].some((c) =>
            /^Total available credits$/i.test(norm(c.textContent)),
          )
        ) {
          labelled = true;
          values.push(next ? number(next[1].trim(), "perplexity") : null);
        }
        continue;
      }
      const value = pick(el.textContent);
      if (value === undefined) continue;
      // Innermost element only, so wrappers do not count the same text twice.
      if ([...el.children].some((c) => pick(c.textContent) !== undefined))
        continue;
      labelled = true;
      values.push(value);
    }
    const lines = String(doc.body.innerText || "")
      .split(/\r?\n/)
      .map(norm)
      .filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const value = pick(lines[i]);
      if (value !== undefined) {
        labelled = true;
        values.push(value);
      } else if (/^Total available credits$/i.test(lines[i])) {
        labelled = true;
        const next = (lines[i + 1] || "").match(
          /^(\d[\d, ]*)(?:\s*\/\s*\d[\d, ]*)?$/,
        );
        values.push(next ? number(next[1].trim(), "perplexity") : null);
      }
    }
    const value = exact(values);
    if (value !== null) return { value, method: "credits-left total" };
    throw new Error(
      labelled
        ? "Available-credit label found, but its exact balance could not be identified."
        : "Available-credit label not found. Open the credit page and check login, org access and English page language.",
    );
  }
  function read(doc, provider) {
    if (
      ![
        "perplexity",
        "perplexity-personal",
        "openrouter",
        "fly",
        "runware",
      ].includes(provider)
    )
      throw new Error("Unknown provider.");
    if (!doc.body) throw new Error("Waiting for page content.");
    if (provider === "perplexity-personal") return readPersonalPerplexity(doc);
    // The live UK-English account page says "Available organisation credits".
    // Accept only these explicit available-pool labels, not generic credits/usage.
    const expected =
      provider === "perplexity"
        ? [
            "available org credits",
            "available organization credits",
            "available organisation credits",
          ]
        : provider === "fly"
          ? ["credit balance", "purchased credit balance"]
          : provider === "runware"
            ? ["available balance", "current balance"]
            : ["total available"];
    const labelledAmount =
      provider === "perplexity"
        ? /^Available (?:org|organization|organisation) credits\s*:?\s+(.+)$/i
        : provider === "fly"
          ? /^(?:Purchased )?Credit Balance\s*:?\s+(.+)$/i
          : provider === "runware"
            ? /^(?:Available|Current) Balance\s*:?\s+(.+)$/i
            : /^Total available(?: credits)?\s*:?\s+(.+)$/i;
    const isLabel = (text) => expected.includes(norm(text).toLowerCase());
    // Use the account-specific available-balance label, not personal header usage.
    const aria = [...doc.querySelectorAll("[aria-label]")]
      .filter(visible)
      .map((el) => {
        const text = norm(el.getAttribute("aria-label"));
        const match = text.match(labelledAmount);
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
          // Runware's billing redesign puts monthly spend inside the balance
          // card. Ignore only an explicitly labelled spend metric, including
          // nested currency spans; never choose the first dollar amount.
          .filter((el) => {
            if (provider !== "runware") return true;
            for (
              let parent = el;
              parent && parent !== card;
              parent = parent.parentElement
            ) {
              const spend = norm(parent.textContent).match(
                /^(?:Spent|Spend) this month\s*:?\s*(\$.+)$/i,
              );
              if (spend && number(spend[1], provider) !== null) return false;
            }
            return true;
          })
          // A numeric wrapper can contain styled fractional digits. Keep the full
          // amount, not a truncated child such as "$39.87" inside "$39.872".
          .filter((el) => {
            for (
              let parent = el.parentElement;
              parent && parent !== card;
              parent = parent.parentElement
            )
              if (number(parent.textContent, provider) !== null) return false;
            return true;
          })
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
      if (isLabel(lines[i])) {
        const offset =
          provider === "runware" &&
          lines[i + 1]?.toLowerCase() === "available credits for api usage"
            ? 2
            : 1;
        values.push(number(lines[i + offset], provider));
      }
      const inline = lines[i].match(labelledAmount);
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
