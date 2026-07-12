import type { GpsPosition, GpsTraceDiagnostics } from './gps.types';
import type { NavPointType } from './navigation.types';

export type TraceSource = 'web' | 'simulation' | 'legacy' | 'gpx-import';
export type TraceTimingMode = 'recorded' | 'unavailable';
export type GpxImportKind = 'track' | 'route';

export interface PlannedRouteSnapshotPoint {
  id: string;
  nom: string;
  code?: string;
  type: NavPointType;
  latitude: number;
  longitude: number;
}

export interface PlannedRouteSnapshot {
  routeId: string;
  routeName: string;
  capturedAt: string;
  points: PlannedRouteSnapshotPoint[];
}

export interface GpxImportMetadata {
  fileName: string;
  importedAt: string;
  kind: GpxImportKind;
  originalPointCount: number;
  discardedPointCount: number;
  hadCompleteTimestamps: boolean;
}

export interface Trace {
  schemaVersion?: number;
  id: string;
  sessionId?: string | null;
  routeId: string;
  routeName: string;
  date: string;
  startedAt?: string;
  endedAt?: string;
  source?: TraceSource;
  timingMode?: TraceTimingMode;
  positions: GpsPosition[];
  plannedRoute?: PlannedRouteSnapshot;
  segmentStartIndices?: number[];
  dureeSec: number;
  distanceNm: number;
  diagnostics?: GpsTraceDiagnostics;
  importMetadata?: GpxImportMetadata;
}
