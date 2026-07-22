import { describe, expect, it, vi, afterEach } from "vitest";
import {
  confirmLedgerMutation,
  isLedgerMutatingNt,
  mutationConfirmMessage,
} from "./ntSafety";

describe("ledger mutation safety (PR10)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("flags live recommend, not dry-run", () => {
    expect(isLedgerMutatingNt(["recommend", "--odds", "inbox/o.txt"])).toBe(
      true
    );
    expect(
      isLedgerMutatingNt(["recommend", "--odds", "inbox/o.txt", "--dry-run"])
    ).toBe(false);
  });

  it("flags place-ack and abandon", () => {
    expect(isLedgerMutatingNt(["place-ack", "--ids", "b1"])).toBe(true);
    expect(
      isLedgerMutatingNt(["abandon", "--ids", "b1", "--reason", "not_placed"])
    ).toBe(true);
  });

  it("flags live settle; ignores draft/dry-run", () => {
    expect(isLedgerMutatingNt(["settle", "--results", "inbox/r.yaml"])).toBe(
      true
    );
    expect(isLedgerMutatingNt(["settle", "--draft"])).toBe(false);
    expect(
      isLedgerMutatingNt(["settle", "--items-json", "inbox/x.json", "--dry-run"])
    ).toBe(false);
  });

  it("does not flag read-only CLI", () => {
    expect(isLedgerMutatingNt(["status"])).toBe(false);
    expect(isLedgerMutatingNt(["refresh"])).toBe(false);
    expect(isLedgerMutatingNt(["research", "board", "--odds", "x"])).toBe(
      false
    );
  });

  it("confirmLedgerMutation prompts only for mutating argv", () => {
    const confirm = vi.fn((_msg?: string) => true);
    vi.stubGlobal("window", { confirm });

    expect(confirmLedgerMutation(["status"])).toBe(true);
    expect(confirm).not.toHaveBeenCalled();

    expect(confirmLedgerMutation(["place-ack", "--ids", "a"])).toBe(true);
    expect(confirm).toHaveBeenCalledOnce();
    const msg = confirm.mock.calls[0]?.[0] ?? "";
    expect(String(msg)).toContain("place-ack");
  });

  it("mutationConfirmMessage mentions command", () => {
    expect(mutationConfirmMessage(["recommend", "--odds", "o"])).toMatch(
      /Live recommend/i
    );
  });
});
