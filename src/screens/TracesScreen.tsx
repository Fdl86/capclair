import { useRef, useState, type ChangeEvent } from 'react';
import type { Trace } from '../domain/trace.types';
import type { TraceSaveResult, TraceStorageMode } from '../services/storage/traceStorage';
import { Page } from '../components/layout/Page';
import { TraceListItem } from '../components/traces/TraceListItem';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Button } from '../components/ui/Button';

interface TracesScreenProps {
  traces: Trace[];
  onDeleteTrace: (traceId: string) => Promise<TraceSaveResult>;
  onImportGpx: (file: File) => Promise<TraceSaveResult>;
  onOpenReplay: (traceId: string) => void;
  onBack: () => void;
  replayDisabled: boolean;
  isLoading: boolean;
  storageMode: TraceStorageMode;
  storageMessage: string | null;
}

export function TracesScreen({
  traces,
  onDeleteTrace,
  onImportGpx,
  onOpenReplay,
  onBack,
  replayDisabled,
  isLoading,
  storageMode,
  storageMessage
}: TracesScreenProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [traceToDelete, setTraceToDelete] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || importing) return;

    setImporting(true);
    setImportStatus(`Lecture de ${file.name}...`);
    void onImportGpx(file)
      .then((result) => setImportStatus(result.message))
      .catch((error) => {
        setImportStatus(error instanceof Error ? `Import impossible : ${error.message}` : 'Import GPX impossible.');
      })
      .finally(() => setImporting(false));
  };

  return (
    <Page title="Mes traces" subtitle="Traces locales et GPX importés, conservés sur cet appareil.">
      <div className="traces-screen-nav">
        <Button variant="ghost" className="traces-back-button" onClick={onBack} aria-label="Retour au menu Plus">
          <span aria-hidden="true">‹</span> Retour
        </Button>
      </div>
      <div className="trace-import-toolbar">
        <div>
          <strong>Importer un GPX</strong>
          <span>Fichier local uniquement, sans envoi serveur.</span>
        </div>
        <Button
          variant="primary"
          disabled={importing || replayDisabled}
          onClick={() => fileInputRef.current?.click()}
          title={replayDisabled ? 'Arrêtez le suivi GPS avant d’ouvrir un GPX dans Replay.' : 'Importer une trace ou une route GPX'}
        >{importing ? 'Import...' : 'Importer GPX'}</Button>
        <input
          ref={fileInputRef}
          className="trace-file-input"
          type="file"
          accept=".gpx,application/gpx+xml,application/xml,text/xml"
          onChange={handleImport}
        />
      </div>

      <div className="traces-list">
        {storageMessage && (
          <p className={`trace-storage-status ${storageMode === 'localstorage' ? 'warning' : ''}`} role="status">
            {storageMessage}
          </p>
        )}
        {importStatus && <p className="trace-storage-status" role="status">{importStatus}</p>}
        {deleteStatus && <p className="trace-storage-status" role="status">{deleteStatus}</p>}
        {isLoading && <EmptyState title="Chargement des traces" text="Lecture du stockage local en cours." />}
        {!isLoading && traces.length === 0 && <EmptyState title="Aucune trace sauvegardée" text="Démarre le suivi GPS, la simulation, ou importe un fichier GPX." />}
        {traces.map((trace) => (
          <TraceListItem
            key={trace.id}
            trace={trace}
            replayDisabled={replayDisabled}
            onOpenReplay={onOpenReplay}
            onDelete={() => setTraceToDelete(trace.id)}
          />
        ))}
      </div>
      <ConfirmDialog
        open={traceToDelete !== null}
        title="Supprimer la trace ?"
        message="La suppression est locale et définitive sur cet appareil."
        confirmLabel={deleting ? 'Suppression...' : 'Supprimer'}
        confirmDisabled={deleting}
        cancelDisabled={deleting}
        onCancel={() => { if (!deleting) setTraceToDelete(null); }}
        onConfirm={() => {
          const id = traceToDelete;
          if (!id || deleting) return;
          setDeleting(true);
          void onDeleteTrace(id)
            .then((result) => {
              setDeleteStatus(result.message);
              if (result.ok) setTraceToDelete(null);
            })
            .finally(() => setDeleting(false));
        }}
      />
    </Page>
  );
}
