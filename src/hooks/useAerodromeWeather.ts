import { useMemo, useState } from 'react';
import type { AerodromeWeather, AerodromeWeatherRequestItem } from '../domain/weather.types';
import { buildAerodromeWeatherRequestItems } from '../services/weather/aerodromeWeatherCandidates';
import { fetchAerodromeWeather } from '../services/weather/aerodromeWeatherClient';

export function useAerodromeWeather(codes: string[]) {
  const items = useMemo(() => buildAerodromeWeatherRequestItems(codes), [codes.join('|')]);
  const [reports, setReports] = useState<Record<string, AerodromeWeather>>({});
  const [status, setStatus] = useState('METAR/TAF non chargé');
  const [updatedAtIso, setUpdatedAtIso] = useState<string | null>(null);

  const refresh = async () => {
    if (!items.length) return;
    setStatus('Météo aérodromes en cours...');
    try {
      const response = await fetchAerodromeWeather(items as AerodromeWeatherRequestItem[], true);
      const nextReports: Record<string, AerodromeWeather> = {};
      for (const report of response.reports) {
        nextReports[report.requestedIcao || report.icao] = report;
      }
      setReports(nextReports);
      setUpdatedAtIso(response.generatedAt);
      setStatus('METAR/TAF OK');
    } catch {
      setStatus('Erreur METAR/TAF');
    }
  };

  return { items, reports, status, updatedAtIso, refresh };
}
