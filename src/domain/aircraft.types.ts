export interface AircraftProfile {
  id: string;
  label: string;
  registration: string;
  model: string;
  cruiseTasKt: number;
  fuelBurnLh: number;
  usableFuelL: number;
  unusableFuelL?: number;
  reserveMinutes: number;
  climbSpeedKt: number;
  climbRateFpm: number;
  descentSpeedKt: number;
  descentRateFpm: number;
  notes?: string;
}

export interface FuelPlanConfig {
  taxiDepartureMin: number;
  arrivalMin: number;
  alternateArrivalMin: number;
  finalReserveMin: number;
  marginMin: number;
  fuelOnBoardL: number;
}

export interface FuelLine {
  label: string;
  minutes: number;
  liters: number;
  editable?: boolean;
}

export interface FuelPlanSummary {
  fuelPerHourL: number;
  fuelPerMinuteL: number;
  unusableFuelL: number;
  routeMinutes: number;
  diversionMinutes: number;
  lines: {
    route: FuelLine;
    taxiDeparture: FuelLine;
    arrival: FuelLine;
    diversion: FuelLine;
    alternateArrival: FuelLine;
    finalReserve: FuelLine;
    margin: FuelLine;
    totalMinimum: FuelLine;
    regulatory: FuelLine;
    timeLimit: FuelLine;
  };
  fuelOnBoardL: number;
  enduranceMinutes: number;
  remainingAfterMinimumL: number;
}

export interface FuelSummary {
  routeFuelL: number;
  reserveFuelL: number;
  totalFuelL: number;
  enduranceMinutes: number;
}

export const DEFAULT_FUEL_PLAN_CONFIG: FuelPlanConfig = {
  taxiDepartureMin: 8,
  arrivalMin: 12,
  alternateArrivalMin: 12,
  finalReserveMin: 30,
  marginMin: 0,
  fuelOnBoardL: 120
};
