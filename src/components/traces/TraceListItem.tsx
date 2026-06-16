import type { Trace } from '../../domain/trace.types';
import { Button } from '../ui/Button';
import { downloadGpx } from '../../services/export/gpxExport';

interface TraceListItemProps {
  trace: Trace;
  onDelete: (traceId: string) => void;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes} min ${String(remaining).padStart(2, '0')} s`;
}

export function TraceListItem({ trace, onDelete }: TraceListItemProps) {
  return (
    <article className="trace-item">
      <div>
        <strong>{trace.routeName}</strong>
        <span>{new Date(trace.date).toLocaleString('fr-FR')}</span>
      </div>
      <dl>
        <div><dt>Durée</dt><dd>{formatDuration(trace.dureeSec)}</dd></div>
        <div><dt>Distance</dt><dd>{trace.distanceNm.toFixed(1)} NM</dd></div>
        <div><dt>Points</dt><dd>{trace.positions.length}</dd></div>
      </dl>
      <div className="trace-actions">
        <Button variant="secondary" onClick={() => downloadGpx(trace)}>Exporter GPX</Button>
        <Button variant="ghost" onClick={() => onDelete(trace.id)}>Supprimer</Button>
      </div>
    </article>
  );
}
