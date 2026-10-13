package expo.modules.tablelenscapture

/** Pure, deterministic validation layer shared by live capture and image import. */
object ObservationInterpreter {
  data class Candidate(
    val state: Map<String, Any?>,
    val fingerprint: String,
  )

  fun interpret(
    observation: OcrObservation,
    source: String,
    captureStatus: String,
    latencyMs: Long?,
    capturedAt: Long = System.currentTimeMillis(),
  ): Candidate? {
    if (!observation.layoutKnown || !observation.rulesKnown || observation.ambiguousCardEvidence) return null
    val actions = observation.actionText.map { it.uppercase().replace(Regex("[^A-Z0-9]"), "") }
    val wager = observation.wagerText?.let(NativeState::parseNumber)
    val balance = observation.balanceText?.let(NativeState::parseNumber)
    val player = observation.playerTokens
    val dealer = observation.dealerTokens
    val total = observation.totalText?.let(NativeState::integerTotal)
    val fingerprint = listOf(observation.cardFingerprint, actions.sorted().joinToString(","), total ?: "", wager ?: "").joinToString("|")

    // Betting is accepted only when no cards are present, a Play/Re-play control is readable,
    // and the wager is a concrete non-negative number (zero is allowed before a bet).
    val bettingAction = when {
      actions.any { it == "REPLAY" } -> "Replay"
      actions.any { it == "PLAY" } -> "Play"
      else -> null
    }
    if (player.isEmpty() && dealer.isEmpty() && bettingAction != null && wager != null && wager >= 0.0) {
      return Candidate(mapOf(
        "phase" to "betting", "player" to emptyList<String>(), "dealer" to null,
        "total" to null, "balance" to balance, "wager" to wager,
        "actions" to listOf(bettingAction), "capturedAt" to capturedAt, "source" to source,
        "accepted" to true, "message" to "Betting controls recognized",
        "recommendation" to null, "captureStatus" to captureStatus, "latencyMs" to latencyMs,
      ), fingerprint)
    }

    // A decision needs complete card geometry: 2–5 player ranks, one dealer up-card,
    // a likely hole-card/back, readable Hit+Stand controls, positive wager, and total cross-check.
    val decisionActions = mutableListOf<String>()
    if (actions.any { it == "HIT" }) decisionActions += "Hit"
    if (actions.any { it == "STAND" }) decisionActions += "Stand"
    val hand = HandTotals.calculate(player)
    val validDecision = observation.playerRanksComplete && observation.dealerRanksComplete && observation.singleHandLikely && player.size in 2..5 && dealer.size == 1 && observation.hiddenDealerCardLikely &&
      decisionActions.containsAll(listOf("Hit", "Stand")) && wager != null && wager > 0.0 &&
      total != null && hand != null && hand.value == total
    if (validDecision) {
      val recommendation = ConservativeStrategy.recommendation(player, dealer.single())
      return Candidate(mapOf(
        "phase" to "decision", "player" to player, "dealer" to dealer.single(),
        "total" to total, "balance" to balance, "wager" to wager,
        "actions" to decisionActions, "capturedAt" to capturedAt, "source" to source,
        "accepted" to true,
        "message" to (if (recommendation == null) ConservativeStrategy.MANUAL else "Decision layout validated"),
        "recommendation" to recommendation, "captureStatus" to captureStatus, "latencyMs" to latencyMs,
      ), fingerprint)
    }
    return null
  }
}
