import type { GpsPosition } from '../../domain/gps.types';
import type { GpxImportKind, Trace } from '../../domain/trace.types';
import {
  TRACE_GAP_BREAK_MS,
  compactSegmentedTrace,
  computeTraceMetrics
} from '../traces/traceSegments';

const MAX_GPX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_GPX_SOURCE_POINTS = 100_000;
const MAX_STORED_GPX_POINTS = 25_000;
const METRES_PER_SECOND_TO_KNOTS = 1.9438444924;

interface RawGpxPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  vitesse: number | null;
  track: number | null;
  precision: number | null;
  timestamp: number | null;
}

interface ParsedCollection {
  kind: GpxImportKind;
  name: string | null;
  points: RawGpxPoint[];
  segmentStartIndices: number[];
  originalPointCount: number;
  discardedPointCount: number;
}

export interface GpxImportResult {
  trace: Trace;
  message: string;
  temporalReplayAvailable: boolean;
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTrack(value: number | null): number | null {
  if (value === null) return null;
  return ((value % 360) + 360) % 360;
}

function directChildText(element: Element, localName: string): string | null {
  for (const child of Array.from(element.children)) {
    if (child.localName === localName) return child.textContent?.trim() || null;
  }
  return null;
}

function descendantText(element: Element, localNames: string[]): string | null {
  for (const localName of localNames) {
    const nodes = element.getElementsByTagNameNS('*', localName);
    for (const node of Array.from(nodes)) {
      const value = node.textContent?.trim();
      if (value) return value;
    }
  }
  return null;
}

function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function parsePoint(element: Element): RawGpxPoint | null {
  const latitude = finiteNumber(element.getAttribute('lat'));
  const longitude = finiteNumber(element.getAttribute('lon'));
  if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  const altitude = finiteNumber(directChildText(element, 'ele'));
  const timestamp = parseTimestamp(directChildText(element, 'time'));
  const altitudeAccuracy = finiteNumber(descendantText(element, ['altitudeAccuracy', 'verticalAccuracy']));
  const precision = finiteNumber(descendantText(element, ['precision', 'horizontalAccuracy']));
  const speedKtExtension = finiteNumber(descendantText(element, ['vitesseKt', 'speedKt']));
  const standardSpeedMs = finiteNumber(directChildText(element, 'speed'));
  const vitesse = speedKtExtension ?? (standardSpeedMs === null ? null : standardSpeedMs * METRES_PER_SECOND_TO_KNOTS);
  const track = normalizeTrack(finiteNumber(descendantText(element, ['trackDeg', 'course', 'heading'])));

  return {
    latitude,
    longitude,
    altitude,
    altitudeAccuracy,
    vitesse: vitesse !== null && vitesse >= 0 && vitesse <= 800 ? vitesse : null,
    track,
    precision,
    timestamp
  };
}

function directName(element: Element): string | null {
  return directChildText(element, 'name');
}

function collectSegments(containers: Element[], pointName: 'trkpt' | 'rtept'): ParsedCollection {
  const points: RawGpxPoint[] = [];
  const segmentStartIndices: number[] = [];
  let originalPointCount = 0;
  let discardedPointCount = 0;
  let name: string | null = null;

  containers.forEach((container) => {
    if (!name) name = directName(container);
    const trackSegments = pointName === 'trkpt'
      ? Array.from(container.getElementsByTagNameNS('*', 'trkseg'))
      : [];
    const segmentElements = pointName === 'trkpt'
      ? (trackSegments.length > 0 ? trackSegments : [container])
      : [container];

    segmentElements.forEach((segment) => {
      const elements = Array.from(segment.getElementsByTagNameNS('*', pointName));
      if (elements.length === 0) return;
      const segmentStart = points.length;
      elements.forEach((element) => {
        originalPointCount += 1;
        if (originalPointCount > MAX_GPX_SOURCE_POINTS) {
          throw new Error(`Le GPX dépasse la limite de ${MAX_GPX_SOURCE_POINTS.toLocaleString('fr-FR')} points.`);
        }
        const point = parsePoint(element);
        if (point) points.push(point);
        else discardedPointCount += 1;
      });
      if (points.length > segmentStart && segmentStart > 0) segmentStartIndices.push(segmentStart);
    });
  });

  return {
    kind: pointName === 'trkpt' ? 'track' : 'route',
    name,
    points,
    segmentStartIndices,
    originalPointCount,
    discardedPointCount
  };
}

function metadataName(root: Element): string | null {
  const metadata = Array.from(root.getElementsByTagNameNS('*', 'metadata'))[0];
  return metadata ? directName(metadata) : null;
}

function fileBaseName(fileName: string): string {
  const base = fileName.replace(/\.gpx$/i, '').trim();
  return base || 'GPX importé';
}

function cleanTraceName(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return (normalized || 'GPX importé').slice(0, 100);
}

function hasCompleteMonotonicTimestamps(points: RawGpxPoint[], segmentStartIndices: number[]): boolean {
  if (points.some((point) => point.timestamp === null)) return false;
  const starts = new Set(segmentStartIndices);
  for (let index = 1; index < points.length; index += 1) {
    if (starts.has(index)) continue;
    const previous = points[index - 1].timestamp!;
    const current = points[index].timestamp!;
    if (current <= previous) return false;
  }
  return true;
}

function traceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `gpx-${crypto.randomUUID()}`;
  }
  return `gpx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizePositions(
  points: RawGpxPoint[],
  completeTimestamps: boolean,
  fallbackStartMs: number
): GpsPosition[] {
  return points.map((point, index) => ({
    latitude: point.latitude,
    longitude: point.longitude,
    altitude: point.altitude,
    altitudeAccuracy: point.altitudeAccuracy,
    vitesse: point.vitesse,
    track: point.track,
    precision: point.precision,
    timestamp: completeTimestamps ? point.timestamp! : fallbackStartMs + index * 1000
  }));
}

function parseXml(xmlText: string): Document {
  const document = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parserErrors = document.getElementsByTagName('parsererror');
  if (parserErrors.length > 0) throw new Error('Le fichier GPX contient un XML invalide.');
  if (document.documentElement.localName.toLowerCase() !== 'gpx') {
    throw new Error('Ce fichier XML n’est pas un document GPX.');
  }
  return document;
}

export function parseGpxText(xmlText: string, fileName: string, fileLastModified?: number): GpxImportResult {
  const document = parseXml(xmlText);
  const root = document.documentElement;
  const tracks = Array.from(root.getElementsByTagNameNS('*', 'trk'));
  const routes = Array.from(root.getElementsByTagNameNS('*', 'rte'));
  const trackCollection = collectSegments(tracks, 'trkpt');
  const routeCollection = trackCollection.points.length >= 2 ? null : collectSegments(routes, 'rtept');
  const collection = trackCollection.points.length >= 2 ? trackCollection : routeCollection!;

  if (trackCollection.originalPointCount === 0 && collection.originalPointCount === 0) {
    throw new Error('Aucun point de trace (trkpt) ou de route (rtept) trouvé dans ce GPX.');
  }
  if (collection.points.length < 2) {
    throw new Error('Le GPX ne contient pas au moins deux coordonnées valides.');
  }

  const temporalReplayAvailable = hasCompleteMonotonicTimestamps(collection.points, collection.segmentStartIndices);
  const importedAt = new Date().toISOString();
  const fallbackStartMs = Number.isFinite(fileLastModified) && (fileLastModified ?? 0) > 0
    ? Number(fileLastModified)
    : Date.now();
  const rawPositions = normalizePositions(collection.points, temporalReplayAvailable, fallbackStartMs);
  const compacted = compactSegmentedTrace(rawPositions, collection.segmentStartIndices, MAX_STORED_GPX_POINTS);
  const metrics = computeTraceMetrics(
    compacted.positions,
    compacted.segmentStartIndices,
    temporalReplayAvailable,
    TRACE_GAP_BREAK_MS
  );
  const firstTimestamp = temporalReplayAvailable ? compacted.positions[0].timestamp : fallbackStartMs;
  const lastTimestamp = temporalReplayAvailable ? compacted.positions.at(-1)!.timestamp : fallbackStartMs;
  const routeName = cleanTraceName(metadataName(root) ?? collection.name ?? fileBaseName(fileName));

  const trace: Trace = {
    schemaVersion: 4,
    id: traceId(),
    sessionId: null,
    routeId: `gpx-import-${Date.now()}`,
    routeName,
    date: new Date(firstTimestamp).toISOString(),
    startedAt: temporalReplayAvailable ? new Date(firstTimestamp).toISOString() : undefined,
    endedAt: temporalReplayAvailable ? new Date(lastTimestamp).toISOString() : undefined,
    source: 'gpx-import',
    timingMode: temporalReplayAvailable ? 'recorded' : 'unavailable',
    positions: compacted.positions,
    segmentStartIndices: metrics.segmentStartIndices,
    dureeSec: metrics.durationSec,
    distanceNm: metrics.distanceNm,
    importMetadata: {
      fileName,
      importedAt,
      kind: collection.kind,
      originalPointCount: collection.originalPointCount,
      discardedPointCount: collection.discardedPointCount,
      optimizedPointCount: compacted.compacted ? collection.points.length - compacted.positions.length : 0,
      hadCompleteTimestamps: temporalReplayAvailable
    }
  };

  const kindLabel = collection.kind === 'track' ? 'trace' : 'route';
  const timingLabel = temporalReplayAvailable
    ? 'Replay temporel disponible.'
    : 'GPX sans horodatage complet : carte et profil disponibles, lecture temporelle désactivée.';
  const discardedLabel = collection.discardedPointCount > 0
    ? ` ${collection.discardedPointCount} point(s) invalide(s) ignoré(s).`
    : '';
  const optimizedLabel = compacted.compacted
    ? ` Trace optimisée de ${collection.points.length.toLocaleString('fr-FR')} à ${compacted.positions.length.toLocaleString('fr-FR')} points pour préserver la fluidité.`
    : '';

  return {
    trace,
    temporalReplayAvailable,
    message: `${compacted.positions.length} points de ${kindLabel} importés. ${timingLabel}${discardedLabel}${optimizedLabel}`
  };
}

export async function importGpxFile(file: File): Promise<GpxImportResult> {
  if (file.size <= 0) throw new Error('Le fichier GPX est vide.');
  if (file.size > MAX_GPX_FILE_BYTES) throw new Error('Le fichier GPX dépasse la limite de 20 Mo.');
  const text = await file.text();
  return parseGpxText(text, file.name, file.lastModified);
}
