import { describe, expect, it } from 'vitest';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { fromLonLat } from 'ol/proj';
import {
  applySupAipVisibility,
  formatSupAipAltitudeCeiling,
  isSupAipFeatureVisible,
  isSupAipWithinAltitudeCeiling,
  nextSupAipDisplayMode,
  normalizeSupAipVisibilitySettings,
  supAipAltitudeFromSliderValue,
  supAipAltitudeSliderValue,
  supAipLowerLimitFeet
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

function setVertical(feature: Feature<Polygon>, lowerLimit: string, extracted = true) {
  feature.setProperties({ lowerLimit, verticalLimitsExtracted: extracted });
  return feature;
}

const routeSettings = {
  mode: 'route' as const,
  routeCorridorNm: 15,
  endpointRadiusNm: 25,
  maxDisplayFlightLevel: 115
};

describe('SUP AIP visibility settings', () => {
  it('normalizes invalid values and cycles through the three modes', () => {
    expect(normalizeSupAipVisibilitySettings({ mode: 'route', routeCorridorNm: 999, endpointRadiusNm: -4, maxDisplayFlightLevel: 117 })).toEqual({
      mode: 'route',
      routeCorridorNm: 50,
      endpointRadiusNm: 5,
      maxDisplayFlightLevel: 115
    });
    expect(normalizeSupAipVisibilitySettings({ maxDisplayFlightLevel: null }).maxDisplayFlightLevel).toBeNull();
    expect(nextSupAipDisplayMode('off')).toBe('route');
    expect(nextSupAipDisplayMode('route')).toBe('all');
    expect(nextSupAipDisplayMode('all')).toBe('off');
  });

  it('converts the altitude slider and formats its label', () => {
    expect(supAipAltitudeSliderValue(115)).toBe(115);
    expect(supAipAltitudeSliderValue(null)).toBe(205);
    expect(supAipAltitudeFromSliderValue(115)).toBe(115);
    expect(supAipAltitudeFromSliderValue(205)).toBeNull();
    expect(formatSupAipAltitudeCeiling(115)).toBe('FL115');
    expect(formatSupAipAltitudeCeiling(null)).toBe('TOUTES');
  });

  it('parses only lower limits that are safe to compare', () => {
    expect(supAipLowerLimitFeet('SFC')).toBe(0);
    expect(supAipLowerLimitFeet('GND')).toBe(0);
    expect(supAipLowerLimitFeet('FL 125')).toBe(12500);
    expect(supAipLowerLimitFeet('2500 ft AMSL')).toBe(2500);
    expect(supAipLowerLimitFeet('1000 m AMSL')).toBeCloseTo(3280.84);
    expect(supAipLowerLimitFeet('1500 ft AGL')).toBeNull();
    expect(supAipLowerLimitFeet('2000 ft ASFC')).toBeNull();
    expect(supAipLowerLimitFeet('')).toBeNull();
  });

  it('keeps unknown, AGL and missing vertical limits visible conservatively', () => {
    const low = setVertical(squareFeature(2, 46), 'SFC');
    const high = setVertical(squareFeature(2, 46), 'FL125');
    const agl = setVertical(squareFeature(2, 46), '1500 ft AGL');
    const missing = setVertical(squareFeature(2, 46), '', false);

    expect(isSupAipWithinAltitudeCeiling(low, 115)).toBe(true);
    expect(isSupAipWithinAltitudeCeiling(high, 115)).toBe(false);
    expect(isSupAipWithinAltitudeCeiling(agl, 115)).toBe(true);
    expect(isSupAipWithinAltitudeCeiling(missing, 115)).toBe(true);
    expect(isSupAipWithinAltitudeCeiling(high, null)).toBe(true);
  });

  it('combines horizontal route proximity and the selected ceiling', () => {
    const nearLow = setVertical(squareFeature(2.0, 46.0), 'SFC');
    const nearHigh = setVertical(squareFeature(2.02, 46.02), 'FL125');
    const far = setVertical(squareFeature(4.0, 48.0), 'SFC');
    const layer = new VectorLayer({ source: new VectorSource({ features: [nearLow, nearHigh, far] }) }) as SupAipLayer;
    const route = [
      { latitude: 45.9, longitude: 1.9 },
      { latitude: 46.1, longitude: 2.1 }
    ];

    expect(applySupAipVisibility(layer, route, routeSettings)).toBe(1);
    expect(isSupAipFeatureVisible(nearLow)).toBe(true);
    expect(isSupAipFeatureVisible(nearHigh)).toBe(false);
    expect(isSupAipFeatureVisible(far)).toBe(false);

    expect(applySupAipVisibility(layer, route, { ...routeSettings, mode: 'all' })).toBe(2);
    expect(applySupAipVisibility(layer, route, { ...routeSettings, mode: 'all', maxDisplayFlightLevel: null })).toBe(3);
    expect(applySupAipVisibility(layer, route, { ...routeSettings, mode: 'off' })).toBe(0);
  });
});
