import { requireNativeModule, EventEmitter } from 'expo-modules-core';

export type TablelensState = {
  phase: 'betting' | 'decision' | 'unknown' | 'complete';
  player: string[];
  dealer: string | null;
  total: number | null;
  balance: number | null;
  wager: number | null;
  actions: string[];
  capturedAt: number;
  source: 'capture' | 'import' | 'manual';
  accepted: boolean;
  message: string;
  recommendation: string | null;
  captureStatus: 'idle' | 'starting' | 'active' | 'paused' | 'stopped' | 'error';
  latencyMs: number | null;
};

export type TablelensCaptureModule = {
  getStatus(): Promise<TablelensState>;
  requestOverlayPermission(): Promise<Record<string, unknown>>;
  startCapture(): Promise<TablelensState>;
  pause(): Promise<TablelensState>;
  resume(): Promise<TablelensState>;
  stop(): Promise<TablelensState>;
  openReview(): Promise<Record<string, unknown>>;
  pickAndAnalyze(): Promise<Record<string, unknown>>;
  analyzeImage(uri: string): Promise<TablelensState>;
  applyCorrection(player: string, dealer: string, total: string, wager: string, phase: string): Promise<TablelensState>;
};

export const TablelensCapture = requireNativeModule<TablelensCaptureModule>('TablelensCapture');
export const tablelensCaptureEvents = new EventEmitter(TablelensCapture as any);
