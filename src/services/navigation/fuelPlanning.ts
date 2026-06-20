import type { AircraftProfile, FuelLine, FuelPlanConfig, FuelPlanSummary, FuelSummary } from '../../domain/aircraft.types';
import type { NavRoute } from '../../domain/navigation.types';

function round1(value: number) {
  return Number(value.toFixed(1));
}

function safeMinute(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function safeLiter(value: number) {
  return Number.isFinite(value) ? Math.max(0, round1(value)) : 0;
}

function makeLine(label: string, minutes: number, fuelPerMinuteL: number, editable = false): FuelLine {
  const safeMin = safeMinute(minutes);
  return {
    label,
    minutes: safeMin,
    liters: safeLiter(safeMin * fuelPerMinuteL),
    editable
  };
}

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

export function computeFuelPlan(
  route: NavRoute,
  aircraft: AircraftProfile,
  config: FuelPlanConfig,
  diversionMinutes: number
): FuelPlanSummary {
  const fuelPerHourL = Math.max(0, aircraft.fuelBurnLh);
  const fuelPerMinuteL = fuelPerHourL > 0 ? fuelPerHourL / 60 : 0;
  const routeMinutes = safeMinute(route.tempsEstimeMin);
  const diversionMin = safeMinute(diversionMinutes);

  const routeLine = makeLine('Trajet + vent', routeMinutes, fuelPerMinuteL);
  const taxiDepartureLine = makeLine('Roulage départ', config.taxiDepartureMin, fuelPerMinuteL, true);
  const arrivalLine = makeLine('Arrivée', config.arrivalMin, fuelPerMinuteL, true);
  const diversionLine = makeLine('Déroutement', diversionMin, fuelPerMinuteL);
  const alternateArrivalLine = makeLine('Arr. déroutement', config.alternateArrivalMin, fuelPerMinuteL, true);
  const finalReserveLine = makeLine('Réserve finale', config.finalReserveMin, fuelPerMinuteL, true);
  const marginLine = makeLine('Marge', config.marginMin, fuelPerMinuteL, true);

  const totalMinimumMinutes = routeLine.minutes
    + taxiDepartureLine.minutes
    + arrivalLine.minutes
    + diversionLine.minutes
    + alternateArrivalLine.minutes
    + finalReserveLine.minutes
    + marginLine.minutes;

  const totalMinimumLine = makeLine('Total minimum', totalMinimumMinutes, fuelPerMinuteL);
  const regulatoryLiters = Math.ceil(totalMinimumLine.liters);
  const regulatoryLine: FuelLine = {
    label: 'Vol réglementaire',
    minutes: totalMinimumLine.minutes,
    liters: regulatoryLiters
  };

  const fuelOnBoardL = safeLiter(config.fuelOnBoardL);
  const enduranceMinutes = fuelPerMinuteL > 0 ? Math.floor(fuelOnBoardL / fuelPerMinuteL) : 0;
  const timeLimitLine: FuelLine = {
    label: 'Heure limite',
    minutes: enduranceMinutes,
    liters: fuelOnBoardL
  };

  return {
    fuelPerHourL,
    fuelPerMinuteL,
    unusableFuelL: safeLiter(aircraft.unusableFuelL ?? 0),
    routeMinutes,
    diversionMinutes: diversionMin,
    fuelOnBoardL,
    enduranceMinutes,
    remainingAfterMinimumL: safeLiter(fuelOnBoardL - regulatoryLiters),
    lines: {
      route: routeLine,
      taxiDeparture: taxiDepartureLine,
      arrival: arrivalLine,
      diversion: diversionLine,
      alternateArrival: alternateArrivalLine,
      finalReserve: finalReserveLine,
      margin: marginLine,
      totalMinimum: totalMinimumLine,
      regulatory: regulatoryLine,
      timeLimit: timeLimitLine
    }
  };
}
