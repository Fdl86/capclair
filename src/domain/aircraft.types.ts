export interface AircraftProfile {
  id: string;
  label: string;
  registration: string;
  model: string;
  cruiseTasKt: number;
  fuelBurnLh: number;
  usableFuelL: number;
  reserveMinutes: number;
  climbSpeedKt: number;
  climbRateFpm: number;
  descentSpeedKt: number;
  descentRateFpm: number;
  notes?: string;
}

export interface FuelSummary {
  routeFuelL: number;
  reserveFuelL: number;
  totalFuelL: number;
  enduranceMinutes: number;
}
