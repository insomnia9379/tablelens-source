import { Platform } from "react-native";
import {
  requireOptionalNativeModule,
  type EventSubscription,
} from "expo-modules-core";

import type { CaptureState } from "@/lib/blackjack";

type CaptureModule = {
  getStatus?: () => Promise<CaptureState> | CaptureState;
  requestOverlayPermission?: () => Promise<boolean | Record<string, unknown> | void> | boolean | Record<string, unknown> | void;
  startCapture?: () => Promise<CaptureState> | CaptureState;
  pause?: () => Promise<CaptureState> | CaptureState;
  resume?: () => Promise<CaptureState> | CaptureState;
  stop?: () => Promise<CaptureState> | CaptureState;
  openReview?: () => Promise<unknown> | unknown;
  pickAndAnalyze?: () => Promise<unknown> | unknown;
  analyzeImage?: (uri: string) => Promise<CaptureState> | CaptureState;
  applyCorrection?: (
    player: string,
    dealer: string,
    total: string,
    wager: string,
    phase: string,
  ) => Promise<CaptureState> | CaptureState;
  addListener?: (
    eventName: "onStateChange",
    listener: (state: CaptureState) => void,
  ) => EventSubscription;
};

let nativeModule: CaptureModule | null | undefined;

/**
 * The live recognizer is intentionally opt-in. The JS bridge never tries to
 * simulate capture on web, Expo Go, or another platform without the Android
 * module installed.
 */
function getNativeModule(): CaptureModule | null {
  if (Platform.OS !== "android") return null;
  if (nativeModule !== undefined) return nativeModule;
  nativeModule = requireOptionalNativeModule<CaptureModule>("TablelensCapture");
  return nativeModule;
}

export function isCaptureAvailable(): boolean {
  return getNativeModule() !== null;
}

export function subscribeCaptureState(
  listener: (state: CaptureState) => void,
): EventSubscription | null {
  const module = getNativeModule();
  if (!module?.addListener) return null;
  return module.addListener("onStateChange", listener);
}

export async function getCaptureStatus(): Promise<CaptureState | null> {
  const module = getNativeModule();
  if (!module?.getStatus) return null;
  return await module.getStatus();
}

export async function requestOverlayPermission(): Promise<boolean | Record<string, unknown> | void | null> {
  const module = getNativeModule();
  if (!module?.requestOverlayPermission) return null;
  return await module.requestOverlayPermission();
}

export async function startCapture(): Promise<CaptureState | null> {
  const module = getNativeModule();
  if (!module?.startCapture) return null;
  return await module.startCapture();
}

export async function pauseCapture(): Promise<CaptureState | null> {
  const module = getNativeModule();
  if (!module?.pause) return null;
  return await module.pause();
}

export async function resumeCapture(): Promise<CaptureState | null> {
  const module = getNativeModule();
  if (!module?.resume) return null;
  return await module.resume();
}

export async function stopCapture(): Promise<CaptureState | null> {
  const module = getNativeModule();
  if (!module?.stop) return null;
  return await module.stop();
}

export async function openCaptureReview(): Promise<unknown | null> {
  const module = getNativeModule();
  if (!module?.openReview) return null;
  return await module.openReview();
}

export async function analyzeImage(uri: string): Promise<CaptureState | null> {
  const module = getNativeModule();
  if (!module?.analyzeImage) return null;
  return await module.analyzeImage(uri);
}

export async function pickAndAnalyze(): Promise<unknown | null> {
  const module = getNativeModule();
  if (!module?.pickAndAnalyze) return null;
  return await module.pickAndAnalyze();
}

export async function applyCaptureCorrection(
  player: string[],
  dealer: string | null,
  total: number | null,
  wager: number | null,
  phase: CaptureState["phase"],
): Promise<CaptureState | null> {
  const module = getNativeModule();
  if (!module?.applyCorrection) return null;
  return await module.applyCorrection(
    player.join(","),
    dealer ?? "",
    total === null ? "" : String(total),
    wager === null ? "" : String(wager),
    phase,
  );
}
