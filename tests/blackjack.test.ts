import { describe, expect, it } from "vitest";
import { advise, emptyState, handValue, parseRanks, references, type CaptureState } from "../lib/blackjack";
const decision = (patch: Partial<CaptureState> = {}): CaptureState => ({ ...references[0].state, ...patch });
describe("reference screenshot facts and conservative strategy", () => {
  it("stands with 9 + K against 9", () => expect(advise(decision()).action).toBe("STAND"));
  it("does not infer outcomes or stakes at the empty table", () => expect(advise(references[1].state).action).toBeNull());
  it("does not infer win or net profit from balances", () => { expect(references[1].state.phase).toBe("betting"); expect(references[1].state.recommendation).toBeNull(); });
  it("withholds on unaccepted OCR", () => expect(advise(decision({ accepted: false })).action).toBeNull());
  it("withholds on inconsistent totals", () => expect(advise(decision({ total: 18 })).action).toBeNull());
  it("requires both decision controls", () => expect(advise(decision({ actions: ["stand"] })).action).toBeNull());
  it("does not assume missing wager", () => expect(advise(decision({ wager: null })).action).toBeNull());
  it("rejects zero, NaN and negative wager", () => { for (const wager of [0, -1, NaN]) expect(advise(decision({ wager })).action).toBeNull(); });
  it("withholds pairs with unknown split rules", () => expect(advise(decision({ player: ["9", "9"], total: 18 })).action).toBeNull());
  it("withholds hard17 vs ace with unknown surrender", () => expect(advise(decision({ player: ["10", "7"], total: 17, dealer: "A" })).action).toBeNull());
  it("withholds low/soft totals needing fuller rules", () => { for (const player of [["10","6"],["A","7"],["A","8"]] as CaptureState["player"][]) expect(advise(decision({ player, total: handValue(player).total })).action).toBeNull(); });
  it("recognizes soft20 stand without pair", () => expect(advise(decision({ player: ["A", "9"], total: 20 })).action).toBe("STAND"));
  it("does not advise 21 or bust", () => { for (const player of [["A","K"],["K","Q","2"]] as CaptureState["player"][]) expect(advise(decision({ player, total: handValue(player).total })).action).toBeNull(); });
  it("expires live frames", () => expect(advise(decision({ source: "capture", captureStatus: "active", capturedAt: 1000 }), 2501).action).toBeNull());
  it("rejects future timestamps", () => expect(advise(decision({ source: "capture", captureStatus: "active", capturedAt: 3000 }), 2500).action).toBeNull());
  it("accepts a fresh live state", () => expect(advise(decision({ source: "capture", captureStatus: "active", capturedAt: 1000 }), 1200).action).toBe("STAND"));
  it("does not advise paused/idle/stopped frames", () => { for (const captureStatus of ["idle", "paused", "stopped", "error"] as const) expect(advise(decision({ source: "capture", captureStatus, capturedAt: 1000 }), 1100).action).toBeNull(); });
  it("does not invent dealer information", () => expect(advise(decision({ dealer: null })).action).toBeNull());
  it("empty state contains no example hand", () => expect(emptyState.player).toEqual([]));
});
describe("rank parsing", () => {
  it("allows commas, spaces and plus", () => expect(parseRanks("9 + k")).toEqual(["9", "K"]));
  it("rejects confusable OCR instead of fixing it", () => { expect(parseRanks("O K")).toBeNull(); expect(parseRanks("1O K")).toBeNull(); expect(parseRanks("")).toBeNull(); });
  it("correctly adjusts aces", () => { expect(handValue(["A","A","9"])).toEqual({ total: 21, soft: true }); expect(handValue(["A","9","K"])).toEqual({ total: 20, soft: false }); });
});
