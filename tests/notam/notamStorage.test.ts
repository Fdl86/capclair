import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PibAnalysis } from '../../src/domain/notam.types';
import { clearStoredBriefing, loadStoredBriefing, storeBriefing } from '../../src/services/notam/notamStorage';

const analysis = {
  schemaVersion: 1,
  id: 'pib-storage-test',
  rawText: 'LFFA-B0001/26',
  notams: [],
  reconciliations: []
} as unknown as PibAnalysis;

describe('NOTAM PIB local storage fallback', () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps only the latest valid analysis and deletes it immediately', async () => {
    await storeBriefing(analysis);
    expect(await loadStoredBriefing()).toMatchObject({ id: 'pib-storage-test', schemaVersion: 1 });

    await storeBriefing({ ...analysis, id: 'pib-storage-test-2' });
    expect(await loadStoredBriefing()).toMatchObject({ id: 'pib-storage-test-2' });

    await clearStoredBriefing();
    expect(await loadStoredBriefing()).toBeNull();
  });

  it('rejects malformed local data', async () => {
    localStorage.setItem('capclair.notamPib.latest.v1', JSON.stringify({ schemaVersion: 9, rawText: 'bad' }));
    expect(await loadStoredBriefing()).toBeNull();
  });
});
