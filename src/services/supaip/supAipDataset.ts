export interface SupAipDatasetStatus {
  schemaVersion: number;
  mode: 'bootstrap' | 'automatic';
  beta: boolean;
  generatedAt: string;
  sourceUpdatedAt?: string | null;
  sourceUrl: string;
  parserVersion: string;
  listingPublicationCount: number;
  processedPublicationCount?: number;
  nonSpatialPublicationCount?: number;
  zonalPublicationCount: number;
  mappedPublicationCount: number;
  fullyMappedPublicationCount?: number;
  featureCount: number;
  expectedNamedGeometryCount?: number;
  declaredZoneCount?: number;
  verticalCompleteFeatureCount?: number;
  missingVerticalFeatureCount?: number;
  unmappedPublicationCount: number;
  completeUnmappedPublicationCount: number;
  partialPublicationCount: number;
  reusedPublicationCount: number;
  downloadedPublicationCount: number;
  safetyFallbackPublicationCount?: number;
  incompleteCausePublicationCounts?: Record<string, number>;
  incompleteCauseLabels?: Record<string, string>;
  staleAfterHours: number;
  message: string;
}

export const SUP_AIP_DATASET_URL = '/data/supaip-current.geojson';
export const SUP_AIP_STATUS_URL = '/data/supaip-status.json';

export async function fetchSupAipDatasetStatus(signal?: AbortSignal): Promise<SupAipDatasetStatus> {
  const response = await fetch(`${SUP_AIP_STATUS_URL}?v=${Date.now()}`, {
    cache: 'no-store',
    signal,
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`Statut SUP AIP indisponible (${response.status})`);
  return response.json() as Promise<SupAipDatasetStatus>;
}

export function supAipDatasetAgeHours(status: SupAipDatasetStatus | null, now = Date.now()): number | null {
  if (!status) return null;
  const generatedAt = Date.parse(status.generatedAt);
  if (!Number.isFinite(generatedAt)) return null;
  return Math.max(0, (now - generatedAt) / 3_600_000);
}

export function isSupAipDatasetStale(status: SupAipDatasetStatus | null, now = Date.now()): boolean {
  const ageHours = supAipDatasetAgeHours(status, now);
  return ageHours !== null && ageHours > (status?.staleAfterHours ?? 36);
}

export function formatSupAipDatasetTimestamp(value: string | null | undefined): string {
  if (!value) return 'inconnue';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'inconnue';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris'
  }).format(date);
}
