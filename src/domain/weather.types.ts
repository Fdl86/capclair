export interface AerodromeWeather {
  icao: string;
  metarRaw?: string;
  tafRaw?: string;
  updatedAtIso?: string;
  source?: string;
  status: 'idle' | 'ok' | 'missing' | 'error';
}
