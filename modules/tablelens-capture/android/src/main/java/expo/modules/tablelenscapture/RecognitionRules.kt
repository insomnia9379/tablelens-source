package expo.modules.tablelenscapture

object RankParser {
  private val rankPattern = Regex("^(A|[2-9]|10|J|Q|K)$")

  fun normalize(raw: String): String? {
    // Deliberately accept only ASCII card glyphs; Unicode lookalikes are not safe OCR evidence.
    val token = raw.trim().uppercase()
    return token.takeIf { rankPattern.matches(it) && it in NativeState.ranks }
  }

  fun fromTokens(tokens: List<String>): List<String> = tokens.mapNotNull(::normalize)
}

data class RegionText(
  val text: String,
  val left: Float,
  val top: Float,
  val right: Float,
  val bottom: Float,
) {
  val centerX: Float get() = (left + right) / 2f
  val centerY: Float get() = (top + bottom) / 2f
}

data class OcrObservation(
  val all: List<RegionText>,
  val layoutKnown: Boolean,
  val hiddenDealerCardLikely: Boolean,
  val rulesKnown: Boolean,
  val singleHandLikely: Boolean,
  val playerRanksComplete: Boolean,
  val playerTokens: List<String>,
  val dealerTokens: List<String>,
  val totalText: String?,
  val balanceText: String?,
  val wagerText: String?,
  val actionText: List<String>,
  val cardFingerprint: String,
  val ambiguousCardEvidence: Boolean = false,
  val dealerRanksComplete: Boolean = true,
)

object ObservationParser {
  private const val PLAYER_LEFT = .40f
  private const val PLAYER_TOP = .59f
  private const val PLAYER_RIGHT = .65f
  private const val PLAYER_BOTTOM = .68f
  private const val DEALER_LEFT = .44f
  private const val DEALER_TOP = .24f
  private const val DEALER_RIGHT = .53f
  private const val DEALER_BOTTOM = .32f
  private const val TOTAL_LEFT = .43f
  private const val TOTAL_TOP = .70f
  private const val TOTAL_RIGHT = .53f
  private const val TOTAL_BOTTOM = .78f
  private const val WAGER_LEFT = .45f
  private const val WAGER_TOP = .52f
  private const val WAGER_RIGHT = .58f
  private const val WAGER_BOTTOM = .58f
  private const val BALANCE_LEFT = .35f
  private const val BALANCE_TOP = .08f
  private const val BALANCE_RIGHT = .46f
  private const val BALANCE_BOTTOM = .15f

  private fun inBox(item: RegionText, l: Float, t: Float, r: Float, b: Float) =
    item.centerX in l..r && item.centerY in t..b

  private fun textBlob(values: List<RegionText>) = values.joinToString(" ") { it.text.uppercase() }

  private fun compact(text: String) = text.uppercase().replace(Regex("[^A-Z0-9]"), "")

  private fun ratioPresent(line: String, numerator: Int, denominator: Int): Boolean {
    val compactLine = compact(line)
    return compactLine.contains("${numerator}TO$denominator") ||
      Regex("$numerator\\s*:\\s*$denominator").containsMatchIn(line)
  }

  private fun ruleLines(values: List<RegionText>): List<String> {
    val groups = mutableListOf<MutableList<RegionText>>()
    values.sortedWith(compareBy<RegionText> { it.centerY }.thenBy { it.left }).forEach { item ->
      val group = groups.lastOrNull()
      if (group == null || kotlin.math.abs(group.map { it.centerY }.average().toFloat() - item.centerY) > .035f) {
        groups += mutableListOf(item)
      } else group += item
    }
    return groups.map { group -> textBlob(group.sortedBy { it.left }) }
  }

  private fun intersectionRatio(a: RegionText, b: RegionText): Float {
    val width = (minOf(a.right, b.right) - maxOf(a.left, b.left)).coerceAtLeast(0f)
    val height = (minOf(a.bottom, b.bottom) - maxOf(a.top, b.top)).coerceAtLeast(0f)
    val intersection = width * height
    val areaA = ((a.right - a.left) * (a.bottom - a.top)).coerceAtLeast(.0001f)
    val areaB = ((b.right - b.left) * (b.bottom - b.top)).coerceAtLeast(.0001f)
    return intersection / minOf(areaA, areaB)
  }

  private fun collapseSameText(values: List<RegionText>): List<RegionText> {
    val result = mutableListOf<RegionText>()
    values.sortedBy { it.left }.forEach { item ->
      val normalized = item.text.trim().uppercase()
      if (result.none { it.text.trim().uppercase() == normalized && intersectionRatio(it, item) >= .35f }) {
        result += item
      }
    }
    return result
  }

  private fun hasConflictingText(values: List<RegionText>, normalizer: (String) -> Any?): Boolean {
    val candidates = values.filter { normalizer(it.text) != null }
    return candidates.indices.any { i ->
      (i + 1 until candidates.size).any { j ->
        normalizer(candidates[i].text) != normalizer(candidates[j].text) &&
          intersectionRatio(candidates[i], candidates[j]) >= .35f
      }
    }
  }

  private fun moneyText(values: List<RegionText>): String? {
    val ordered = values.sortedBy { it.left }.map { it.text }
    if (ordered.isEmpty()) return null
    val joined = ordered.joinToString(" ")
    return if (NativeState.parseNumber(joined) != null) joined
    else ordered.firstOrNull { NativeState.parseNumber(it) != null }
  }

  fun parse(
    all: List<RegionText>,
    layoutKnown: Boolean,
    hiddenDealerCardLikely: Boolean,
  ): OcrObservation {
    val playerEvidence = all.filter { inBox(it, PLAYER_LEFT, PLAYER_TOP, PLAYER_RIGHT, PLAYER_BOTTOM) }
    val dealerEvidence = all.filter { inBox(it, DEALER_LEFT, DEALER_TOP, DEALER_RIGHT, DEALER_BOTTOM) }
    val totals = all.filter { inBox(it, TOTAL_LEFT, TOTAL_TOP, TOTAL_RIGHT, TOTAL_BOTTOM) }
    val balance = all.filter { inBox(it, BALANCE_LEFT, BALANCE_TOP, BALANCE_RIGHT, BALANCE_BOTTOM) }
    val wager = all.filter { inBox(it, WAGER_LEFT, WAGER_TOP, WAGER_RIGHT, WAGER_BOTTOM) }
    val controls = all.filter { inBox(it, .08f, .65f, .94f, .98f) }

    val lines = ruleLines(all)
    val rulesKnown = lines.any { line -> compact(line).contains("HITSONSOFT17") } &&
      lines.any { line -> compact(line).contains("BLACKJACK") && ratioPresent(line, 3, 2) } &&
      lines.any { line -> compact(line).contains("INSURANCE") && ratioPresent(line, 2, 1) }

    val playerConflict = hasConflictingText(playerEvidence, RankParser::normalize)
    val dealerConflict = hasConflictingText(dealerEvidence, RankParser::normalize)
    val totalConflict = hasConflictingText(totals, NativeState::integerTotal)
    val wagerConflict = hasConflictingText(wager, NativeState::parseNumber)
    val ambiguous = playerConflict || dealerConflict || totalConflict || wagerConflict

    val playerRankRegions = collapseSameText(playerEvidence)
    val dealerRankRegions = collapseSameText(dealerEvidence)
    val playerRanksComplete = playerRankRegions.all { RankParser.normalize(it.text) != null } && !playerConflict
    val dealerRanksComplete = dealerRankRegions.all { RankParser.normalize(it.text) != null } && !dealerConflict
    val playerRanks = RankParser.fromTokens(playerRankRegions.map { it.text })
    val dealerRanks = RankParser.fromTokens(dealerRankRegions.map { it.text })
    val playerY = playerRankRegions.map { it.centerY }
    val playerX = playerRankRegions.map { it.centerX }.sorted()
    val widestGap = playerX.zipWithNext().maxOfOrNull { it.second - it.first } ?: 0f
    val singleHandLikely = playerRanks.isEmpty() ||
      (playerRanks.size <= 5 && playerY.maxOrNull()!! - playerY.minOrNull()!! < .14f && widestGap < .16f)

    // Tight regions avoid treating total/wager glyphs as cards. Joining split OCR tokens permits
    // a wager rendered as "0.5" + "SC" while NativeState keeps the numeric grammar strict.
    val totalText = totals.sortedBy { it.top }.firstOrNull()?.text
    val balanceText = moneyText(balance)
    val wagerText = moneyText(wager)
    val fingerprint = (playerRanks + dealerRanks + (totalText ?: "") + (wagerText ?: "")).joinToString("|")
    return OcrObservation(
      all = all,
      layoutKnown = layoutKnown,
      hiddenDealerCardLikely = hiddenDealerCardLikely,
      rulesKnown = rulesKnown,
      singleHandLikely = singleHandLikely,
      playerRanksComplete = playerRanksComplete,
      playerTokens = playerRanks,
      dealerTokens = dealerRanks,
      totalText = totalText,
      balanceText = balanceText,
      wagerText = wagerText,
      actionText = controls.map { it.text },
      cardFingerprint = fingerprint,
      ambiguousCardEvidence = ambiguous,
      dealerRanksComplete = dealerRanksComplete,
    )
  }
}
