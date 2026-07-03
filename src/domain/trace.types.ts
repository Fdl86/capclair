import type { GpsPosition, GpsTraceDiagnostics } from './gps.types';

export interface Trace {
  id: string;
  routeId: string;
  routeName: string;
  date: string;
  positions: GpsPosition[];
  dureeSec: number;
  distanceNm: number;
  diagnostics?: GpsTraceDiagnostics;
}
