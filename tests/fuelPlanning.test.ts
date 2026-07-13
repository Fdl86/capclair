import { describe, expect, it } from 'vitest';
import type { AircraftProfile, FuelPlanConfig } from '../src/domain/aircraft.types';
import type { NavRoute } from '../src/domain/navigation.types';
import { computeFuelPlan } from '../src/services/navigation/fuelPlanning';

const aircraft: AircraftProfile = {
  id: 'aircraft-test',
  label: 'Avion test',
  registration: 'F-TEST',
  model: 'TEST',
  cruiseTasKt: 95,
  fuelBurnLh: 20,
  usableFuelL: 50,
  unusableFuelL: 2,
  reserveMinutes: 30,
  climbSpeedKt: 75,
  climbRateFpm: 500,
  descentSpeedKt: 90,
  descentRateFpm: 500
};

const config: FuelPlanConfig = {
  taxiDepartureMin: 8,
  arrivalMin: 12,
  alternateArrivalMin: 12,
  finalReserveMin: 30,
  marginLiters: 0
};

function route(minutes: number): NavRoute {
  return {
    id: 'fuel-route',
    nom: 'Fuel route',
    points: [],
    branches: [],
    distanceTotale: 0,
    tempsEstimeMin: minutes,
    vitesseSolKt: 95,
    profile: { tasKt: 95, defaultAltitudeFt: 2500, departureTimeIso: '2026-07-13T10:00:00.000Z' },
    branchAltitudeById: {},
    branchWindById: {},
    weatherAnalysisTimeIso: null,
    dateModification: '2026-07-13T09:00:00.000Z'
  };
}

describe('fuel capacity guard', () => {
  it('reports the exact deficit instead of clamping it to zero', () => {
    const result = computeFuelPlan(route(120), aircraft, config, 20);

    expect(result.usableFuelL).toBe(48);
    expect(result.isCapacitySufficient).toBe(false);
    expect(result.remainingUsableFuelL).toBeLessThan(0);
    expect(result.fuelDeficitL).toBeGreaterThan(0);
    expect(result.fuelDeficitL).toBeCloseTo(Math.abs(result.remainingUsableFuelL), 5);
  });
});
