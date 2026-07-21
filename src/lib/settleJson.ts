/**
 * Parse settle CLI stdout: engine may print logs before the JSON payload.
 * Prefer the last balanced {...} object.
 */
export function extractSettleJson(stdout: string): Record<string, unknown> | null {
  const text = (stdout || "").trim();
  if (!text) return null;

  // Fast path: whole string is JSON
  try {
    const v = JSON.parse(text);
    if (v && typeof v === "object") return v as Record<string, unknown>;
  } catch {
    /* continue */
  }

  // Scan for last top-level object
  let last: Record<string, unknown> | null = null;
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        const slice = text.slice(start, i + 1);
        try {
          const v = JSON.parse(slice);
          if (v && typeof v === "object") last = v as Record<string, unknown>;
        } catch {
          /* ignore partial */
        }
        start = -1;
      }
    }
  }
  return last;
}

export function settleErrorMessages(parsed: Record<string, unknown> | null): string[] {
  if (!parsed) return [];
  const errs = parsed.errors;
  if (!Array.isArray(errs)) return [];
  return errs.map((e) => {
    if (typeof e === "string") return e;
    if (e && typeof e === "object") {
      const o = e as Record<string, unknown>;
      const msg = String(o.error || o.message || JSON.stringify(o));
      const bid = o.bet_id ? ` [${o.bet_id}]` : "";
      return `${msg}${bid}`;
    }
    return String(e);
  });
}

export function hasAmbiguousMatchError(messages: string[]): boolean {
  return messages.some((m) => /ambiguous/i.test(m));
}
