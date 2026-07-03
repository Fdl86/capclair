import type { Trace } from '../../domain/trace.types';

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

export function traceToGpx(trace: Trace): string {
  const points = trace.positions.map((position) => {
    const elevation = position.altitude !== null ? `<ele>${Math.round(position.altitude)}</ele>` : '';
    const precision = position.precision !== null ? `<capclair:precision>${position.precision.toFixed(1)}</capclair:precision>` : '';
    const vitesse = position.vitesse !== null ? `<capclair:vitesse>${position.vitesse.toFixed(1)}</capclair:vitesse>` : '';
    const extensions = precision || vitesse ? `<extensions>${precision}${vitesse}</extensions>` : '';
    return `      <trkpt lat="${position.latitude.toFixed(7)}" lon="${position.longitude.toFixed(7)}">${elevation}<time>${new Date(position.timestamp).toISOString()}</time>${extensions}</trkpt>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="CAP CLAIR DEV01" xmlns="http://www.topografix.com/GPX/1/1" xmlns:capclair="https://cap-clair.app/gpx/1">\n  <trk>\n    <name>${escapeXml(trace.routeName)}</name>\n    <trkseg>\n${points}\n    </trkseg>\n  </trk>\n</gpx>`;
}

export function downloadGpx(trace: Trace): void {
  const blob = new Blob([traceToGpx(trace)], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cap-clair-${trace.routeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.gpx`;
  link.click();
  URL.revokeObjectURL(url);
}
