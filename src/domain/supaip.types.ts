export type SupAipActivationMode = 'schedule' | 'notam' | 'windows' | 'published';

export interface SupAipActivationWindow {
  from: string;
  to: string;
}

export interface SupAipProperties {
  id: string;
  name: string;
  zoneType: string;
  supAip: string;
  title: string;
  validFrom: string;
  validTo: string;
  activationMode: SupAipActivationMode;
  activationText: string;
  activationWindowsUtc?: SupAipActivationWindow[];
  lowerLimit: string;
  upperLimit: string;
  frequency?: string;
  sourcePdf: string;
  sourcePage?: string;
  beta?: boolean;
  dataScope?: string;
}

export type SupAipVisualStatus = 'active' | 'conditional' | 'published' | 'upcoming' | 'expired' | 'unknown';

export interface SupAipSelection extends SupAipProperties {
  visualStatus: SupAipVisualStatus;
}
