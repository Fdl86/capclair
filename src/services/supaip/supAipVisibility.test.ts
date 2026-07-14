import { describe, expect, it } from 'vitest';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { fromLonLat } from 'ol/proj';
import {
  applySupAipVisibility,
  isSupAipFeatureVisible,
  nextSupAipDisplayMode,
  normalizeSupAipVisibilitySettings
} from './supAipVisibility';
import type { SupAipLayer } from '../../mapLayers/supAipLayer';

function squareFeature(longitude: number, latitude: number, halfSizeMeters = 1500) {
  const [x, y] = fromLonLat([longitude, latitude]);
  return new Feature(new Polygon([[
    [x - halfSizeMeters, y - halfSizeMeters],
    [x + halfSizeMeters, y - halfSizeMeters],
    [x + halfSizeMeters, y + halfSizeMeters],
    [x - halfSizeMeters, y + halfSizeMeters],
    [x - halfSizeMeters, y - halfSizeMeters]
  ]]));
}

describe('SUP AIP visibility settings', () => {
  it('normalizes invalid values and cycles through the three modes', () => {
    expect(normalizeSupAipVisibilitySettings({ mode: 'route', routeCorridorNm: 999, endpointRadiusNm: -4 })).toEqual({
      mode: 'route',
      routeCorridorNm: 50,
      endpointRadiusNm: 5
    });
    expect(nextSupAipDisplayMode('off')).toBe('route');
    expect(nextSupAipDisplayMode('route')).toBe('all');
    expect(nextSupAipDisplayMode('all')).toBe('off');
  });

  it('filters only by horizontal route proximity', () => {
    const near = squareFeature(2.0, 46.0);
    const far = squareFeature(4.0, 48.0);
    const layer = new VectorLayer({ source: new VectorSource({ features: [near, far] }) }) as SupAipLayer;
    const route = [
      { latitude: 45.9, longitude: 1.9 },
      { latitude: 46.1, longitude: 2.1 }
    ];

    expect(applySupAipVisibility(layer, route, { mode: 'route', routeCorridorNm: 15, endpointRadiusNm: 25 })).toBe(1);
    expect(isSupAipFeatureVisible(near)).toBe(true);
    expect(isSupAipFeatureVisible(far)).toBe(false);

    expect(applySupAipVisibility(layer, route, { mode: 'all', routeCorridorNm: 15, endpointRadiusNm: 25 })).toBe(2);
    expect(applySupAipVisibility(layer, route, { mode: 'off', routeCorridorNm: 15, endpointRadiusNm: 25 })).toBe(0);
  });
});
