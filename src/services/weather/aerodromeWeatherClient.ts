import type { AerodromeWeather } from '../../domain/weather.types';

const CACHE_PREFIX = 'capclair.weather.metarTaf.v1.';
const CACHE_TTL_MS = 5 * 60 * 1000;

interface WeatherResponse {
  generatedAt: string;
  reports: AerodromeWeather[];
}

function normalizeCodes(codes: string[]) {
  return [...new Set(codes.map((code) => code.trim().toUpperCase()).filter((code) => /^[A-Z0-9]{4}$/.test(code)))];
}

function cacheKey(codes: string[]) {
  return CACHE_PREFIX + normalizeCodes(codes).join(',');
}

function readCache(codes: string[]): WeatherResponse | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(codes));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; data: WeatherResponse };
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(codes: string[], data: WeatherResponse) {
  try {
    window.localStorage.setItem(cacheKey(codes), JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // best effort
  }
}

export async function fetchAerodromeWeather(codes: string[], force = false): Promise<WeatherResponse> {
  const ids = normalizeCodes(codes);
  if (!ids.length) return { generatedAt: new Date().toISOString(), reports: [] };

  if (!force) {
    const cached = readCache(ids);
    if (cached) return cached;
  }

  const response = await fetch('/api/weather/metar-taf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ids })
  });

  if (!response.ok) {
    throw new Error(`metar taf proxy ${response.status}`);
  }

  const data = (await response.json()) as WeatherResponse;
  writeCache(ids, data);
  return data;
}
