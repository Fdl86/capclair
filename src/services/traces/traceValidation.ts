import type { GpsPosition, GpsTraceDiagnostics } from '../../domain/gps.types';
import type { NavPointType } from '../../domain/navigation.types';
import type {
  GpxImportMetadata,
  PlannedRouteSnapshot,
  Trace,
  TraceSource,
  TraceTimingMode
} from '../../domain/trace.types';
import { computeTraceMetrics } from './traceSegments';

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nullableFinite(value: unknown): number | null {
  return value === null || value === undefined ? null : finite(value);
}

function validIso(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return Number.isNaN(Date.parse(value)) ? undefined : value;
}

function normalizePosition(value: unknown): GpsPosition | null {
  const item = record(value);
  if (!item) return null;
  const latitude = finite(item.latitude);
  const longitude = finite(item.longitude);
  const timestamp = finite(item.timestamp);
  if (latitude === null || longitude === null || timestamp === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  if (Number.isNaN(new Date(timestamp).getTime())) return null;
  return {
    latitude,
    longitude,
    timestamp,
    altitude: nullableFinite(item.altitude),
    altitudeAccuracy: nullableFinite(item.altitudeAccuracy),
    vitesse: nullableFinite(item.vitesse),
    track: nullableFinite(item.track),
    precision: nullableFinite(item.precision)
  };
}

function normalizeSource(value: unknown): TraceSource {
  return value === 'web' || value === 'simulation' || value === 'legacy' || value === 'gpx-import'
    ? value
    : 'legacy';
}

function normalizeTimingMode(value: unknown): TraceTimingMode {
  return value === 'unavailable' ? 'unavailable' : 'recorded';
}

function normalizeDiagnostics(value: unknown): GpsTraceDiagnostics | undefined {
  const item = record(value);
  if (!item) return undefined;
  const number = (key: string) => Math.max(0, Math.round(finite(item[key]) ?? 0));
  return {
    rawReceived: number('rawReceived'),
    rejectedPrecision: number('rejectedPrecision'),
    rejectedRedundant: number('rejectedRedundant'),
    rejectedSpeed: number('rejectedSpeed'),
    rejectedDrift: number('rejectedDrift'),
    forcedResync: number('forcedResync'),
    tracePoints: number('tracePoints'),
    gpsGaps: number('gpsGaps'),
    gpsResumptions: number('gpsResumptions'),
    missingAltitude: number('missingAltitude'),
    unreliableAltitude: number('unreliableAltitude'),
    maxObservedSpeedKt: finite(item.maxObservedSpeedKt) ?? finite(item.maxTraceSpeedKt) ?? 0
  };
}

function normalizePlannedRoute(value: unknown): PlannedRouteSnapshot | undefined {
  const item = record(value);
  if (!item || !Array.isArray(item.points)) return undefined;
  const points = item.points.flatMap((rawPoint, index) => {
    const point = record(rawPoint);
    if (!point) return [];
    const latitude = finite(point.latitude);
    const longitude = finite(point.longitude);
    if (latitude === null || longitude === null) return [];
    const type: NavPointType = point.type === 'depart' || point.type === 'destination' ? point.type : 'waypoint';
    return [{
      id: typeof point.id === 'string' ? point.id : `snapshot-${index}`,
      nom: typeof point.nom === 'string' && point.nom.trim() ? point.nom : `Point ${index + 1}`,
      code: typeof point.code === 'string' ? point.code : undefined,
      type,
      latitude,
      longitude
    }];
  });
  if (points.length < 2) return undefined;
  return {
    routeId: typeof item.routeId === 'string' ? item.routeId : 'route-inconnue',
    routeName: typeof item.routeName === 'string' ? item.routeName : 'Route prévue',
    capturedAt: validIso(item.capturedAt) ?? new Date().toISOString(),
    points
  };
}

function normalizeImportMetadata(value: unknown): GpxImportMetadata | undefined {
  const item = record(value);
  if (!item || typeof item.fileName !== 'string') return undefined;
  return {
    fileName: item.fileName,
    importedAt: validIso(item.importedAt) ?? new Date().toISOString(),
    kind: item.kind === 'route' ? 'route' : 'track',
    originalPointCount: Math.max(0, Math.round(finite(item.originalPointCount) ?? 0)),
    discardedPointCount: Math.max(0, Math.round(finite(item.discardedPointCount) ?? 0)),
    optimizedPointCount: Math.max(0, Math.round(finite(item.optimizedPointCount) ?? 0)),
    hadCompleteTimestamps: item.hadCompleteTimestamps === true
  };
}

export function normalizeTraceRecord(value: unknown): Trace | null {
  const item = record(value);
  if (!item) return null;
  const positions = Array.isArray(item.positions)
    ? item.positions.map(normalizePosition).filter((position): position is GpsPosition => position !== null)
    : [];
  if (positions.length < 2) return null;

  const id = typeof item.id === 'string' && item.id.trim() ? item.id : null;
  if (!id) return null;
  const timingMode = normalizeTimingMode(item.timingMode);
  const explicitStarts = Array.isArray(item.segmentStartIndices)
    ? item.segmentStartIndices.filter((index): index is number => Number.isInteger(index))
    : [];
  const metrics = computeTraceMetrics(positions, explicitStarts, timingMode !== 'unavailable');
  const firstIso = new Date(positions[0].timestamp).toISOString();
  const lastIso = new Date(positions.at(-1)!.timestamp).toISOString();
  const date = validIso(item.date) ?? validIso(item.startedAt) ?? firstIso;
  const source = normalizeSource(item.source);

  return {
    schemaVersion: Math.max(1, Math.round(finite(item.schemaVersion) ?? 1)),
    id,
    sessionId: typeof item.sessionId === 'string' ? item.sessionId : null,
    routeId: typeof item.routeId === 'string' && item.routeId.trim() ? item.routeId : 'route-inconnue',
    routeName: typeof item.routeName === 'string' && item.routeName.trim() ? item.routeName : 'Trace locale',
    date,
    startedAt: validIso(item.startedAt) ?? (timingMode === 'recorded' ? firstIso : undefined),
    endedAt: validIso(item.endedAt) ?? (timingMode === 'recorded' ? lastIso : undefined),
    source,
    timingMode,
    positions,
    plannedRoute: normalizePlannedRoute(item.plannedRoute),
    segmentStartIndices: metrics.segmentStartIndices,
    dureeSec: metrics.durationSec,
    distanceNm: Number(metrics.distanceNm.toFixed(2)),
    diagnostics: normalizeDiagnostics(item.diagnostics),
    importMetadata: normalizeImportMetadata(item.importMetadata)
  };
}

export function normalizeTraceRecords(values: unknown[]): { traces: Trace[]; discardedCount: number } {
  const traces: Trace[] = [];
  let discardedCount = 0;
  for (const value of values) {
    const trace = normalizeTraceRecord(value);
    if (trace) traces.push(trace);
    else discardedCount += 1;
  }
  return { traces, discardedCount };
}
