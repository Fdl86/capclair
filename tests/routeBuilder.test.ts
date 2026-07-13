import { describe, expect, it } from 'vitest';
import type { NavPoint } from '../src/domain/navigation.types';
import { buildRoute, createDefaultRoute, replaceRouteEndpoint } from '../src/services/navigation/routeBuilder';

const departure: NavPoint = { id: 'dep-old', nom: 'AAAA', code: 'AAAA', type: 'depart', latitude: 46, longitude: 0 };
const waypoint1: NavPoint = { id: 'wp1', nom: 'WP1', code: 'WP1', type: 'waypoint', source: 'manual', latitude: 46.1, longitude: 0.1 };
const waypoint2: NavPoint = { id: 'wp2', nom: 'WP2', code: 'WP2', type: 'waypoint', source: 'manual', latitude: 46.2, longitude: 0.2 };
const destination: NavPoint = { id: 'arr-old', nom: 'BBBB', code: 'BBBB', type: 'destination', latitude: 46.3, longitude: 0.3 };

describe('route endpoint replacement', () => {
  it('preserves intermediate waypoints when departure and destination change', () => {
    const newDeparture: NavPoint = { ...departure, id: 'dep-new', code: 'CCCC', nom: 'CCCC' };
    const newDestination: NavPoint = { ...destination, id: 'arr-new', code: 'DDDD', nom: 'DDDD' };

    const afterDeparture = replaceRouteEndpoint([departure, waypoint1, waypoint2, destination], newDeparture, 'depart');
    const afterDestination = replaceRouteEndpoint(afterDeparture, newDestination, 'destination');

    expect(afterDestination.map((point) => point.id)).toEqual(['dep-new', 'wp1', 'wp2', 'arr-new']);
    expect(afterDestination.map((point) => point.type)).toEqual(['depart', 'waypoint', 'waypoint', 'destination']);
    expect(buildRoute(afterDestination, { routeId: 'stable-route' }).branches).toHaveLength(3);
  });

  it('creates a unique identifier for every new navigation', () => {
    expect(createDefaultRoute().id).not.toBe(createDefaultRoute().id);
  });
});
