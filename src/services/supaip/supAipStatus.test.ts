import { describe, expect, it } from 'vitest';
import { getSupAipVisualStatus } from './supAipStatus';

const base = {
  validFrom: '2026-07-14T00:00:00Z',
  validTo: '2026-07-15T23:59:59Z'
};

describe('getSupAipVisualStatus', () => {
  it('marks future publications as upcoming', () => {
    expect(getSupAipVisualStatus({ ...base, validFrom: '2026-07-16T00:00:00Z' }, new Date('2026-07-14T12:00:00Z'))).toBe('upcoming');
  });

  it('never presents a NOTAM-dependent zone as confirmed active', () => {
    expect(getSupAipVisualStatus({ ...base, activationMode: 'notam' }, new Date('2026-07-14T12:00:00Z'))).toBe('conditional');
  });

  it('detects an explicit published activation window', () => {
    expect(getSupAipVisualStatus({
      ...base,
      activationMode: 'windows',
      activationWindowsUtc: [{ from: '2026-07-14T10:00:00Z', to: '2026-07-14T14:00:00Z' }]
    }, new Date('2026-07-14T12:00:00Z'))).toBe('active');
  });

  it('keeps a valid publication informational outside its activation window', () => {
    expect(getSupAipVisualStatus({
      ...base,
      activationMode: 'windows',
      activationWindowsUtc: [{ from: '2026-07-14T10:00:00Z', to: '2026-07-14T11:00:00Z' }]
    }, new Date('2026-07-14T12:00:00Z'))).toBe('published');
  });
});
