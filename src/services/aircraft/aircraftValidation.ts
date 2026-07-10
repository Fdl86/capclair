import type { AircraftProfile } from '../../domain/aircraft.types';

export const AIRCRAFT_LIMITS = {
  cruiseTasKt: { min: 45, max: 220 },
  fuelBurnLh: { min: 1, max: 200 },
  totalFuelCapacityL: { min: 0, max: 1000 },
  unusableFuelL: { min: 0, max: 1000 },
  reserveMinutes: { min: 0, max: 180 },
  speedKt: { min: 30, max: 250 },
  verticalRateFpm: { min: 100, max: 3000 }
} as const;

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function rounded(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function clampAircraftTasKt(value: number): number {
  return Math.round(clampNumber(value, AIRCRAFT_LIMITS.cruiseTasKt.min, AIRCRAFT_LIMITS.cruiseTasKt.max));
}

export function sanitizeAircraftProfile(profile: AircraftProfile): AircraftProfile {
  const totalCapacityL = rounded(clampNumber(
    profile.usableFuelL,
    AIRCRAFT_LIMITS.totalFuelCapacityL.min,
    AIRCRAFT_LIMITS.totalFuelCapacityL.max
  ), 1);
  const unusableFuelL = rounded(clampNumber(
    profile.unusableFuelL ?? 0,
    AIRCRAFT_LIMITS.unusableFuelL.min,
    Math.min(AIRCRAFT_LIMITS.unusableFuelL.max, totalCapacityL)
  ), 1);
  const model = profile.model.trim() || 'Avion';
  const registration = profile.registration.trim().toUpperCase();

  return {
    ...profile,
    model,
    registration,
    label: registration ? `${model} ${registration}` : model,
    cruiseTasKt: clampAircraftTasKt(profile.cruiseTasKt),
    fuelBurnLh: rounded(clampNumber(profile.fuelBurnLh, AIRCRAFT_LIMITS.fuelBurnLh.min, AIRCRAFT_LIMITS.fuelBurnLh.max), 1),
    usableFuelL: totalCapacityL,
    unusableFuelL,
    reserveMinutes: Math.round(clampNumber(profile.reserveMinutes, AIRCRAFT_LIMITS.reserveMinutes.min, AIRCRAFT_LIMITS.reserveMinutes.max)),
    climbSpeedKt: Math.round(clampNumber(profile.climbSpeedKt, AIRCRAFT_LIMITS.speedKt.min, AIRCRAFT_LIMITS.speedKt.max)),
    climbRateFpm: Math.round(clampNumber(profile.climbRateFpm, AIRCRAFT_LIMITS.verticalRateFpm.min, AIRCRAFT_LIMITS.verticalRateFpm.max)),
    descentSpeedKt: Math.round(clampNumber(profile.descentSpeedKt, AIRCRAFT_LIMITS.speedKt.min, AIRCRAFT_LIMITS.speedKt.max)),
    descentRateFpm: Math.round(clampNumber(profile.descentRateFpm, AIRCRAFT_LIMITS.verticalRateFpm.min, AIRCRAFT_LIMITS.verticalRateFpm.max))
  };
}
