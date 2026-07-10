import type { Trace } from '../../domain/trace.types';

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

function readLegacyTraces(): Trace[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as Trace[]) : [];
  } catch {
    return [];
  }
}

function writeLegacyTraces(traces: Trace[]): void {
  window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(sortTraces(traces).slice(0, MAX_TRACES)));
}

async function loadIndexedDbTraces(): Promise<Trace[]> {
  const db = await openTraceDb();
  try {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const done = transactionDone(transaction);
    const traces = await requestPromise(transaction.objectStore(STORE_NAME).getAll()) as Trace[];
    await done;
    return sortTraces(traces);
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
    const all = await requestPromise(readTransaction.objectStore(STORE_NAME).getAll()) as Trace[];
    await readDone;
    const extras = sortTraces(all).slice(MAX_TRACES);

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
  } finally {
    db.close();
  }
}

async function migrateLegacyTraces(): Promise<void> {
  const legacy = readLegacyTraces();
  if (!legacy.length) return;
  for (const trace of legacy.slice(0, MAX_TRACES)) {
    await saveIndexedDbTrace(trace);
  }
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // La migration est déjà terminée dans IndexedDB. Le reliquat local peut rester sans impact.
  }
}

export async function loadStoredTraces(): Promise<{ traces: Trace[]; mode: TraceStorageMode }> {
  try {
    await migrateLegacyTraces();
    return { traces: await loadIndexedDbTraces(), mode: 'indexeddb' };
  } catch {
    return { traces: sortTraces(readLegacyTraces()), mode: 'localstorage' };
  }
}

export async function saveStoredTrace(trace: Trace): Promise<TraceSaveResult> {
  if (trace.positions.length < 2) {
    return { ok: false, mode: 'indexeddb', message: 'Trace trop courte : au moins deux points GPS sont requis.' };
  }

  try {
    await saveIndexedDbTrace(trace);
    return { ok: true, mode: 'indexeddb', message: 'Trace sauvegardée dans IndexedDB.' };
  } catch (indexedDbError) {
    try {
      const current = readLegacyTraces().filter((item) => item.id !== trace.id);
      writeLegacyTraces([trace, ...current]);
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
    return { ok: true, mode: 'indexeddb', message: 'Trace supprimée.' };
  } catch {
    try {
      const current = readLegacyTraces().filter((trace) => trace.id !== traceId);
      writeLegacyTraces(current);
      return { ok: true, mode: 'localstorage', message: 'Trace supprimée du stockage de secours.' };
    } catch (error) {
      return {
        ok: false,
        mode: 'localstorage',
        message: error instanceof Error ? error.message : 'Suppression impossible.'
      };
    }
  }
}
