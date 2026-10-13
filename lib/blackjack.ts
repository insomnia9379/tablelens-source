export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
export type Phase = "betting" | "decision" | "unknown" | "complete";
export type CaptureStatus = "idle" | "starting" | "active" | "paused" | "stopped" | "error";
export interface CaptureState {
  phase: Phase;
  player: Rank[];
  dealer: Rank | null;
  total: number | null;
  balance: number | null;
  wager: number | null;
  actions: string[];
  capturedAt: number;
  source: "capture" | "import" | "manual";
  accepted: boolean;
  message: string;
  recommendation: string | null;
  captureStatus: CaptureStatus;
  latencyMs: number | null;
}
export const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const confirmedRules = {
  dealerSoft17: "Hits — visible on table",
  blackjackPayout: "3:2 — visible on table",
  insurancePayout: "2:1 — visible on table",
} as const;
export const unknownRules = ["Deck count and shuffle method", "Dealer peek / hole-card policy", "Double restrictions", "Split and resplit rules", "Surrender availability", "Special hand / Charlie rules"];
export const emptyState: CaptureState = {
  phase: "unknown", player: [], dealer: null, total: null, balance: null, wager: null,
  actions: [], capturedAt: 0, source: "capture", accepted: false,
  message: "No game state read yet.", recommendation: null, captureStatus: "idle", latencyMs: null,
};
export function rankValue(rank: Rank): number {
  return rank === "A" ? 11 : ["J", "Q", "K"].includes(rank) ? 10 : Number(rank);
}
export function handValue(player: Rank[]): { total: number; soft: boolean } {
  let total = player.reduce((sum, rank) => sum + rankValue(rank), 0);
  let elevatedAces = player.filter(rank => rank === "A").length;
  while (total > 21 && elevatedAces > 0) { total -= 10; elevatedAces--; }
  return { total, soft: elevatedAces > 0 };
}
export function parseRanks(input: string): Rank[] | null {
  const tokens = input.toUpperCase().trim().split(/[\s,;+]+/).filter(Boolean);
  return tokens.length > 0 && tokens.every(token => ranks.includes(token as Rank)) ? tokens as Rank[] : null;
}
export function advise(state: CaptureState, now = Date.now()): { action: string | null; reason: string } {
  const no = (reason: string) => ({ action: null, reason });
  if (state.source === "capture") {
    if (state.captureStatus !== "active") return no("Capture is not active. No live recommendation.");
    const age = now - state.capturedAt;
    if (age < 0 || age > 1500) return no("Reading expired. Waiting for a fresh frame.");
  }
  if (state.phase === "betting") return no("Betting table detected. This version does not recommend a wager or start a round.");
  if (state.phase === "complete") return no("Round complete or non-actionable. No next-move recommendation.");
  if (!state.accepted) return no(state.message || "Reading is uncertain. Review the visible fields.");
  if (state.phase !== "decision") return no("Round phase is uncertain. Waiting for a player decision.");
  if (state.player.length < 2 || state.player.length > 5 || !state.player.every(r => ranks.includes(r))) return no("Incomplete or unsupported player cards. Review the hand.");
  if (!state.dealer || !ranks.includes(state.dealer)) return no("Dealer upcard is unreadable.");
  if (state.wager === null || !Number.isFinite(state.wager) || state.wager <= 0) return no("A positive, readable wager is required to validate this decision state.");
  const { total, soft } = handValue(state.player);
  if (state.total !== total) return no("Card ranks and displayed hand total disagree. Advice withheld.");
  if (total >= 21) return no("The hand is already 21 or bust; waiting for the game's next state.");
  const actions = state.actions.map(a => a.toLowerCase());
  if (!actions.includes("hit") || !actions.includes("stand")) return no("Hit and Stand controls are not both recognized. The decision state is incomplete.");
  // Pair strategy depends on rules that are not visible in these screenshots.
  if (state.player.length === 2 && rankValue(state.player[0]) === rankValue(state.player[1])) return no("Pair detected. Split rules are unknown; review manually.");
  // Only a small, rule-robust ordinary-blackjack subset is implemented. This is
  // deliberately not a full optimal strategy for an unverified rule set.
  if ((!soft && total >= 17 && total <= 20) || (soft && total === 20)) {
    if (!soft && total === 17 && state.dealer === "A") return no("Hard 17 against an Ace can depend on surrender rules. Confirm the rules first.");
    return { action: "STAND", reason: `${soft ? "Soft" : "Hard"} ${total} against dealer ${state.dealer}: stand in ordinary blackjack. This limited rule does not require an assumption about doubling or splitting. Special rules remain unverified.` };
  }
  return no("Rules incomplete for this hand. Confirm the full table rules before extending the strategy engine.");
}
export const references: { id: string; title: string; state: CaptureState }[] = [
  { id: "391", title: "Active hand · 9 + K vs 9", state: {
    ...emptyState, phase: "decision", player: ["9", "K"], dealer: "9", total: 19, balance: 50.19,
    wager: 0.5, actions: ["hit", "stand", "double"], source: "manual", accepted: true,
    message: "Reference screenshot 391 — manually transcribed, not automatic OCR.", recommendation: "STAND",
  } },
  { id: "390", title: "Empty betting table", state: {
    ...emptyState, phase: "betting", balance: 50.69, wager: 0, actions: ["play", "replay", "clear"], source: "manual",
    accepted: true, message: "Reference screenshot 390 — manually transcribed, not automatic OCR.",
  } },
];
