import { describe, expect, it } from 'vitest';
import { clearMapViewState, readMapViewState, writeMapViewState } from './mapViewState';

describe('mapViewState', () => {
  it('stores independent snapshots per map', () => {
    clearMapViewState('planning-test');
    clearMapViewState('tracking-test');
    writeMapViewState('planning-test', { centerLonLat: [1.2, 46.4], zoom: 8.5, rotation: 0, routeSignature: 'a' });
    writeMapViewState('tracking-test', { centerLonLat: [2.2, 47.4], zoom: 11, rotation: 0.4, routeSignature: 'b' });
    expect(readMapViewState('planning-test')?.zoom).toBe(8.5);
    expect(readMapViewState('tracking-test')?.zoom).toBe(11);
  });

  it('clamps invalid zoom values', () => {
    clearMapViewState('clamp-test');
    writeMapViewState('clamp-test', { centerLonLat: [0, 46], zoom: 99, rotation: 0 });
    expect(readMapViewState('clamp-test')?.zoom).toBe(14);
  });
});
