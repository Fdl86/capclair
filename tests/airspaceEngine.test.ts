import { describe, expect, it } from 'vitest';
import type { AirspaceCatalogItem } from '../src/domain/airspace.types';
import type { NavPoint } from '../src/domain/navigation.types';
import { buildZoneProfilesFromCatalog } from '../src/services/airspace/airspaceEngine';
import { buildRoute } from '../src/services/navigation/routeBuilder';

const points: NavPoint[] = [
  { id: 'dep', nom: 'DEP', code: 'DEP', type: 'depart', latitude: 46, longitude: -0.5 },
  { id: 'arr', nom: 'ARR', code: 'ARR', type: 'destination', latitude: 46, longitude: 0.5 }
];

const narrowZone: AirspaceCatalogItem = {
  id: 'narrow-zone',
  name: 'ZONE ETROITE',
  type: 'R',
  contacts: [],
  parts: [{
    id: 'narrow-part',
    name: 'ZONE ETROITE',
    floorFt: 0,
    ceilingFt: 5000,
    floorLabel: 'SFC',
    ceilingLabel: '5000 ft AMSL',
    classCode: '',
    verticalUncertain: false,
    bbox: [45.99, 0.025, 46.01, 0.035],
    points: [
      [45.99, 0.025],
      [46.01, 0.025],
      [46.01, 0.035],
      [45.99, 0.035]
    ]
  }]
};

describe('airspace exact intersection', () => {
  it('detects a narrow zone crossed between former sampling points', () => {
    const route = buildRoute(points, {
      routeId: 'route-airspace-test',
      profile: {
        tasKt: 95,
        defaultAltitudeFt: 2500,
        departureTimeIso: '2026-07-13T10:00:00.000Z'
      }
    });

    const branch = route.branches[0];
    const profile = buildZoneProfilesFromCatalog(route, [narrowZone])[branch.id];

    expect(profile.blocks).toHaveLength(1);
    expect(profile.primaryBlock?.zoneId).toBe('narrow-zone');
    expect(profile.primaryBlock?.startRatio).toBeCloseTo(0.525, 3);
    expect(profile.primaryBlock?.endRatio).toBeCloseTo(0.535, 3);
    expect(profile.primaryBlock?.containsPlannedAltitude).toBe(true);
  });
});
