import type { AircraftProfile, FuelSummary } from '../../domain/aircraft.types';
import type { NavRoute } from '../../domain/navigation.types';

export function computeFuelSummary(route: NavRoute, aircraft: AircraftProfile): FuelSummary {
  const routeFuelL = (route.tempsEstimeMin / 60) * aircraft.fuelBurnLh;
  const reserveFuelL = (aircraft.reserveMinutes / 60) * aircraft.fuelBurnLh;
  const totalFuelL = routeFuelL + reserveFuelL;
  const enduranceMinutes = aircraft.fuelBurnLh > 0 ? Math.floor((aircraft.usableFuelL / aircraft.fuelBurnLh) * 60) : 0;

  return {
    routeFuelL: Number(routeFuelL.toFixed(1)),
    reserveFuelL: Number(reserveFuelL.toFixed(1)),
    totalFuelL: Number(totalFuelL.toFixed(1)),
    enduranceMinutes
  };
}
