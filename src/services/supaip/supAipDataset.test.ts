import { describe, expect, it } from 'vitest';
import type { SupAipDatasetStatus } from './supAipDataset';
import { isSupAipDatasetStale, supAipDatasetAgeHours } from './supAipDataset';

function status(overrides: Partial<SupAipDatasetStatus> = {}): SupAipDatasetStatus {
  return {
    schemaVersion: 2,
    mode: 'automatic',
    beta: true,
    generatedAt: '2026-07-16T04:00:00Z',
    datasetGeneratedAt: '2026-07-16T04:00:00Z',
    lastSuccessfulCheckAt: '2026-07-19T18:00:00Z',
    sourceUrl: 'https://example.invalid',
    parserVersion: 'test',
    listingPublicationCount: 1,
    zonalPublicationCount: 1,
    mappedPublicationCount: 1,
    featureCount: 1,
    unmappedPublicationCount: 0,
    completeUnmappedPublicationCount: 0,
    partialPublicationCount: 0,
    reusedPublicationCount: 1,
    downloadedPublicationCount: 0,
    staleAfterHours: 36,
    message: 'test',
    ...overrides
  };
}

describe('SUP AIP dataset freshness', () => {
  it('uses the latest successful SIA check, not the content generation date', () => {
    const now = Date.parse('2026-07-19T20:00:00Z');
    expect(supAipDatasetAgeHours(status(), now)).toBe(2);
    expect(isSupAipDatasetStale(status(), now)).toBe(false);
  });

  it('falls back to generatedAt for old compatible status files', () => {
    const now = Date.parse('2026-07-18T18:00:00Z');
    const legacy = status({ lastSuccessfulCheckAt: undefined, generatedAt: '2026-07-16T04:00:00Z' });
    expect(supAipDatasetAgeHours(legacy, now)).toBe(62);
    expect(isSupAipDatasetStale(legacy, now)).toBe(true);
  });
});
