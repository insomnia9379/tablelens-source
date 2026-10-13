import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ActionButton,
  COLORS,
  FONT,
  HandReadout,
  NativeCapabilityCard,
  Panel,
  RecommendationCard,
  ReferenceThumbnail,
  RulesStrip,
  SectionHeader,
  SignalChip,
} from "@/components/tablelens";
import { parseRanks, type CaptureState } from "@/lib/blackjack";
import { useTableLens } from "@/hooks/use-tablelens";

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTimestamp(value: number | null | undefined): string {
  if (!value) return "NO TIMESTAMP";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function stateSourceLabel(state: CaptureState | null): string {
  if (!state) return "none";
  return state.source || "unknown";
}

function statusTone(status: string): "signal" | "muted" | "amber" | "danger" {
  if (status === "active") return "signal";
  if (status === "error") return "danger";
  if (status === "starting" || status === "paused") return "amber";
  return "muted";
}

function phaseLabel(phase: CaptureState["phase"]): string {
  return phase === "unknown" ? "UNKNOWN" : phase.toUpperCase();
}

export default function TableLensScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const {
    available,
    busy,
    nativeError,
    liveState,
    liveFresh,
    liveAdvice,
    reviewState,
    reviewInputKey,
    reviewMode,
    referenceId,
    reviewAdvice,
    reviewAdviceVisible,
    loadReference,
    clearReview,
    updateReview,
    runStrategy,
    analyzeScreenshot,
    start,
    control,
    applyCorrection,
    reviewLiveReading,
  } = useTableLens();

  const liveStatus = liveState?.captureStatus ?? "idle";
  const compact = width < 500;
  const reviewTitle = reviewMode === "reference" ? `REFERENCE / #${referenceId}` : reviewMode === "import" ? "NATIVE IMPORT" : reviewMode === "empty" ? "NO REVIEW STATE" : "MANUAL REVIEW";
  const reviewSubtitle = reviewMode === "import" ? "Native screenshot OCR result · not live capture" : reviewMode === "reference" ? "Reference example — manually transcribed, not OCR" : reviewMode === "empty" ? "No state loaded" : "Manual assumptions · not OCR";
  const liveMessage = useMemo(() => {
    if (!liveState) return "No active capture. Start a custom Android build to receive native state.";
    if (liveStatus === "active" && liveFresh) return `Native state received ${formatTimestamp(liveState.capturedAt)}`;
    if (liveStatus === "active") return "Native state is stale — waiting for a fresh event";
    return liveState.message || `Native capture ${liveStatus}`;
  }, [liveFresh, liveState, liveStatus]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 14) + 4, paddingBottom: Math.max(insets.bottom, 20) + 28 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.shell}>
          <View style={[styles.header, compact && styles.headerCompact]}>
            <View style={styles.brandCluster}>
              <View style={styles.brandMark}>
                <MaterialCommunityIcons name="target" size={27} color={COLORS.signal} />
                <View style={styles.brandMarkDot} />
              </View>
              <View style={styles.brandCopy}>
                <Text style={styles.brandTitle}>TABLELENS</Text>
                <Text style={styles.brandSubhead}>BLACKJACK / LOCAL VISION</Text>
              </View>
            </View>
            <View style={styles.headerStatus}>
              <SignalChip label="LOCAL ONLY" icon="shield-lock-outline" />
              <SignalChip label={available ? "ANDROID MODULE" : "PREVIEW"} tone={available ? "signal" : "amber"} />
            </View>
          </View>

          <View style={styles.disclosureLine}>
            <MaterialCommunityIcons name="information-outline" size={14} color={COLORS.textDim} />
            <Text style={styles.disclosureText}>Recognition stays on-device · no live credential required</Text>
          </View>

          <View style={[styles.heroRow, compact && styles.heroRowCompact]}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>OPTICAL NIGHT SCOPE / 01</Text>
              <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>Read clearly.{"\n"}Decide carefully.</Text>
              <Text style={styles.heroBody}>
                TableLens separates native capture from review examples. Unsupported or uncertain hands stay visible as unknown.
              </Text>
            </View>
            <View style={[styles.heroMetric, compact && styles.heroMetricCompact]}>
              <Text style={styles.heroMetricValue}>{liveFresh ? "LIVE" : "— —"}</Text>
              <Text style={styles.heroMetricLabel}>SIGNAL FRESHNESS</Text>
              <View style={styles.heroMeter}><View style={[styles.heroMeterFill, { width: liveFresh ? "100%" : "16%" }]} /></View>
            </View>
          </View>

          <View style={[styles.dashboardGrid, wide && styles.dashboardGridWide]}>
            <View style={[styles.column, wide && styles.primaryColumn]}>
              <SectionHeader eyebrow="DECISION SURFACE" title="Native readout" detail={liveStatus.toUpperCase()} />
              <RecommendationCard
                mode="live"
                action={liveAdvice.action}
                reason={liveState ? (liveStatus === "active" ? liveAdvice.reason : `Capture ${liveStatus}. ${liveState.message || "No live advice."}`) : "No active native capture. Reference examples never enter this live panel."}
                fresh={liveFresh}
                empty={!liveState}
              />
              <View style={styles.panelGap} />
              <Panel>
                <View style={styles.livePanelTop}>
                  <View style={styles.livePanelCopy}>
                    <Text style={styles.eyebrow}>LIVE PANEL / NATIVE STATE ONLY</Text>
                    <Text style={styles.liveMessage}>{liveMessage}</Text>
                  </View>
                  <SignalChip label={liveStatus.toUpperCase()} tone={statusTone(liveStatus)} icon="access-point" />
                </View>
                <View style={styles.liveRule} />
                <HandReadout
                  player={liveState?.player ?? []}
                  dealer={liveState?.dealer ?? null}
                  total={liveState?.total ?? null}
                  balance={liveState?.balance ?? null}
                  wager={liveState?.wager ?? null}
                  phase={liveState?.phase ?? "unknown"}
                  source={stateSourceLabel(liveState)}
                />
              </Panel>
              <View style={styles.panelGap} />
              <NativeCapabilityCard
                available={available}
                busy={busy}
                status={liveStatus}
                error={nativeError}
                onStart={start}
                onControl={control}
                onAnalyze={analyzeScreenshot}
                onReview={reviewLiveReading}
              />
            </View>

            <View style={[styles.column, wide && styles.secondaryColumn]}>
              <SectionHeader eyebrow="REVIEW SURFACE" title={reviewTitle} detail="SEPARATE FROM LIVE" />
              <Panel style={styles.reviewIntro}>
                <View style={styles.reviewIntroTop}>
                  <View style={styles.reviewIcon}><MaterialCommunityIcons name="pencil-ruler" size={19} color={COLORS.signal} /></View>
                  <View style={styles.reviewIntroCopy}>
                    <Text style={styles.reviewTitle}>Manual practice / source examples</Text>
                    <Text style={styles.reviewSub}>{reviewSubtitle}</Text>
                  </View>
                  <SignalChip label={reviewMode === "empty" ? "EMPTY" : reviewMode.toUpperCase()} tone={reviewMode === "manual" ? "amber" : reviewMode === "import" ? "signal" : "muted"} />
                </View>
                <Text style={styles.reviewBody}>
                  These controls never mutate the active native capture. Review may be manual, a supplied reference, or native screenshot OCR; each source is labeled and never enters the live panel.
                </Text>
                <View style={styles.referenceButtons}>
                  <Pressable onPress={() => loadReference("391")} style={({ pressed }) => [styles.referenceButton, referenceId === "391" && styles.referenceButtonSelected, pressed && styles.pressed]}>
                    <Text style={styles.referenceButtonNumber}>#391</Text>
                    <Text style={styles.referenceButtonDetail}>9 · K / dealer 9</Text>
                  </Pressable>
                  <Pressable onPress={() => loadReference("390")} style={({ pressed }) => [styles.referenceButton, referenceId === "390" && styles.referenceButtonSelected, pressed && styles.pressed]}>
                    <Text style={styles.referenceButtonNumber}>#390</Text>
                    <Text style={styles.referenceButtonDetail}>Betting / no hand</Text>
                  </Pressable>
                  <ActionButton label="Clear" onPress={clearReview} icon="close" compact secondary />
                </View>
                {referenceId ? <ReferenceThumbnail id={referenceId} /> : null}
              </Panel>

              <View style={styles.panelGap} />
              {reviewMode === "empty" ? (
                <Panel style={styles.emptyReview}>
                  <MaterialCommunityIcons name="form-textbox" size={22} color={COLORS.textDim} />
                  <Text style={styles.emptyReviewTitle}>No review state loaded</Text>
                  <Text style={styles.emptyReviewText}>No review state. Choose #391, #390, or enter a manual state below. Native screenshot OCR, when used, is labeled separately.</Text>
                </Panel>
              ) : null}
              <Panel style={styles.editorPanel}>
                <View style={styles.editorHeader}>
                  <View style={styles.editorCopy}>
                    <Text style={styles.eyebrow}>MANUAL ASSUMPTIONS</Text>
                    <Text style={styles.editorTitle}>Correction / state editor</Text>
                  </View>
                  <SignalChip label="MANUAL" tone="amber" icon="pencil-outline" />
                </View>
                <Text style={styles.editorHint}>Fields below are user-entered assumptions. Applying a correction locally does not claim OCR confidence.</Text>
                <ManualEditorFields key={reviewInputKey} reviewState={reviewState} updateReview={updateReview} wide={wide} />
                <Text style={styles.phaseLabel}>PHASE / MANUAL</Text>
                <View style={styles.phaseRow}>
                  {(["betting", "decision", "unknown", "complete"] as CaptureState["phase"][]).map((phase) => (
                    <Pressable key={phase} onPress={() => updateReview({ phase })} style={[styles.phaseButton, reviewState.phase === phase && styles.phaseButtonSelected]}>
                      <Text style={[styles.phaseButtonText, reviewState.phase === phase && styles.phaseButtonTextSelected]}>{phaseLabel(phase)}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.editorActions}>
                  <ActionButton label="Apply correction locally" onPress={applyCorrection} icon="check" />
                  <ActionButton label="Evaluate strategy" onPress={runStrategy} icon="compass-outline" secondary />
                </View>
              </Panel>

              {reviewMode !== "empty" && reviewAdviceVisible ? (
                <>
                  <View style={styles.panelGap} />
                  <RecommendationCard mode="review" action={reviewAdvice.action} reason={reviewAdvice.reason} />
                </>
              ) : null}
            </View>
          </View>

          <View style={styles.panelGapLarge} />
          <RulesStrip />

          <View style={styles.termsPanel}>
            <View style={styles.termsIcon}><MaterialCommunityIcons name="alert-outline" size={18} color={COLORS.amber} /></View>
            <View style={styles.termsCopy}>
              <Text style={styles.termsTitle}>TERMS / LIMITS</Text>
              <Text style={styles.termsBody}>
                Chumba Casino’s Terms & Conditions state that software-assisted participation is restricted.{' '}
                <Text
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL("https://www.chumbacasino.com/terms-and-conditions")}
                  style={styles.termsLink}
                >
                  Read the Terms & Conditions.
                </Text>{' '}
                This implementation does not establish operator permission. It provides no RNG prediction, taps or bet automation, screen bypass, or outcome guarantee.
              </Text>
            </View>
          </View>
          <Text style={styles.footerNote}>LOCAL VISION · MANUAL REVIEW CLEARLY MARKED · NO CREDENTIALS · NO PROFIT PROMISES</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType,
  wide = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "numeric" | "decimal-pad";
  wide?: boolean;
}) {
  return (
    <View style={[styles.field, wide && styles.fieldWide]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="characters"
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textDim}
        style={styles.fieldInput}
        value={value}
      />
    </View>
  );
}

function ManualEditorFields({
  reviewState,
  updateReview,
  wide,
}: {
  reviewState: CaptureState;
  updateReview: (patch: Partial<CaptureState>) => void;
  wide: boolean;
}) {
  const [playerText, setPlayerText] = useState(() => reviewState.player.join(", "));
  const [dealerText, setDealerText] = useState(() => reviewState.dealer ?? "");
  const [actionsText, setActionsText] = useState(() => reviewState.actions.join(", "));

  const updatePlayer = (value: string) => {
    setPlayerText(value);
    updateReview({ player: parseRanks(value) ?? [] });
  };

  const updateDealer = (value: string) => {
    setDealerText(value);
    const dealer = parseRanks(value);
    updateReview({ dealer: dealer?.length === 1 ? dealer[0] : null });
  };

  const updateActions = (value: string) => {
    setActionsText(value);
    const actions = value
      .split(/[\s,]+/)
      .map((action) => action.trim().toLowerCase())
      .filter(Boolean);
    updateReview({ actions });
  };

  return (
    <View style={styles.fieldGrid}>
      <Field label="PLAYER RANKS" value={playerText} placeholder="9, K" onChangeText={updatePlayer} />
      <Field label="DEALER UP" value={dealerText} placeholder="9" onChangeText={updateDealer} />
      <Field label="TOTAL" value={reviewState.total === null ? "" : String(reviewState.total)} placeholder="19" keyboardType="numeric" onChangeText={(value) => updateReview({ total: parseNumber(value) })} />
      <Field label="WAGER" value={reviewState.wager === null ? "" : String(reviewState.wager)} placeholder="0.50" keyboardType="decimal-pad" onChangeText={(value) => updateReview({ wager: parseNumber(value) })} />
      <Field label="ACTIONS / MANUAL" value={actionsText} placeholder="hit, stand" onChangeText={updateActions} wide={wide} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { flexGrow: 1 },
  shell: { width: "100%", maxWidth: 1240, alignSelf: "center", paddingHorizontal: 18 },
  header: { minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14, borderBottomWidth: 1, borderBottomColor: COLORS.lineSoft },
  headerCompact: { alignItems: "flex-start", flexDirection: "column", justifyContent: "center", paddingVertical: 12 },
  brandCluster: { flexDirection: "row", alignItems: "center", gap: 11 },
  brandMark: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: COLORS.signalDim, backgroundColor: COLORS.signalWash, alignItems: "center", justifyContent: "center" },
  brandMarkDot: { position: "absolute", width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.white },
  brandCopy: { gap: 2 },
  brandTitle: { color: COLORS.white, fontFamily: FONT.bold, fontSize: 18, letterSpacing: 2.6 },
  brandSubhead: { color: COLORS.signal, fontFamily: FONT.bold, fontSize: 9, letterSpacing: 1.2 },
  headerStatus: { flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" },
  disclosureLine: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 11 },
  disclosureText: { color: COLORS.textDim, fontFamily: FONT.regular, fontSize: 10, letterSpacing: 0.15 },
  heroRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 25, paddingTop: 27, paddingBottom: 27 },
  heroRowCompact: { alignItems: "stretch", flexDirection: "column", gap: 18 },
  heroCopy: { flex: 1, maxWidth: 650, gap: 9 },
  heroKicker: { color: COLORS.signal, fontFamily: FONT.bold, fontSize: 10, letterSpacing: 1.8 },
  heroTitle: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 31, lineHeight: 35, letterSpacing: 0.2 },
  heroTitleCompact: { fontSize: 27, lineHeight: 31 },
  heroBody: { color: COLORS.textMuted, fontFamily: FONT.regular, fontSize: 13, lineHeight: 20, maxWidth: 610 },
  heroMetric: { width: 145, gap: 5, paddingBottom: 3 },
  heroMetricCompact: { width: "100%" },
  heroMetricValue: { color: COLORS.signal, fontFamily: FONT.bold, fontSize: 25, letterSpacing: 2 },
  heroMetricLabel: { color: COLORS.textDim, fontFamily: FONT.bold, fontSize: 9, letterSpacing: 1.2 },
  heroMeter: { height: 4, backgroundColor: COLORS.panelRaised, borderRadius: 2, overflow: "hidden", marginTop: 5 },
  heroMeterFill: { height: "100%", backgroundColor: COLORS.signal, borderRadius: 2 },
  dashboardGrid: { gap: 26 },
  dashboardGridWide: { flexDirection: "row", alignItems: "flex-start" },
  column: { gap: 0 },
  primaryColumn: { flex: 1.08 },
  secondaryColumn: { flex: 0.92 },
  panelGap: { height: 12 },
  panelGapLarge: { height: 20 },
  livePanelTop: { flexDirection: "row", gap: 10, alignItems: "center" },
  livePanelCopy: { flex: 1, gap: 5 },
  liveMessage: { color: COLORS.textMuted, fontFamily: FONT.regular, fontSize: 11, lineHeight: 16 },
  liveRule: { height: 1, backgroundColor: COLORS.lineSoft, marginVertical: 14 },
  reviewIntro: { gap: 13 },
  reviewIntroTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  reviewIcon: { width: 36, height: 36, borderRadius: 9, backgroundColor: COLORS.signalWash, alignItems: "center", justifyContent: "center" },
  reviewIntroCopy: { flex: 1, gap: 3 },
  reviewTitle: { color: COLORS.text, fontFamily: FONT.medium, fontSize: 14 },
  reviewSub: { color: COLORS.amber, fontFamily: FONT.regular, fontSize: 10, lineHeight: 14 },
  reviewBody: { color: COLORS.textMuted, fontFamily: FONT.regular, fontSize: 11, lineHeight: 17 },
  referenceButtons: { flexDirection: "row", alignItems: "stretch", gap: 7, flexWrap: "wrap" },
  referenceButton: { flexGrow: 1, minWidth: 96, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, backgroundColor: COLORS.panelDeep, paddingHorizontal: 10, paddingVertical: 8, gap: 3 },
  referenceButtonSelected: { borderColor: COLORS.signal, backgroundColor: COLORS.signalWash },
  referenceButtonNumber: { color: COLORS.signal, fontFamily: FONT.bold, fontSize: 13 },
  referenceButtonDetail: { color: COLORS.textMuted, fontFamily: FONT.regular, fontSize: 9 },
  pressed: { opacity: 0.76 },
  emptyReview: { minHeight: 120, justifyContent: "center", alignItems: "center", gap: 5 },
  emptyReviewTitle: { color: COLORS.textMuted, fontFamily: FONT.medium, fontSize: 13 },
  emptyReviewText: { color: COLORS.textDim, fontFamily: FONT.regular, fontSize: 10, lineHeight: 15, textAlign: "center", maxWidth: 270 },
  editorPanel: { gap: 13 },
  editorHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  editorCopy: { flex: 1, gap: 3 },
  editorTitle: { color: COLORS.text, fontFamily: FONT.medium, fontSize: 15 },
  editorHint: { color: COLORS.textDim, fontFamily: FONT.regular, fontSize: 10, lineHeight: 15 },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  field: { minWidth: 105, flex: 1, gap: 5 },
  fieldWide: { flexBasis: "100%" },
  fieldLabel: { color: COLORS.textDim, fontFamily: FONT.bold, fontSize: 9, letterSpacing: 0.85 },
  fieldInput: { height: 39, borderRadius: 7, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panelDeep, color: COLORS.text, fontFamily: FONT.medium, fontSize: 13, paddingHorizontal: 10 },
  phaseLabel: { color: COLORS.textDim, fontFamily: FONT.bold, fontSize: 9, letterSpacing: 0.85 },
  phaseRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  phaseButton: { borderRadius: 6, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.panelDeep, paddingHorizontal: 8, paddingVertical: 7 },
  phaseButtonSelected: { borderColor: COLORS.signalDim, backgroundColor: COLORS.signalWash },
  phaseButtonText: { color: COLORS.textDim, fontFamily: FONT.bold, fontSize: 9, letterSpacing: 0.4 },
  phaseButtonTextSelected: { color: COLORS.signal },
  editorActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  termsPanel: { borderWidth: 1, borderColor: "#765B31", backgroundColor: "#241E16", borderRadius: 11, padding: 13, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  termsIcon: { width: 28, height: 28, borderRadius: 7, backgroundColor: COLORS.amberWash, alignItems: "center", justifyContent: "center" },
  termsCopy: { flex: 1, gap: 3 },
  termsTitle: { color: COLORS.amber, fontFamily: FONT.bold, fontSize: 10, letterSpacing: 1 },
  termsBody: { color: "#D4BB91", fontFamily: FONT.regular, fontSize: 11, lineHeight: 16 },
  termsLink: { color: COLORS.signal, textDecorationLine: "underline" },
  footerNote: { color: COLORS.textDim, fontFamily: FONT.bold, fontSize: 9, letterSpacing: 0.85, textAlign: "center", paddingVertical: 15 },
  eyebrow: { color: COLORS.textDim, fontFamily: FONT.bold, fontSize: 10, letterSpacing: 1.4 },
});
