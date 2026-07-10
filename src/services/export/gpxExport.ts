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
  const date = new Date(trace.date);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function traceFileName(trace: Trace, extension: 'gpx' | 'json'): string {
  return `cap-clair-${safeSlug(trace.routeName)}-${traceDateSlug(trace)}.${extension}`;
}

export function traceToGpx(trace: Trace): string {
  const metadataExtensions = [
    extension('appVersion', APP_VERSION),
    traceDiagnosticsExtensions(trace)
  ].join('');

  const points = trace.positions.map((position) => {
    const hasReliableAltitude = isReliableGpsAltitude(position);
    const elevation = hasReliableAltitude ? `<ele>${Math.round(position.altitude as number)}</ele>` : '';
    const precision = position.precision !== null ? extension('precision', position.precision.toFixed(1)) : '';
    const altitudeAccuracy = position.altitudeAccuracy !== null ? extension('altitudeAccuracy', position.altitudeAccuracy.toFixed(1)) : '';
    const altitudeReliable = position.altitude !== null ? extension('altitudeReliable', hasReliableAltitude ? 'true' : 'false') : '';
    const rawAltitude = position.altitude !== null ? extension('rawAltitudeM', position.altitude.toFixed(1)) : '';
    const vitesse = position.vitesse !== null ? extension('vitesse', position.vitesse.toFixed(1)) : '';
    const track = position.track !== null ? extension('track', position.track.toFixed(1)) : '';
    const extensions = precision || altitudeAccuracy || altitudeReliable || rawAltitude || vitesse || track
      ? `<extensions>${precision}${altitudeAccuracy}${altitudeReliable}${rawAltitude}${vitesse}${track}</extensions>`
      : '';
    return `      <trkpt lat="${position.latitude.toFixed(7)}" lon="${position.longitude.toFixed(7)}">${elevation}<time>${new Date(position.timestamp).toISOString()}</time>${extensions}</trkpt>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="${escapeXml(APP_VERSION)}" xmlns="http://www.topografix.com/GPX/1/1" xmlns:capclair="https://cap-clair.app/gpx/1">\n  <metadata>\n    <name>${escapeXml(trace.routeName)}</name>\n    <desc>${escapeXml(APP_VERSION)}</desc>\n    <extensions>${metadataExtensions}</extensions>\n  </metadata>\n  <trk>\n    <name>${escapeXml(trace.routeName)}</name>\n    <trkseg>\n${points}\n    </trkseg>\n  </trk>\n</gpx>`;
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
