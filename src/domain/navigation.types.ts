export type NavPointType = 'depart' | 'waypoint' | 'destination';
export type NavPointSource = 'aerodrome' | 'manual';

export interface NavPoint {
  id: string;
  nom: string;
  code?: string;
  type: NavPointType;
  source?: NavPointSource;
  latitude: number;
  longitude: number;
  elevationFt?: number | null;
  magneticVariationDeg?: number | null;
}

export interface BranchWind {
  directionDeg: number;
  speedKt: number;
  sourceTimeIso?: string;
  provider?: string;
  ageMinutes?: number;
}

export interface FlightProfile {
  tasKt: number;
  defaultAltitudeFt: number;
  departureTimeIso: string;
}

export interface NavBranch {
  id: string;
  from: string;
  to: string;
  distanceNm: number;
  routeVraie: number;
  magneticVariationDeg: number;
  routeMagnetique: number;
  altitudeFt: number;
  wind?: BranchWind | null;
  derive: number;
  capVrai: number;
  capCorrige: number;
  vitesseSol: number;
  tempsBrancheMin: number;
  estimatedStartIso: string;
  estimatedMidIso: string;
  estimatedArrivalIso: string;
  frequencyMhz?: string;
  remarks?: string;
}

export interface NavRoute {
  id: string;
  nom: string;
  points: NavPoint[];
  branches: NavBranch[];
  distanceTotale: number;
  tempsEstimeMin: number;
  vitesseSolKt: number;
  profile: FlightProfile;
  branchAltitudeById: Record<string, number>;
  branchWindById: Record<string, BranchWind>;
  dateModification: string;
}
