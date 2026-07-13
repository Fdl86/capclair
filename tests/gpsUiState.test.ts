import { describe, expect, it } from 'vitest';
import { formatRecordingDuration, getRecordingUiState } from '../src/services/gps/gpsUiState';

describe('GPS UI state', () => {
  it('formats the elapsed recording time', () => {
    expect(formatRecordingDuration(3661)).toBe('01:01:01');
  });

  it('shows a recording control while GPS is active', () => {
    expect(getRecordingUiState('active', 61)).toMatchObject({ tone: 'rec', label: 'REC 00:01:01', controlState: 'recording' });
  });

  it('shows the saved state after storage succeeds', () => {
    expect(getRecordingUiState('saved', 61)).toMatchObject({ tone: 'ok', label: 'TRACE SAUVÉE', controlState: 'idle' });
  });
});
