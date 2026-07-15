export interface MapViewStateSnapshot {
  centerLonLat: [number, number];
  zoom: number;
  rotation: number;
  routeSignature?: string;
  savedAt: number;
}

const memoryStore = new Map<string, MapViewStateSnapshot>();
const STORAGE_PREFIX = 'capclair.mapView.session.v1.';

function isFiniteTuple(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length === 2
    && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}

function normalizeSnapshot(value: unknown): MapViewStateSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<MapViewStateSnapshot>;
  if (!isFiniteTuple(candidate.centerLonLat)) return null;
  if (typeof candidate.zoom !== 'number' || !Number.isFinite(candidate.zoom)) return null;
  if (typeof candidate.rotation !== 'number' || !Number.isFinite(candidate.rotation)) return null;
  return {
    centerLonLat: candidate.centerLonLat,
    zoom: Math.max(6, Math.min(14, candidate.zoom)),
    rotation: candidate.rotation,
    routeSignature: typeof candidate.routeSignature === 'string' ? candidate.routeSignature : undefined,
    savedAt: typeof candidate.savedAt === 'number' && Number.isFinite(candidate.savedAt) ? candidate.savedAt : Date.now()
  };
}

export function readMapViewState(key: string | undefined): MapViewStateSnapshot | null {
  if (!key) return null;
  const inMemory = memoryStore.get(key);
  if (inMemory) return inMemory;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
    const parsed = raw ? normalizeSnapshot(JSON.parse(raw)) : null;
    if (parsed) memoryStore.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeMapViewState(key: string | undefined, snapshot: Omit<MapViewStateSnapshot, 'savedAt'>): void {
  if (!key) return;
  const normalized = normalizeSnapshot({ ...snapshot, savedAt: Date.now() });
  if (!normalized) return;
  memoryStore.set(key, normalized);
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(normalized));
  } catch {
    // Session persistence is an enhancement. In-memory persistence still works.
  }
}

export function clearMapViewState(key: string | undefined): void {
  if (!key) return;
  memoryStore.delete(key);
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch {
    // Ignore unavailable storage.
  }
}
