package expo.modules.tablelenscapture

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class RecognitionRulesTest {
  @Test fun parsesOnlySupportedRanksAndRejectsConfusables() {
    assertEquals(listOf("9", "K", "A"), RankParser.fromTokens(listOf("9", "K", "A")))
    assertEquals(emptyList<String>(), RankParser.fromTokens(listOf("19", "blackjack", "?")))
    assertNull(RankParser.normalize("Ｏ"))
    assertNull(RankParser.normalize("１0"))
    assertNull(RankParser.normalize("K\u0000"))
  }

  @Test fun totalsAcesConservatively() {
    assertEquals(HandTotal(20, true), HandTotals.calculate(listOf("A", "9")))
    assertEquals(HandTotal(17, false), HandTotals.calculate(listOf("A", "6", "K")))
    assertNull(HandTotals.calculate(listOf("X", "9")))
  }

  @Test fun onlySafeSubsetRecommendsStandAndLeavesOtherHandsNull() {
    assertEquals("Stand", ConservativeStrategy.recommendation(listOf("10", "8"), "6"))
    assertEquals("Stand", ConservativeStrategy.recommendation(listOf("10", "7"), "K"))
    assertNull(ConservativeStrategy.recommendation(listOf("10", "7"), "A"))
    assertNull(ConservativeStrategy.recommendation(listOf("8", "8"), "6"))
    assertNull(ConservativeStrategy.recommendation(listOf("10", "6"), "6"))
  }

  @Test fun numericGrammarIsStrictButAcceptsSplitCurrencySuffix() {
    assertEquals(.5, NativeState.parseNumber("0.5 SC")!!, .0001)
    assertEquals(1234.5, NativeState.parseNumber("$1,234.50")!!, .0001)
    assertNull(NativeState.parseNumber("１"))
    assertNull(NativeState.parseNumber("$1,23"))
    assertNull(NativeState.parseNumber("0.500"))
    assertNull(NativeState.parseNumber("NaN"))
    assertEquals(19, NativeState.integerTotal("TOTAL 19"))
    assertNull(NativeState.integerTotal("TOTAL 3"))
    assertNull(NativeState.integerTotal("19.0"))
  }

  @Test fun screenshotDecisionGeometryRequiresRulesAndCrossChecksTotal() {
    val observation = ObservationParser.parse(
      listOf(
        r("DEALER", .10f, .90f), r("HITS", .20f, .90f), r("ON", .27f, .90f), r("SOFT17", .38f, .90f),
        r("BLACKJACK", .10f, .94f), r("AWARDS", .28f, .94f), r("3TO2", .42f, .94f),
        r("INSURANCE", .62f, .94f), r("AWARDS", .79f, .94f), r("2TO1", .92f, .94f),
        r("K", .488f, .620f), r("9", .505f, .620f), r("9", .489f, .281f),
        r("19", .485f, .736f), r("0.5 SC", .509f, .549f), r("100", .40f, .11f),
        r("HIT", .20f, .86f), r("STAND", .30f, .86f),
      ),
      layoutKnown = true,
      hiddenDealerCardLikely = true,
    )
    assertEquals(true, observation.rulesKnown)
    assertEquals(listOf("K", "9"), observation.playerTokens)
    assertEquals(listOf("9"), observation.dealerTokens)
    assertEquals("19", observation.totalText)
    assertEquals("0.5 SC", observation.wagerText)
    val candidate = ObservationInterpreter.interpret(observation, "capture", "active", 20L, 1000L)
    assertNotNull(candidate)
    assertEquals("decision", candidate!!.state["phase"])
    assertEquals(19, candidate.state["total"])
  }

  @Test fun bettingGeometryCanBeAcceptedWithoutCardEvidence() {
    val observation = ObservationParser.parse(
      listOf(
        r("DEALER", .10f, .90f), r("HITS", .20f, .90f), r("ON", .27f, .90f), r("SOFT17", .38f, .90f),
        r("BLACKJACK", .10f, .94f), r("AWARDS", .28f, .94f), r("3TO2", .42f, .94f),
        r("INSURANCE", .62f, .94f), r("AWARDS", .79f, .94f), r("2TO1", .92f, .94f),
        r("0.5 SC", .509f, .549f), r("PLAY", .25f, .86f),
      ),
      layoutKnown = true,
      hiddenDealerCardLikely = false,
    )
    val candidate = ObservationInterpreter.interpret(observation, "capture", "active", 20L, 1000L)
    assertNotNull(candidate)
    assertEquals("betting", candidate!!.state["phase"])
  }

  @Test fun overlappingConflictingGlyphsAreNotAccepted() {
    val observation = ObservationParser.parse(
      listOf(
        r("HITS ON SOFT17", .20f, .90f), r("BLACKJACK AWARDS 3TO2", .30f, .94f), r("INSURANCE AWARDS 2TO1", .70f, .94f),
        RegionText("K", .475f, .605f, .505f, .635f), RegionText("Q", .476f, .606f, .506f, .636f),
        r("9", .49f, .281f), r("19", .485f, .736f), r("0.5", .509f, .549f),
        r("HIT", .20f, .86f), r("STAND", .30f, .86f),
      ), true, true,
    )
    assertEquals(true, observation.ambiguousCardEvidence)
    assertNull(ObservationInterpreter.interpret(observation, "capture", "active", 20L, 1000L))
  }

  private fun r(text: String, centerX: Float, centerY: Float) =
    RegionText(text, centerX - .01f, centerY - .01f, centerX + .01f, centerY + .01f)
}
