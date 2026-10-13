import { AppState, Platform } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  advise,
  emptyState,
  references,
  type CaptureState,
} from "@/lib/blackjack";
import {
  getCaptureStatus,
  isCaptureAvailable,
  openCaptureReview,
  pickAndAnalyze,
  pauseCapture,
  requestOverlayPermission,
  resumeCapture,
  startCapture,
  stopCapture,
  subscribeCaptureState,
} from "@/lib/capture";

type ReviewMode = "empty" | "reference" | "manual" | "import";
type ReferenceId = "390" | "391";

export type AdviceResult = {
  action: string | null;
  reason: string;
};

const coreReferences = references as unknown as { id: string; state: CaptureState }[];
const coreEmptyState = emptyState as CaptureState;

const fallbackReferences: Record<ReferenceId, CaptureState> = {
  "391": {
    ...coreEmptyState,
    player: ["9", "K"],
    dealer: "9",
    total: 19,
    balance: 50.19,
    wager: 0.5,
    actions: ["hit", "stand", "double"],
    phase: "decision",
    capturedAt: 0,
    source: "manual",
    accepted: true,
    message: "Reference example — manually transcribed, not OCR",
    recommendation: null,
    captureStatus: "stopped",
    latencyMs: null,
  },
  "390": {
    ...coreEmptyState,
    player: [],
    dealer: null,
    total: null,
    balance: 50.69,
    wager: 0,
    actions: ["play", "replay", "clear"],
    phase: "betting",
    capturedAt: 0,
    source: "manual",
    accepted: true,
    message: "Reference example — manually transcribed, not OCR",
    recommendation: null,
    captureStatus: "stopped",
    latencyMs: null,
  },
};

function cloneState(state: CaptureState): CaptureState {
  return {
    ...state,
    player: [...(state.player ?? [])],
    actions: [...(state.actions ?? [])],
  };
}

function readReference(id: ReferenceId): CaptureState {
  const candidate = coreReferences.find((reference) => reference.id === id)?.state ?? fallbackReferences[id];
  return cloneState(candidate);
}

function manualState(): CaptureState {
  const next = cloneState(coreEmptyState);
  next.source = "manual";
  next.captureStatus = "stopped";
  next.message = "Manual review — no OCR or live capture";
  return next;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Native capture returned an unknown error.";
}

export function useTableLens() {
  const [liveState, setLiveState] = useState<CaptureState | null>(null);
  const [reviewState, setReviewState] = useState<CaptureState>(manualState);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("empty");
  const [referenceId, setReferenceId] = useState<ReferenceId | null>(null);
  const [nativeError, setNativeError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [reviewAdviceVisible, setReviewAdviceVisible] = useState(false);
  const [reviewInputKey, setReviewInputKey] = useState(0);
  const available = useMemo(() => isCaptureAvailable(), []);

  const setLive = useCallback((state: CaptureState | null) => {
    setClock(Date.now());
    setLiveState(state);
    if (state?.captureStatus === "error") {
      setNativeError(state.message || "Native capture reported an error.");
    }
  }, []);

  const receiveNativeState = useCallback(
    (state: CaptureState) => {
      setClock(Date.now());
      setNativeError(null);
      if (state.source === "import") {
        setReferenceId(null);
        setReviewMode("import");
        setReviewAdviceVisible(true);
        setReviewInputKey((key) => key + 1);
        setReviewState(cloneState(state));
        if (state.captureStatus === "error") {
          setNativeError(state.message || "Native screenshot analysis failed.");
        }
        return;
      }
      if (state.source === "manual") {
        setReferenceId(null);
        setReviewMode("manual");
        setReviewAdviceVisible(true);
        setReviewInputKey((key) => key + 1);
        setReviewState(cloneState(state));
        setLive({ ...emptyState, captureStatus: state.captureStatus, message: "Manual review is separate from automatic OCR. Waiting for a new captured reading." });
        return;
      }
      setLive(state);
    },
    [setLive],
  );

  const refreshStatus = useCallback(async () => {
    if (!available) return;
    try {
      const state = await getCaptureStatus();
      if (state) receiveNativeState(state);
    } catch (error) {
      setNativeError(errorMessage(error));
    }
  }, [available, receiveNativeState]);

  useEffect(() => {
    if (!available) return;
    const subscription = subscribeCaptureState(receiveNativeState);
    const refreshTimer = setTimeout(() => void refreshStatus(), 0);
    return () => {
      clearTimeout(refreshTimer);
      subscription?.remove();
    };
  }, [available, receiveNativeState, refreshStatus]);

  useEffect(() => {
    if (!available || Platform.OS !== "android") return;
    const listener = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void refreshStatus();
    });
    return () => listener.remove();
  }, [available, refreshStatus]);

  useEffect(() => {
    if (liveState?.captureStatus !== "active") return;
    const interval = setInterval(() => setClock(Date.now()), 250);
    return () => clearInterval(interval);
  }, [liveState?.captureStatus]);

  const liveFresh = Boolean(
    liveState &&
      liveState.captureStatus === "active" &&
      liveState.capturedAt > 0 &&
      liveState.source === "capture" &&
      clock - liveState.capturedAt >= 0 &&
      clock - liveState.capturedAt <= 1500,
  );

  const liveAdvice = useMemo<AdviceResult>(() => {
    if (!liveState || !liveFresh) {
      return { action: null, reason: "Waiting for a fresh native state." };
    }
    try {
      return advise(liveState, clock);
    } catch (error) {
      return { action: null, reason: errorMessage(error) };
    }
  }, [clock, liveFresh, liveState]);

  const reviewAdvice = useMemo<AdviceResult>(() => {
    if (reviewMode === "empty") {
      return { action: null, reason: "Load a reference or enter a manual state to evaluate strategy." };
    }
    try {
      return advise(reviewState);
    } catch (error) {
      return { action: null, reason: errorMessage(error) };
    }
  }, [reviewMode, reviewState]);

  const loadReference = useCallback((id: ReferenceId) => {
    setReferenceId(id);
    setReviewMode("reference");
    setReviewAdviceVisible(true);
    setReviewInputKey((key) => key + 1);
    setReviewState(readReference(id));
  }, []);

  const clearReview = useCallback(() => {
    setReferenceId(null);
    setReviewMode("empty");
    setReviewAdviceVisible(false);
    setReviewInputKey((key) => key + 1);
    setReviewState(manualState());
  }, []);

  const updateReview = useCallback(
    (patch: Partial<CaptureState>) => {
      setReferenceId(null);
      setReviewMode("manual");
      setReviewAdviceVisible(true);
      setReviewState((current) => ({
        ...current,
        ...patch,
        source: "manual",
        accepted: false,
        message: "Manual review — not OCR",
        captureStatus: "stopped",
      }));
    },
    [],
  );

  const runStrategy = useCallback(() => {
    setReferenceId(null);
    setReviewMode("manual");
    setReviewAdviceVisible(true);
    setReviewState((current) => ({
      ...current,
      source: "manual",
      accepted: true,
      message: "Manual strategy evaluation — not OCR",
      captureStatus: "stopped",
    }));
  }, []);

  const reviewLiveReading = useCallback(async () => {
    if (!available) return;
    setBusy("review-live");
    setNativeError(null);
    try {
      await openCaptureReview();
    } catch (error) {
      setNativeError(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }, [available]);

  const analyzeScreenshot = useCallback(async () => {
    if (!available) return;
    setBusy("analyze");
    setNativeError(null);
    try {
      const state = await pickAndAnalyze();
      if (state === null) throw new Error("TableLensCapture.pickAndAnalyze is unavailable.");
    } catch (error) {
      setNativeError(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }, [available]);

  const start = useCallback(async () => {
    if (!available) return;
    setBusy("start");
    setNativeError(null);
    try {
      const permission = await requestOverlayPermission();
      const permissionDenied =
        permission === false ||
        (typeof permission === "object" && permission !== null && "granted" in permission && permission.granted === false);
      if (permissionDenied) {
        setNativeError("Overlay permission was not granted.");
        return;
      }
      const state = await startCapture();
      if (!state) throw new Error("TableLensCapture.startCapture is unavailable.");
      setLive(state);
    } catch (error) {
      setNativeError(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }, [available, setLive]);

  const control = useCallback(
    async (command: "pause" | "resume" | "stop") => {
      if (!available) return;
      setBusy(command);
      setNativeError(null);
      try {
        const state =
          command === "pause"
            ? await pauseCapture()
            : command === "resume"
              ? await resumeCapture()
              : await stopCapture();
        if (!state) throw new Error(`TableLensCapture.${command} is unavailable.`);
        setLive(state);
      } catch (error) {
        setNativeError(errorMessage(error));
      } finally {
        setBusy(null);
      }
    },
    [available, setLive],
  );

  const applyCorrection = useCallback(() => {
    setReviewState((current) => ({
      ...current,
      source: "manual",
      accepted: true,
      message: "Manual correction accepted locally — not OCR",
      captureStatus: "stopped",
    }));
    setReviewMode("manual");
    setReviewAdviceVisible(true);
  }, []);

  return {
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
    reviewLiveReading,
    analyzeScreenshot,
    start,
    control,
    applyCorrection,
    refreshStatus,
  };
}
