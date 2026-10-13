package expo.modules.tablelenscapture

object NativeState {
  val ranks = setOf("A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K")
  const val H17_RULES = "H17"
  const val PAYOUT_RULES = "3:2"
  const val INSURANCE_RULES = "2:1"
  private val moneyPattern = Regex(
    "^\\s*(?:[$€£]\\s*)?(?:SC\\s*)?((?:[0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(?:\\.[0-9]{1,2})?)\\s*(?:SC)?\\s*$",
    RegexOption.IGNORE_CASE,
  )
  private val totalPattern = Regex("^\\s*(?:TOTAL\\s*)?([0-9]{1,2})\\s*$", RegexOption.IGNORE_CASE)

  fun unknown(
    captureStatus: String,
    source: String = "capture",
    message: String,
    capturedAt: Long = System.currentTimeMillis(),
    latencyMs: Long? = null,
  ): Map<String, Any?> = mapOf(
    "phase" to "unknown",
    "player" to emptyList<String>(),
    "dealer" to null,
    "total" to null,
    "balance" to null,
    "wager" to null,
    "actions" to emptyList<String>(),
    "capturedAt" to capturedAt,
    "source" to source,
    "accepted" to false,
    "message" to message,
    "recommendation" to null,
    "captureStatus" to captureStatus,
    "latencyMs" to latencyMs,
  )

  fun error(message: String) = unknown("error", message = message)

  fun parseNumber(text: String): Double? {
    val match = moneyPattern.matchEntire(text) ?: return null
    val value = match.groupValues[1].replace(",", "").toDoubleOrNull() ?: return null
    return value.takeIf { it.isFinite() && it >= 0.0 }
  }

  fun integerTotal(text: String): Int? {
    val value = totalPattern.matchEntire(text)?.groupValues?.getOrNull(1)?.toIntOrNull() ?: return null
    return value.takeIf { it in 4..31 }
  }
}

data class HandTotal(val value: Int, val soft: Boolean)

object HandTotals {
  fun calculate(cards: List<String>): HandTotal? {
    if (cards.isEmpty() || cards.any { it !in NativeState.ranks }) return null
    var total = 0
    var aces = 0
    cards.forEach { card ->
      when (card) {
        "A" -> { total += 11; aces++ }
        "K", "Q", "J", "10" -> total += 10
        else -> total += card.toIntOrNull() ?: return null
      }
    }
    while (total > 21 && aces > 0) {
      total -= 10
      aces--
    }
    return HandTotal(total, aces > 0)
  }
}

object ConservativeStrategy {
  const val MANUAL = "Rules incomplete — review manually"

  private fun blackjackValue(card: String) = when (card) {
    "A" -> 11
    "K", "Q", "J", "10" -> 10
    else -> card.toIntOrNull() ?: -1
  }

  fun recommendation(cards: List<String>, dealer: String?): String? {
    val total = HandTotals.calculate(cards) ?: return null
    if (cards.size < 2 || cards.size > 5 || dealer !in NativeState.ranks) return null
    // Equal blackjack-value pairs (including K/Q, Q/J, etc.) are suppressed with the TS safe subset.
    if (cards.size == 2 && blackjackValue(cards[0]) == blackjackValue(cards[1])) return null
    if (total.soft && total.value == 20) return "Stand"
    if (!total.soft && total.value in 18..20) return "Stand"
    if (!total.soft && total.value == 17 && dealer != "A") return "Stand"
    return null
  }
}
