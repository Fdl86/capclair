import type { AircraftProfile, FuelLine, FuelPlanConfig, FuelPlanSummary } from '../../domain/aircraft.types';
import { FIXED_FUEL_MINUTES } from '../../domain/aircraft.types';
import type { NavRoute } from '../../domain/navigation.types';

function round1(value: number) {
  return Number(value.toFixed(1));
}

function safeMinute(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function safeNonNegativeLiter(value: number) {
  return Number.isFinite(value) ? Math.max(0, round1(value)) : 0;
}

function makeLine(label: string, minutes: number, fuelPerMinuteL: number, editable = false): FuelLine {
  const safeMin = safeMinute(minutes);
  return {
    label,
    minutes: safeMin,
    liters: safeNonNegativeLiter(safeMin * fuelPerMinuteL),
    editable
  };
}

function usableFuelCapacityL(aircraft: AircraftProfile) {
  const totalCapacityL = safeNonNegativeLiter(aircraft.usableFuelL);
  const unusableFuelL = safeNonNegativeLiter(aircraft.unusableFuelL ?? 0);
  return safeNonNegativeLiter(totalCapacityL - unusableFuelL);
}

function makeLiterLine(label: string, liters: number, editable = false): FuelLine {
  return {
    label,
    minutes: null,
    liters: safeNonNegativeLiter(liters),
    editable
  };
}

export function computeFuelPlan(
  route: NavRoute,
  aircraft: AircraftProfile,
  config: FuelPlanConfig,
  diversionMinutes: number
): FuelPlanSummary {
  const fuelPerHourL = Number.isFinite(aircraft.fuelBurnLh) ? Math.max(0, aircraft.fuelBurnLh) : 0;
  const fuelPerMinuteL = fuelPerHourL > 0 ? fuelPerHourL / 60 : 0;
  const routeMinutes = safeMinute(route.tempsEstimeMin);
  const diversionMin = safeMinute(diversionMinutes);

  const routeLine = makeLine('Trajet + vent', routeMinutes, fuelPerMinuteL);
  const taxiDepartureLine = makeLine('Roulage départ', FIXED_FUEL_MINUTES.taxiDepartureMin, fuelPerMinuteL);
  const arrivalLine = makeLine('Arrivée', FIXED_FUEL_MINUTES.arrivalMin, fuelPerMinuteL);
  const diversionLine = makeLine('Déroutement', diversionMin, fuelPerMinuteL);
  const alternateArrivalLine = makeLine('Arr. déroutement', FIXED_FUEL_MINUTES.alternateArrivalMin, fuelPerMinuteL);
  const finalReserveLine = makeLine('Réserve finale', config.finalReserveMin, fuelPerMinuteL, true);

  const legacyMarginLiters = typeof config.marginMin === 'number' ? safeMinute(config.marginMin) * fuelPerMinuteL : 0;
  const marginLiters = typeof config.marginLiters === 'number' ? config.marginLiters : legacyMarginLiters;
  const marginLine = makeLiterLine('Marge', marginLiters, true);

  const totalNecessaryMinutes = routeLine.minutes!
    + taxiDepartureLine.minutes!
    + arrivalLine.minutes!
    + diversionLine.minutes!
    + alternateArrivalLine.minutes!
    + finalReserveLine.minutes!;

  const totalNecessaryLiters = routeLine.liters
    + taxiDepartureLine.liters
    + arrivalLine.liters
    + diversionLine.liters
    + alternateArrivalLine.liters
    + finalReserveLine.liters;

  const totalNecessaryLine: FuelLine = {
    label: 'Total nécessaire',
    minutes: totalNecessaryMinutes,
    liters: safeNonNegativeLiter(totalNecessaryLiters)
  };

  const exactRequiredLiters = safeNonNegativeLiter(totalNecessaryLine.liters + marginLine.liters);
  const emportLiters = Math.ceil(exactRequiredLiters);
  const requiredMinutes = fuelPerMinuteL > 0 ? Math.floor(emportLiters / fuelPerMinuteL) : 0;

  const fuelRequiredLine: FuelLine = {
    label: 'Emport carburant',
    minutes: requiredMinutes,
    liters: emportLiters
  };

  const unusableFuelL = safeNonNegativeLiter(aircraft.unusableFuelL ?? 0);
  const usableFuelL = usableFuelCapacityL(aircraft);
  const enduranceMinutes = fuelPerMinuteL > 0 ? Math.floor(usableFuelL / fuelPerMinuteL) : 0;
  const timeLimitLine: FuelLine = {
    label: 'Autonomie capacité utile',
    minutes: enduranceMinutes,
    liters: usableFuelL
  };

  const remainingUsableFuelL = round1(usableFuelL - emportLiters);
  const fuelDeficitL = remainingUsableFuelL < 0 ? Math.abs(remainingUsableFuelL) : 0;
  const isFuelDataValid = fuelPerHourL > 0
    && aircraft.usableFuelL >= 0
    && unusableFuelL <= aircraft.usableFuelL;

  return {
    fuelPerHourL,
    fuelPerMinuteL,
    unusableFuelL,
    usableFuelL,
    routeMinutes,
    diversionMinutes: diversionMin,
    fuelRequiredL: emportLiters,
    enduranceMinutes,
    remainingUsableFuelL,
    fuelDeficitL,
    isCapacitySufficient: remainingUsableFuelL >= 0,
    isFuelDataValid,
    lines: {
      route: routeLine,
      taxiDeparture: taxiDepartureLine,
      arrival: arrivalLine,
      diversion: diversionLine,
      alternateArrival: alternateArrivalLine,
      finalReserve: finalReserveLine,
      totalNecessary: totalNecessaryLine,
      margin: marginLine,
      fuelRequired: fuelRequiredLine,
      timeLimit: timeLimitLine
    }
  };
}
