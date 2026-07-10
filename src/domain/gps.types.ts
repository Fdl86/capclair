export interface GpsPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  vitesse: number | null;
  track: number | null;
  timestamp: number;
  precision: number | null;
}

export type GpsStatus =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'degraded'
  | 'frozen'
  | 'denied'
  | 'unavailable'
  | 'simulating'
  | 'simulation-complete'
  | 'saving'
  | 'saved'
  | 'save-error'
  | 'stopped';

export interface GpsTraceDiagnostics {
  rawReceived: number;
  rejectedPrecision: number;
  rejectedRedundant: number;
  rejectedSpeed: number;
  rejectedDrift: number;
  forcedResync: number;
  tracePoints: number;
  gpsGaps: number;
  gpsResumptions: number;
  missingAltitude: number;
  unreliableAltitude: number;
  maxObservedSpeedKt: number;
  /** Ancien champ conservé pour lire les traces WEB13.18.1. */
  maxTraceSpeedKt?: number;
}
