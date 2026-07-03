export interface GpsPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  vitesse: number | null;
  track: number | null;
  timestamp: number;
  precision: number | null;
}

export type GpsStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'simulating' | 'simulation-complete' | 'stopped';

// Compteurs live pour diagnostiquer les trous de trace : combien de fixes
// bruts sont réellement reçus du navigateur, et pour quelle raison certains
// n'atterrissent jamais dans la trace enregistrée.
export interface GpsTraceDiagnostics {
  rawReceived: number;
  rejectedPrecision: number;
  rejectedRedundant: number;
  rejectedSpeed: number;
  forcedResync: number;
  tracePoints: number;
}
