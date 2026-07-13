import type { Trace } from '../../domain/trace.types';
import { normalizeTraceRecord, normalizeTraceRecords } from '../traces/traceValidation';

const DB_NAME = 'capclair-web';
const DB_VERSION = 1;
const STORE_NAME = 'traces';
const LEGACY_STORAGE_KEY = 'capclair.traces';
const MAX_TRACES = 20;

export type TraceStorageMode = 'indexeddb' | 'localstorage';

export interface TraceSaveResult {
  ok: boolean;
  message: string;
  mode: TraceStorageMode;
}

export interface TraceLoadResult {
  traces: Trace[];
  mode: TraceStorageMode;
  discardedCount: number;
}

function sortTraces(traces: Trace[]): Trace[] {
  return [...traces].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function requestPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Erreur IndexedDB'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Transaction IndexedDB impossible'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Transaction IndexedDB annulée'));
  });
}

function openTraceDb(): Promise<IDBDatabase> {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB indisponible'));

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Ouverture IndexedDB impossible'));
  });
}

function readLegacyValues(): unknown[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function readLegacyTraces(): { traces: Trace[]; discardedCount: number } {
  return normalizeTraceRecords(readLegacyValues());
}

function writeLegacyTraces(traces: Trace[]): void {
  window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(sortTraces(traces).slice(0, MAX_TRACES)));
}

async function loadIndexedDbTraces(): Promise<{ traces: Trace[]; discardedCount: number }> {
  const db = await openTraceDb();
  try {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const done = transactionDone(transaction);
    const values = await requestPromise(transaction.objectStore(STORE_NAME).getAll()) as unknown[];
    await done;
    const normalized = normalizeTraceRecords(values);
    return { traces: sortTraces(normalized.traces), discardedCount: normalized.discardedCount };
  } finally {
    db.close();
  }
}

async function saveIndexedDbTrace(trace: Trace): Promise<void> {
  const db = await openTraceDb();
  try {
    const writeTransaction = db.transaction(STORE_NAME, 'readwrite');
    const writeDone = transactionDone(writeTransaction);
    writeTransaction.objectStore(STORE_NAME).put(trace);
    await writeDone;

    const readTransaction = db.transaction(STORE_NAME, 'readonly');
    const readDone = transactionDone(readTransaction);
    const all = await requestPromise(readTransaction.objectStore(STORE_NAME).getAll()) as unknown[];
    await readDone;
    const normalized = normalizeTraceRecords(all).traces;
    const extras = sortTraces(normalized).slice(MAX_TRACES);

    if (extras.length) {
      const pruneTransaction = db.transaction(STORE_NAME, 'readwrite');
      const pruneDone = transactionDone(pruneTransaction);
      const store = pruneTransaction.objectStore(STORE_NAME);
      extras.forEach((item) => store.delete(item.id));
      await pruneDone;
    }
  } finally {
    db.close();
  }
}

async function deleteIndexedDbTrace(traceId: string): Promise<void> {
  const db = await openTraceDb();
  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(STORE_NAME).delete(traceId);
    await done;

    const verifyTransaction = db.transaction(STORE_NAME, 'readonly');
    const verifyDone = transactionDone(verifyTransaction);
    const remaining = await requestPromise(verifyTransaction.objectStore(STORE_NAME).get(traceId));
    await verifyDone;
    if (remaining !== undefined) throw new Error('La trace est toujours présente dans IndexedDB après suppression.');
  } finally {
    db.close();
  }
}

function deleteLegacyTrace(traceId: string): void {
  const current = readLegacyTraces().traces.filter((trace) => trace.id !== traceId);
  writeLegacyTraces(current);
}

async function migrateLegacyTraces(): Promise<number> {
  const legacy = readLegacyTraces();
  if (!legacy.traces.length) return legacy.discardedCount;
  for (const trace of legacy.traces.slice(0, MAX_TRACES)) {
    await saveIndexedDbTrace(trace);
  }
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Les données validées sont déjà dans IndexedDB. Le reliquat local est sans impact.
  }
  return legacy.discardedCount;
}

export async function loadStoredTraces(): Promise<TraceLoadResult> {
  try {
    const legacyDiscarded = await migrateLegacyTraces();
    const indexed = await loadIndexedDbTraces();
    return {
      traces: indexed.traces,
      mode: 'indexeddb',
      discardedCount: legacyDiscarded + indexed.discardedCount
    };
  } catch {
    const legacy = readLegacyTraces();
    return { traces: sortTraces(legacy.traces), mode: 'localstorage', discardedCount: legacy.discardedCount };
  }
}

export async function saveStoredTrace(trace: Trace): Promise<TraceSaveResult> {
  const normalized = normalizeTraceRecord(trace);
  if (!normalized) {
    return { ok: false, mode: 'indexeddb', message: 'Trace invalide ou trop courte : au moins deux points GPS valides sont requis.' };
  }

  try {
    await saveIndexedDbTrace(normalized);
    return { ok: true, mode: 'indexeddb', message: 'Trace sauvegardée dans IndexedDB.' };
  } catch (indexedDbError) {
    try {
      const current = readLegacyTraces().traces.filter((item) => item.id !== normalized.id);
      writeLegacyTraces([normalized, ...current]);
      return { ok: true, mode: 'localstorage', message: 'Trace sauvegardée en stockage local de secours.' };
    } catch (localStorageError) {
      const message = localStorageError instanceof Error
        ? localStorageError.message
        : indexedDbError instanceof Error
          ? indexedDbError.message
          : 'Stockage local indisponible ou saturé.';
      return { ok: false, mode: 'localstorage', message: `Sauvegarde impossible : ${message}` };
    }
  }
}

export async function deleteStoredTrace(traceId: string): Promise<TraceSaveResult> {
  try {
    await deleteIndexedDbTrace(traceId);
    try {
      deleteLegacyTrace(traceId);
    } catch {
      // IndexedDB est la source principale et la suppression y est vérifiée.
    }
    return { ok: true, mode: 'indexeddb', message: 'Trace supprimée.' };
  } catch (indexedDbError) {
    try {
      deleteLegacyTrace(traceId);
    } catch {
      // Le message principal doit rester celui de l'échec IndexedDB.
    }
    return {
      ok: false,
      mode: 'indexeddb',
      message: indexedDbError instanceof Error
        ? `Suppression IndexedDB impossible : ${indexedDbError.message}`
        : 'Suppression IndexedDB impossible. La trace a été conservée dans la liste.'
    };
  }
}
