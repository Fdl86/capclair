export type NavPointType = 'depart' | 'waypoint' | 'destination';

export interface NavPoint {
  id: string;
  nom: string;
  type: NavPointType;
  latitude: number;
  longitude: number;
}

export interface NavBranch {
  id: string;
  from: string;
  to: string;
  distanceNm: number;
  routeVraie: number;
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
  dateModification: string;
}
