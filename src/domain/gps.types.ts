export interface GpsPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  vitesse: number | null;
  track: number | null;
  timestamp: number;
  precision: number | null;
}

export type GpsStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'simulating' | 'stopped';
