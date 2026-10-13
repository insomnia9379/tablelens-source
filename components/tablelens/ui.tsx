import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

export const COLORS = {
  bg: "#071A24",
  panel: "#0B2430",
  panelRaised: "#0F2C38",
  panelDeep: "#06151D",
  line: "#1C4650",
  lineSoft: "#123844",
  signal: "#35D0BA",
  signalDim: "#1B776E",
  signalWash: "#103F42",
  text: "#D7F0EA",
  textMuted: "#8EAEB0",
  textDim: "#5B8187",
  amber: "#F0B35B",
  amberWash: "#493620",
  danger: "#F18479",
  dangerWash: "#462B31",
  white: "#F5FFFC",
};

export const FONT = {
  regular: "Plex",
  medium: "PlexMedium",
  bold: "PlexBold",
};

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

export function SignalChip({
  label,
  tone = "signal",
  icon,
}: {
  label: string;
  tone?: "signal" | "muted" | "amber" | "danger";
  icon?: IconName;
}) {
  const toneStyle =
    tone === "signal"
      ? styles.chipSignal
      : tone === "amber"
        ? styles.chipAmber
        : tone === "danger"
          ? styles.chipDanger
          : styles.chipMuted;
  const textStyle =
    tone === "signal"
      ? styles.chipSignalText
      : tone === "amber"
        ? styles.chipAmberText
        : tone === "danger"
          ? styles.chipDangerText
          : styles.chipMutedText;
  return (
    <View style={[styles.chip, toneStyle]}>
      {icon ? <MaterialCommunityIcons name={icon} size={13} color={textStyle.color} /> : null}
      <Text style={[styles.chipText, textStyle]}>{label}</Text>
    </View>
  );
}

export function Panel({
  children,
  style,
  accent = false,
}: {
  children: ReactNode;
  style?: object;
  accent?: boolean;
}) {
  return <View style={[styles.panel, accent && styles.panelAccent, style]}>{children}</View>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function SectionHeader({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionRule} />
      <View style={styles.sectionCopy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  icon,
  disabled = false,
  secondary = false,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  secondary?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        compact && styles.actionButtonCompact,
        secondary ? styles.actionSecondary : styles.actionPrimary,
        disabled && styles.actionDisabled,
        pressed && !disabled && styles.actionPressed,
      ]}
    >
      {icon ? (
        <MaterialCommunityIcons
          name={icon}
          size={compact ? 15 : 17}
          color={disabled ? COLORS.textDim : secondary ? COLORS.signal : COLORS.bg}
        />
      ) : null}
      <Text
        style={[
          styles.actionText,
          secondary ? styles.actionTextSecondary : styles.actionTextPrimary,
          disabled && styles.actionTextDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Readout({
  label,
  value,
  detail,
  emphasis = false,
}: {
  label: string;
  value: string;
  detail?: string;
  emphasis?: boolean;
}) {
  return (
    <View style={styles.readout}>
      <Text style={styles.readoutLabel}>{label}</Text>
      <Text style={[styles.readoutValue, emphasis && styles.readoutValueEmphasis]} numberOfLines={1}>
        {value}
      </Text>
      {detail ? <Text style={styles.readoutDetail}>{detail}</Text> : null}
    </View>
  );
}

export function RecommendationCard({
  action,
  reason,
  mode,
  fresh = false,
  empty = false,
}: {
  action: string | null;
  reason: string;
  mode: "live" | "review";
  fresh?: boolean;
  empty?: boolean;
}) {
  const actionable = Boolean(action) && !empty && (mode === "review" || fresh);
  const headline = empty ? "NO ACTIVE SIGNAL" : actionable ? action!.toUpperCase() : "WAIT / VERIFY";
  const accent = empty ? COLORS.textDim : actionable ? COLORS.signal : COLORS.amber;
  return (
    <Panel style={styles.recommendationPanel} accent={actionable}>
      <View style={styles.recommendationTop}>
        <View style={[styles.targetMark, { borderColor: accent }]}>
          <View style={[styles.targetDot, { backgroundColor: accent }]} />
          <View style={[styles.targetCrosshair, { borderColor: accent }]} />
        </View>
        <View style={styles.recommendationTitleWrap}>
          <Text style={styles.eyebrow}>{mode === "live" ? "NATIVE DECISION" : "STRATEGY LENS"}</Text>
          <Text style={[styles.recommendationHeadline, { color: accent }]}>{headline}</Text>
        </View>
        <SignalChip
          label={mode === "live" ? (fresh ? "FRESH < 1.5S" : "STALE") : "REVIEW"}
          tone={mode === "live" ? (fresh ? "signal" : "amber") : "muted"}
          icon={mode === "live" ? "pulse" : "file-document-outline"}
        />
      </View>
      <View style={styles.recommendationRule} />
      <Text style={styles.recommendationReason}>{reason}</Text>
      <Text style={styles.recommendationFootnote}>
        {mode === "live"
          ? "Conservative subset only · no advice when the hand is unsupported or stale"
          : "Manual/reference evaluation · not a live instruction"}
      </Text>
    </Panel>
  );
}

export function CardGlyph({ rank, muted = false }: { rank: string | null; muted?: boolean }) {
  return (
    <View style={[styles.cardGlyph, muted && styles.cardGlyphMuted]}>
      <Text style={[styles.cardRank, muted && styles.cardRankMuted]}>{rank || "—"}</Text>
      <View style={[styles.cardCorner, muted && styles.cardCornerMuted]} />
    </View>
  );
}

export function HandReadout({
  player,
  dealer,
  total,
  balance,
  wager,
  phase,
  source,
}: {
  player: string[];
  dealer: string | null;
  total: number | null;
  balance: number | null;
  wager: number | null;
  phase: string;
  source: string;
}) {
  return (
    <Panel>
      <View style={styles.handHeader}>
        <View>
          <Text style={styles.eyebrow}>RECOGNIZED HAND</Text>
          <Text style={styles.handTitle}>{player.length ? player.join("  ·  ") : "No player cards"}</Text>
        </View>
        <SignalChip label={source.toUpperCase()} tone={source === "capture" ? "signal" : "muted"} />
      </View>
      <View style={styles.cardsRow}>
        <View style={styles.cardGroup}>
          <Text style={styles.cardLabel}>PLAYER</Text>
          <View style={styles.cardStack}>
            {player.length ? player.map((rank, index) => <CardGlyph key={`${rank}-${index}`} rank={rank} />) : <CardGlyph rank={null} muted />}
          </View>
        </View>
        <View style={styles.cardGroup}>
          <Text style={styles.cardLabel}>DEALER UP</Text>
          <View style={styles.cardStack}>
            <CardGlyph rank={dealer} muted={!dealer} />
          </View>
        </View>
      </View>
      <View style={styles.readoutGrid}>
        <Readout label="TOTAL" value={total === null ? "—" : String(total)} emphasis />
        <Readout label="SC BALANCE" value={balance === null ? "—" : balance.toFixed(2)} detail="local readout" />
        <Readout label="WAGER" value={wager === null ? "—" : wager.toFixed(2)} />
        <Readout label="PHASE" value={phase.toUpperCase()} />
      </View>
    </Panel>
  );
}

export function ReferenceThumbnail({ id }: { id: "390" | "391" }) {
  return (
    <View style={styles.thumbnailWrap}>
      <Image
        accessibilityLabel={`Supplied reference screenshot ${id}`}
        source={id === "391" ? require("../../assets/reference/391.png") : require("../../assets/reference/390.png")}
        style={styles.thumbnail}
      />
      <View style={styles.thumbnailOverlay}>
        <Text style={styles.thumbnailText}>SUPPLIED / {id}</Text>
      </View>
    </View>
  );
}

export function RulesStrip() {
  return (
    <Panel style={styles.rulesPanel}>
      <View style={styles.rulesHeading}>
        <MaterialCommunityIcons name="shield-check-outline" size={18} color={COLORS.signal} />
        <Text style={styles.rulesTitle}>RULES PROFILE</Text>
        <SignalChip label="PARTIAL" tone="amber" />
      </View>
      <View style={styles.rulesGrid}>
        <View style={styles.ruleItem}>
          <Text style={styles.ruleValue}>H17</Text>
          <Text style={styles.ruleLabel}>DEALER HITS SOFT 17</Text>
          <Text style={styles.ruleStatus}>CONFIRMED</Text>
        </View>
        <View style={styles.ruleItem}>
          <Text style={styles.ruleValue}>3:2</Text>
          <Text style={styles.ruleLabel}>BLACKJACK PAYOUT</Text>
          <Text style={styles.ruleStatus}>CONFIRMED</Text>
        </View>
        <View style={styles.ruleItem}>
          <Text style={styles.ruleValue}>2:1</Text>
          <Text style={styles.ruleLabel}>INSURANCE PAYOUT</Text>
          <Text style={styles.ruleStatus}>CONFIRMED</Text>
        </View>
      </View>
      <Text style={styles.rulesUnknown}>Other table rules unknown · conservative subset only</Text>
    </Panel>
  );
}

export function NativeCapabilityCard({
  available,
  busy,
  status,
  error,
  onStart,
  onControl,
  onAnalyze,
  onReview,
}: {
  available: boolean;
  busy: string | null;
  status: string;
  error: string | null;
  onStart: () => void;
  onControl: (command: "pause" | "resume" | "stop") => void;
  onAnalyze: () => void;
  onReview: () => void;
}) {
  const paused = status === "paused";
  const capturing = available && (status === "active" || paused);
  return (
    <Panel style={styles.capabilityPanel}>
      <View style={styles.capabilityHeader}>
        <View style={styles.capabilityIcon}>
          <MaterialCommunityIcons name="android" size={21} color={COLORS.signal} />
        </View>
        <View style={styles.capabilityCopy}>
          <Text style={styles.eyebrow}>NATIVE CAPABILITY</Text>
          <Text style={styles.capabilityTitle}>Local screen recognizer</Text>
        </View>
        <SignalChip label={available ? "MODULE READY" : "UNAVAILABLE"} tone={available ? "signal" : "amber"} />
      </View>
      <Text style={styles.capabilityBody}>
        {available
          ? "The Android module owns capture and emits plain state. No camera upload or cloud credential is required."
          : "Preview and Expo Go cannot provide live capture or screenshot analysis. The recognizer is local to a custom Android build."}
      </Text>
      {!available ? (
        <View style={styles.buildNotice}>
          <MaterialCommunityIcons name="hammer-wrench" size={18} color={COLORS.amber} />
          <View style={styles.buildNoticeCopy}>
            <Text style={styles.buildNoticeTitle}>ANDROID BUILD REQUIRED</Text>
            <Text style={styles.buildNoticeText}>No fake live state is shown in this environment.</Text>
          </View>
        </View>
      ) : null}
      {available && !capturing ? (
        <ActionButton
          label={busy === "start" ? "Starting…" : "Start capture"}
          onPress={onStart}
          icon="record-circle-outline"
          disabled={Boolean(busy)}
        />
      ) : null}
      {available ? (
        <ActionButton
          label={busy === "analyze" ? "Analyzing…" : "Analyze screenshot"}
          onPress={onAnalyze}
          icon="image-search-outline"
          secondary
          disabled={Boolean(busy)}
        />
      ) : null}
      {available ? (
        <ActionButton
          label={busy === "review-live" ? "Opening…" : "Review live reading"}
          onPress={onReview}
          icon="eye-outline"
          secondary
          disabled={Boolean(busy)}
        />
      ) : null}
      {capturing ? (
        <View style={styles.controlRow}>
          <ActionButton
            label={paused ? "Resume" : "Pause"}
            onPress={() => onControl(paused ? "resume" : "pause")}
            icon={paused ? "play" : "pause"}
            compact
            secondary
            disabled={Boolean(busy)}
          />
          <ActionButton
            label="Stop"
            onPress={() => onControl("stop")}
            icon="stop"
            compact
            secondary
            disabled={Boolean(busy)}
          />
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={16} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </Panel>
  );
}

export const styles = StyleSheet.create({
  panel: {
    backgroundColor: COLORS.panel,
    borderColor: COLORS.lineSoft,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  panelAccent: {
    borderColor: COLORS.signalDim,
    shadowColor: COLORS.signal,
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  chip: {
    minHeight: 24,
    borderRadius: 6,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
  },
  chipText: { fontFamily: FONT.bold, fontSize: 10, letterSpacing: 0.7 },
  chipSignal: { backgroundColor: COLORS.signalWash },
  chipSignalText: { color: COLORS.signal },
  chipMuted: { backgroundColor: COLORS.panelRaised },
  chipMutedText: { color: COLORS.textMuted },
  chipAmber: { backgroundColor: COLORS.amberWash },
  chipAmberText: { color: COLORS.amber },
  chipDanger: { backgroundColor: COLORS.dangerWash },
  chipDangerText: { color: COLORS.danger },
  eyebrow: { color: COLORS.textDim, fontFamily: FONT.bold, fontSize: 10, letterSpacing: 1.4 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  sectionRule: { width: 3, height: 34, backgroundColor: COLORS.signal, borderRadius: 2 },
  sectionCopy: { flex: 1, gap: 2 },
  sectionTitle: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 16, letterSpacing: 0.2 },
  sectionDetail: { color: COLORS.textDim, fontFamily: FONT.medium, fontSize: 11 },
  actionButton: {
    backgroundColor: COLORS.signal,
    minHeight: 44,
    borderRadius: 9,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionButtonCompact: { minHeight: 36, paddingHorizontal: 11 },
  actionPrimary: { backgroundColor: COLORS.signal },
  actionSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.signalDim },
  actionDisabled: { backgroundColor: COLORS.panelRaised, borderColor: COLORS.lineSoft },
  actionPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  actionText: { fontFamily: FONT.bold, fontSize: 12, letterSpacing: 0.4 },
  actionTextPrimary: { color: COLORS.bg },
  actionTextSecondary: { color: COLORS.signal },
  actionTextDisabled: { color: COLORS.textDim },
  readout: { flex: 1, minWidth: 70, gap: 3 },
  readoutLabel: { color: COLORS.textDim, fontFamily: FONT.bold, fontSize: 9, letterSpacing: 1.1 },
  readoutValue: { color: COLORS.text, fontFamily: FONT.medium, fontSize: 14, letterSpacing: 0.3 },
  readoutValueEmphasis: { color: COLORS.signal, fontFamily: FONT.bold, fontSize: 20 },
  readoutDetail: { color: COLORS.textDim, fontFamily: FONT.regular, fontSize: 9 },
  recommendationPanel: { padding: 18 },
  recommendationTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  targetMark: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  targetCrosshair: { position: "absolute", width: 20, height: 20, borderRadius: 10, borderWidth: 1 },
  targetDot: { width: 6, height: 6, borderRadius: 3, zIndex: 2 },
  recommendationTitleWrap: { flex: 1, gap: 3 },
  recommendationHeadline: { fontFamily: FONT.bold, fontSize: 23, letterSpacing: 0.7 },
  recommendationRule: { height: 1, backgroundColor: COLORS.lineSoft, marginVertical: 16 },
  recommendationReason: { color: COLORS.text, fontFamily: FONT.regular, fontSize: 14, lineHeight: 21 },
  recommendationFootnote: { color: COLORS.textDim, fontFamily: FONT.regular, fontSize: 10, lineHeight: 15, marginTop: 13 },
  handHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 16 },
  handTitle: { color: COLORS.text, fontFamily: FONT.medium, fontSize: 16, marginTop: 5 },
  cardsRow: { flexDirection: "row", gap: 28, marginBottom: 18 },
  cardGroup: { gap: 7 },
  cardLabel: { color: COLORS.textDim, fontFamily: FONT.bold, fontSize: 9, letterSpacing: 1.1 },
  cardStack: { flexDirection: "row", gap: 7 },
  cardGlyph: { width: 42, height: 54, borderRadius: 6, backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  cardGlyphMuted: { backgroundColor: COLORS.panelRaised, borderWidth: 1, borderColor: COLORS.line },
  cardRank: { color: COLORS.bg, fontFamily: FONT.bold, fontSize: 18 },
  cardRankMuted: { color: COLORS.textDim },
  cardCorner: { position: "absolute", width: 10, height: 10, borderTopWidth: 2, borderRightWidth: 2, borderColor: COLORS.signal, top: 5, right: 5 },
  cardCornerMuted: { borderColor: COLORS.textDim },
  readoutGrid: { flexDirection: "row", flexWrap: "wrap", gap: 15, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.lineSoft },
  capabilityPanel: { gap: 14 },
  capabilityHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  capabilityIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.signalWash, alignItems: "center", justifyContent: "center" },
  capabilityCopy: { flex: 1, gap: 3 },
  capabilityTitle: { color: COLORS.text, fontFamily: FONT.medium, fontSize: 15 },
  capabilityBody: { color: COLORS.textMuted, fontFamily: FONT.regular, fontSize: 12, lineHeight: 18 },
  buildNotice: { backgroundColor: COLORS.amberWash, borderRadius: 9, padding: 11, flexDirection: "row", gap: 9, alignItems: "center" },
  buildNoticeCopy: { flex: 1, gap: 2 },
  buildNoticeTitle: { color: COLORS.amber, fontFamily: FONT.bold, fontSize: 10, letterSpacing: 0.7 },
  buildNoticeText: { color: "#D8B47B", fontFamily: FONT.regular, fontSize: 11 },
  controlRow: { flexDirection: "row", gap: 8 },
  errorBox: { backgroundColor: COLORS.dangerWash, borderRadius: 8, padding: 10, flexDirection: "row", gap: 8, alignItems: "flex-start" },
  errorText: { flex: 1, color: COLORS.danger, fontFamily: FONT.regular, fontSize: 11, lineHeight: 16 },
  rulesPanel: { gap: 13 },
  rulesHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  rulesTitle: { flex: 1, color: COLORS.text, fontFamily: FONT.bold, fontSize: 11, letterSpacing: 1.2 },
  rulesGrid: { flexDirection: "row", gap: 7 },
  ruleItem: { flex: 1, backgroundColor: COLORS.panelDeep, borderRadius: 8, padding: 9, gap: 3 },
  ruleValue: { color: COLORS.signal, fontFamily: FONT.bold, fontSize: 18 },
  ruleLabel: { color: COLORS.textMuted, fontFamily: FONT.bold, fontSize: 8, lineHeight: 11 },
  ruleStatus: { color: COLORS.signalDim, fontFamily: FONT.bold, fontSize: 8, letterSpacing: 0.7 },
  rulesUnknown: { color: COLORS.amber, fontFamily: FONT.regular, fontSize: 11 },
  thumbnailWrap: { height: 82, borderRadius: 8, overflow: "hidden", backgroundColor: COLORS.panelDeep, borderColor: COLORS.lineSoft, borderWidth: 1, position: "relative" },
  thumbnail: { width: "100%", height: "100%", opacity: 0.76 },
  thumbnailOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(7, 26, 36, 0.84)", paddingHorizontal: 8, paddingVertical: 5 },
  thumbnailText: { color: COLORS.text, fontFamily: FONT.bold, fontSize: 9, letterSpacing: 0.8 },
});
