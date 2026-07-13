import { describe, expect, it } from 'vitest';
import type { NavLogExportSnapshot } from '../src/services/export/navLogExport.types';
import { navLogFileName } from '../src/services/export/navLogFileName';

function snapshot(departure: string, destination: string, date = '2026-07-12T08:00:00.000Z'): NavLogExportSnapshot {
  return {
    schemaVersion: 1,
    documentDateIso: date,
    departure: { code: departure, altitudeFt: null, runway: null, qnhHpa: null, radio: null },
    destination: { code: destination, altitudeFt: null, runway: null, qnhHpa: null, radio: null },
    aircraft: {
      factorBase: null, fuelBurnLh: null, fuelBurnLmin: null, unusableFuelL: null,
      vsKt: null, vs0Kt: null, vfeKt: null, vfinMaxKt: null,
      hourMeterDeparture: null, hourMeterArrival: null, blockTimeDeparture: null, blockTimeArrival: null
    },
    fuelPlan: {
      routeMinutes: null, taxiDepartureMinutes: 8, arrivalMinutes: 12, diversionMinutes: null,
      alternateArrivalMinutes: 12, marginMinutes: null, finalReserveMinutes: null,
      totalHours: null, regulatoryFuelL: null, fuelOnBoardL: null, flightTimeHours: null, timeLimitHours: null
    },
    branches: [],
    totals: { distanceNm: null, timeStillAirMinutes: null, timeWithWindMinutes: null, eta: null },
    reservoirRows: [null, null, null, null],
    omittedBranchCount: 0,
    warnings: []
  };
}

describe('nav log file name', () => {
  it('uses the deterministic route and date format', () => {
    expect(navLogFileName(snapshot('LFBI', 'LFOO'))).toBe('CAP-CLAIR_LOG-NAV_LFBI-LFOO_2026-07-12.pdf');
  });

  it('removes accents and unsafe characters', () => {
    expect(navLogFileName(snapshot('Départ / test', 'Arrivée: nord')))
      .toBe('CAP-CLAIR_LOG-NAV_DEPART-TEST-ARRIVEE-NORD_2026-07-12.pdf');
  });
});
