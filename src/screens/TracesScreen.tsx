import { useState } from 'react';
import type { Trace } from '../domain/trace.types';
import type { TraceSaveResult, TraceStorageMode } from '../services/storage/traceStorage';
import { Page } from '../components/layout/Page';
import { TraceListItem } from '../components/traces/TraceListItem';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

interface TracesScreenProps {
  traces: Trace[];
  onDeleteTrace: (traceId: string) => Promise<TraceSaveResult>;
  isLoading: boolean;
  storageMode: TraceStorageMode;
  storageMessage: string | null;
}

export function TracesScreen({ traces, onDeleteTrace, isLoading, storageMode, storageMessage }: TracesScreenProps) {
  const [traceToDelete, setTraceToDelete] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

  return (
    <Page title="Mes traces" subtitle="Traces locales sauvegardées sur cet appareil.">
      <div className="traces-list">
        {storageMessage && (
          <p className={`trace-storage-status ${storageMode === 'localstorage' ? 'warning' : ''}`} role="status">
            {storageMessage}
          </p>
        )}
        {deleteStatus && <p className="trace-storage-status" role="status">{deleteStatus}</p>}
        {isLoading && <EmptyState title="Chargement des traces" text="Lecture du stockage local en cours." />}
        {!isLoading && traces.length === 0 && <EmptyState title="Aucune trace sauvegardée" text="Démarre le suivi GPS ou la simulation, puis arrête et sauvegarde la trace." />}
        {traces.map((trace) => (
          <TraceListItem key={trace.id} trace={trace} onDelete={() => setTraceToDelete(trace.id)} />
        ))}
      </div>
      <ConfirmDialog
        open={traceToDelete !== null}
        title="Supprimer la trace ?"
        message="La suppression est locale et définitive sur cet appareil."
        confirmLabel="Supprimer"
        onCancel={() => setTraceToDelete(null)}
        onConfirm={() => {
          const id = traceToDelete;
          setTraceToDelete(null);
          if (!id) return;
          void onDeleteTrace(id).then((result) => setDeleteStatus(result.message));
        }}
      />
    </Page>
  );
}
