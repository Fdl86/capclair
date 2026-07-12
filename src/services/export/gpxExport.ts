import { APP_VERSION } from '../../app/version';
import type { Trace } from '../../domain/trace.types';
import { isReliableGpsAltitude } from '../gps/geolocationService';

export interface TraceExportResult {
  ok: boolean;
  mode: 'web-download';
  fileName: string;
  message: string;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return char;
    }
  });
}

function extension(tag: string, value: string | number | null | undefined): string {
  if (value === null || typeof value === 'undefined') return '';
  return `<capclair:${tag}>${escapeXml(String(value))}</capclair:${tag}>`;
}

function traceDiagnosticsExtensions(trace: Trace): string {
  const diagnostics = trace.diagnostics;
  if (!diagnostics) return '';

  return [
    extension('rawReceived', diagnostics.rawReceived),
    extension('tracePoints', diagnostics.tracePoints),
    extension('rejectedPrecision', diagnostics.rejectedPrecision),
    extension('rejectedRedundant', diagnostics.rejectedRedundant),
    extension('rejectedSpeed', diagnostics.rejectedSpeed),
    extension('rejectedDrift', diagnostics.rejectedDrift),
    extension('forcedResync', diagnostics.forcedResync),
    extension('gpsGaps', diagnostics.gpsGaps),
    extension('gpsResumptions', diagnostics.gpsResumptions),
    extension('missingAltitude', diagnostics.missingAltitude),
    extension('unreliableAltitude', diagnostics.unreliableAltitude),
    extension('maxObservedSpeedKt', diagnostics.maxObservedSpeedKt ?? diagnostics.maxTraceSpeedKt ?? 0)
  ].join('');
}

function safeSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'trace';
}

function traceDateSlug(trace: Trace): string {
  const date = new Date(trace.startedAt ?? trace.date);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function traceFileName(trace: Trace, fileExtension: 'gpx' | 'json'): string {
  return `cap-clair-${safeSlug(trace.routeName)}-${traceDateSlug(trace)}.${fileExtension}`;
}

export function splitTraceSegments(trace: Trace, gapMs = 12_000): Trace['positions'][] {
  const explicitStarts = new Set((trace.segmentStartIndices ?? []).filter((index) => Number.isInteger(index) && index > 0));
  const segments: Trace['positions'][] = [];
  let current: Trace['positions'] = [];

  trace.positions.forEach((position, index) => {
    const previous = current.at(-1);
    const shouldBreak = explicitStarts.has(index)
      || Boolean(previous && (position.timestamp <= previous.timestamp || position.timestamp - previous.timestamp > gapMs));
    if (shouldBreak && current.length) {
      segments.push(current);
      current = [];
    }
    current.push(position);
  });

  if (current.length) segments.push(current);
  return segments;
}

function finiteValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function positionToGpxPoint(position: Trace['positions'][number], includeTime: boolean): string {
  const altitude = finiteValue(position.altitude);
  const precisionValue = finiteValue(position.precision);
  const altitudeAccuracyValue = finiteValue(position.altitudeAccuracy);
  const speedValue = finiteValue(position.vitesse);
  const trackValue = finiteValue(position.track);
  const normalizedPosition = {
    ...position,
    altitude,
    altitudeAccuracy: altitudeAccuracyValue,
    precision: precisionValue,
    vitesse: speedValue,
    track: trackValue
  };
  const hasReliableAltitude = isReliableGpsAltitude(normalizedPosition);
  const elevation = hasReliableAltitude ? `<ele>${altitude!.toFixed(1)}</ele>` : '';
  const precision = precisionValue !== null ? extension('precision', precisionValue.toFixed(1)) : '';
  const altitudeAccuracy = altitudeAccuracyValue !== null ? extension('altitudeAccuracy', altitudeAccuracyValue.toFixed(1)) : '';
  const altitudeReliable = altitude !== null ? extension('altitudeReliable', hasReliableAltitude ? 'true' : 'false') : '';
  const rawAltitude = altitude !== null ? extension('rawAltitudeM', altitude.toFixed(1)) : '';
  const vitesse = speedValue !== null ? extension('vitesseKt', speedValue.toFixed(1)) : '';
  const track = trackValue !== null ? extension('trackDeg', trackValue.toFixed(1)) : '';
  const extensions = precision || altitudeAccuracy || altitudeReliable || rawAltitude || vitesse || track
    ? `<extensions>${precision}${altitudeAccuracy}${altitudeReliable}${rawAltitude}${vitesse}${track}</extensions>`
    : '';
  const time = includeTime ? `<time>${new Date(position.timestamp).toISOString()}</time>` : '';
  return `      <trkpt lat="${position.latitude.toFixed(7)}" lon="${position.longitude.toFixed(7)}">${elevation}${time}${extensions}</trkpt>`;
}

export function traceToGpx(trace: Trace): string {
  const segments = splitTraceSegments(trace);
  const metadataExtensions = [
    extension('appVersion', APP_VERSION),
    extension('schemaVersion', trace.schemaVersion ?? 1),
    extension('source', trace.source ?? 'legacy'),
    extension('timingMode', trace.timingMode ?? 'recorded'),
    extension('importFileName', trace.importMetadata?.fileName),
    extension('importKind', trace.importMetadata?.kind),
    extension('importedAt', trace.importMetadata?.importedAt),
    extension('originalPointCount', trace.importMetadata?.originalPointCount),
    extension('startedAt', trace.startedAt),
    extension('endedAt', trace.endedAt),
    extension('segmentCount', segments.length),
    traceDiagnosticsExtensions(trace)
  ].join('');

  const includeTime = trace.timingMode !== 'unavailable';
  const segmentXml = segments.map((segment) => {
    const points = segment.map((position) => positionToGpxPoint(position, includeTime)).join('\n');
    return `    <trkseg>\n${points}\n    </trkseg>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="${escapeXml(APP_VERSION)}" xmlns="http://www.topografix.com/GPX/1/1" xmlns:capclair="https://cap-clair.app/gpx/2">\n  <metadata>\n    <name>${escapeXml(trace.routeName)}</name>\n    <desc>${escapeXml(APP_VERSION)}</desc>\n    <time>${escapeXml(trace.endedAt ?? trace.importMetadata?.importedAt ?? trace.date)}</time>\n    <extensions>${metadataExtensions}</extensions>\n  </metadata>\n  <trk>\n    <name>${escapeXml(trace.routeName)}</name>\n${segmentXml}\n  </trk>\n</gpx>`;
}

export function traceToJson(trace: Trace): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), appVersion: APP_VERSION, trace }, null, 2);
}

function downloadTextFile(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function exportTextFile(fileName: string, content: string, mimeType: string): Promise<TraceExportResult> {
  downloadTextFile(fileName, content, mimeType);
  return {
    ok: true,
    mode: 'web-download',
    fileName,
    message: 'Téléchargement lancé.'
  };
}

export async function exportGpx(trace: Trace): Promise<TraceExportResult> {
  return exportTextFile(traceFileName(trace, 'gpx'), traceToGpx(trace), 'application/gpx+xml');
}

export async function exportJson(trace: Trace): Promise<TraceExportResult> {
  return exportTextFile(traceFileName(trace, 'json'), traceToJson(trace), 'application/json');
}

export function downloadGpx(trace: Trace): void {
  exportGpx(trace).catch((error) => {
    console.error('Export GPX impossible', error);
  });
}
