/**
 * Ledger-mutation safety for `run_nt` argv.
 * Non-dry-run recommend, place-ack, abandon, and live settle require human confirm.
 */

/** True when args would mutate the ledger / open risk (not dry-run / draft). */
export function isLedgerMutatingNt(args: string[]): boolean {
  if (!args.length) return false;
  const cmd = (args[0] || "").toLowerCase();
  const has = (flag: string) =>
    args.some((a) => a === flag || a.toLowerCase() === flag.toLowerCase());

  if (cmd === "recommend") {
    return !has("--dry-run");
  }
  if (cmd === "place-ack" || cmd === "abandon") {
    return true;
  }
  if (cmd === "settle") {
    // Draft / dry-run preview does not write results; live settle does.
    if (has("--dry-run") || has("--draft")) return false;
    return true;
  }
  return false;
}

export function mutationConfirmMessage(args: string[]): string {
  const cmd = (args[0] || "").toLowerCase();
  const joined = args.join(" ");
  if (cmd === "recommend") {
    return (
      "Live recommend will append Pending rows to the ledger.\n\n" +
      "Confirm odds path and board freshness, then place on NT and place-ack.\n\n" +
      `Command: nt ${joined}`
    );
  }
  if (cmd === "place-ack") {
    return (
      "place-ack marks bet(s) ConfirmedPlaced (open risk stays until settle).\n\n" +
      `Command: nt ${joined}`
    );
  }
  if (cmd === "abandon") {
    return (
      "Abandon frees open risk with P/L 0.\n\n" +
      `Command: nt ${joined}`
    );
  }
  if (cmd === "settle") {
    return (
      "Live settle writes results to the ledger.\n\n" +
      `Command: nt ${joined}`
    );
  }
  return `This command mutates tracker state:\n\nnt ${joined}\n\nContinue?`;
}

/**
 * Prompt the operator when args mutate the ledger.
 * Returns false if the user cancels (or confirm unavailable → fail closed).
 */
export function confirmLedgerMutation(args: string[]): boolean {
  if (!isLedgerMutatingNt(args)) return true;
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return false;
  }
  return window.confirm(mutationConfirmMessage(args));
}
