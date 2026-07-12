import { useState } from 'react';
import type { Trace } from '../../domain/trace.types';
import { Button } from '../ui/Button';
import { exportGpx, exportJson } from '../../services/export/gpxExport';

interface TraceListItemProps {
  trace: Trace;
  replayDisabled: boolean;
  onOpenReplay: (traceId: string) => void;
  onDelete: (traceId: string) => void;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes} min ${String(remaining).padStart(2, '0')} s`;
}

function traceSourceLabel(trace: Trace): string {
  if (trace.source === 'gpx-import') return 'GPX importé';
  if (trace.source === 'simulation') return 'Simulation';
  if (trace.source === 'web') return 'GPS web';
  return 'Trace locale';
}

function traceDateLabel(trace: Trace): string {
  const rawDate = trace.source === 'gpx-import' && trace.timingMode === 'unavailable'
    ? trace.importMetadata?.importedAt ?? trace.date
    : trace.startedAt ?? trace.date;
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return 'Date inconnue';
  const prefix = trace.source === 'gpx-import' && trace.timingMode === 'unavailable' ? 'Importé le ' : '';
  return `${prefix}${date.toLocaleString('fr-FR')}`;
}

export function TraceListItem({ trace, replayDisabled, onOpenReplay, onDelete }: TraceListItemProps) {
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const runExport = async (format: 'gpx' | 'json') => {
    if (isExporting) return;
    setIsExporting(true);
    setExportStatus(format === 'gpx' ? 'Préparation GPX...' : 'Préparation JSON...');
    try {
      const result = format === 'gpx' ? await exportGpx(trace) : await exportJson(trace);
      setExportStatus(`${result.fileName} - ${result.message}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || 'Erreur inconnue');
      setExportStatus(`Export impossible : ${message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const replayAvailable = trace.positions.length >= 2;
  const temporalReplayAvailable = trace.timingMode !== 'unavailable';

  return (
    <article className="trace-item">
      <div className="trace-item-heading">
        <div>
          <strong>{trace.routeName}</strong>
          <span>{traceDateLabel(trace)}</span>
        </div>
        <span className="trace-source-badge">{traceSourceLabel(trace)}</span>
      </div>
      {trace.importMetadata?.fileName && (
        <p className="trace-import-file" title={trace.importMetadata.fileName}>{trace.importMetadata.fileName}</p>
      )}
      <dl>
        <div><dt>Durée</dt><dd>{temporalReplayAvailable ? formatDuration(trace.dureeSec) : 'Non horodaté'}</dd></div>
        <div><dt>Distance</dt><dd>{trace.distanceNm.toFixed(1)} NM</dd></div>
        <div><dt>Points</dt><dd>{trace.positions.length}</dd></div>
      </dl>
      <div className="trace-actions">
        <Button
          variant="primary"
          disabled={!replayAvailable || replayDisabled || isExporting}
          onClick={() => onOpenReplay(trace.id)}
          title={!replayAvailable ? 'Trace trop courte pour le replay.' : replayDisabled ? 'Arrêtez le suivi GPS pour lancer le replay.' : temporalReplayAvailable ? 'Ouvrir le replay' : 'Consulter la carte et le profil sans lecture temporelle'}
        >Replay</Button>
        <Button variant="secondary" disabled={isExporting} onClick={() => runExport('gpx')}>Exporter GPX</Button>
        <Button variant="ghost" disabled={isExporting} onClick={() => runExport('json')}>JSON secours</Button>
        <Button variant="ghost" disabled={isExporting} onClick={() => onDelete(trace.id)}>Supprimer</Button>
      </div>
      {!temporalReplayAvailable && <p className="trace-timing-note">Horodatage absent ou incomplet : lecture temporelle désactivée.</p>}
      {exportStatus && <p className="trace-export-status">{exportStatus}</p>}
    </article>
  );
}
