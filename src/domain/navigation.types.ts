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

export interface NavBranch {
  id: string;
  from: string;
  to: string;
  distanceNm: number;
  routeVraie: number;
  magneticVariationDeg: number;
  routeMagnetique: number;
  derive: number;
  capCorrige: number;
  vitesseSol: number;
  tempsBrancheMin: number;
}

export interface NavRoute {
  id: string;
  nom: string;
  points: NavPoint[];
  branches: NavBranch[];
  distanceTotale: number;
  tempsEstimeMin: number;
  vitesseSolKt: number;
  dateModification: string;
}
