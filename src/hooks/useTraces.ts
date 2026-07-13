import { useEffect, useState } from 'react';
import type { Trace } from '../domain/trace.types';
import {
  deleteStoredTrace,
  loadStoredTraces,
  saveStoredTrace,
  type TraceSaveResult,
  type TraceStorageMode
} from '../services/storage/traceStorage';
import { normalizeTraceRecord } from '../services/traces/traceValidation';

export function useTraces() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageMode, setStorageMode] = useState<TraceStorageMode>('indexeddb');
  const [storageMessage, setStorageMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStoredTraces()
      .then((result) => {
        if (cancelled) return;
        setTraces(result.traces);
        setStorageMode(result.mode);
        const warnings: string[] = [];
        if (result.mode === 'localstorage') warnings.push('IndexedDB indisponible. Stockage local de secours actif.');
        if (result.discardedCount > 0) warnings.push(`${result.discardedCount} trace(s) locale(s) invalide(s) ont été ignorée(s).`);
        setStorageMessage(warnings.length ? warnings.join(' ') : null);
      })
      .catch((error) => {
        if (cancelled) return;
        setStorageMessage(error instanceof Error ? error.message : 'Chargement des traces impossible.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const saveTrace = async (trace: Trace): Promise<TraceSaveResult> => {
    const result = await saveStoredTrace(trace);
    setStorageMode(result.mode);
    setStorageMessage(result.ok ? result.message : result.message);
    if (result.ok) {
      const normalized = normalizeTraceRecord(trace);
      if (normalized) setTraces((current) => [normalized, ...current.filter((item) => item.id !== normalized.id)].slice(0, 20));
    }
    return result;
  };

  const deleteTrace = async (traceId: string): Promise<TraceSaveResult> => {
    const result = await deleteStoredTrace(traceId);
    setStorageMode(result.mode);
    setStorageMessage(result.message);
    if (result.ok) setTraces((current) => current.filter((trace) => trace.id !== traceId));
    return result;
  };

  return { traces, saveTrace, deleteTrace, isLoading, storageMode, storageMessage };
}
