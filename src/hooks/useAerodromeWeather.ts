import { useMemo, useState } from 'react';
import type { AerodromeWeather } from '../domain/weather.types';
import { fetchAerodromeWeather } from '../services/weather/aerodromeWeatherClient';

function normalizeCodes(codes: string[]) {
  return [...new Set(codes.map((code) => code.trim().toUpperCase()).filter((code) => /^[A-Z0-9]{4}$/.test(code)))];
}

export function useAerodromeWeather(codes: string[]) {
  const ids = useMemo(() => normalizeCodes(codes), [codes.join('|')]);
  const [reports, setReports] = useState<Record<string, AerodromeWeather>>({});
  const [status, setStatus] = useState('METAR/TAF non chargé');
  const [updatedAtIso, setUpdatedAtIso] = useState<string | null>(null);

  const refresh = async () => {
    if (!ids.length) return;
    setStatus('Météo aérodromes en cours...');
    try {
      const response = await fetchAerodromeWeather(ids, true);
      const nextReports: Record<string, AerodromeWeather> = {};
      for (const report of response.reports) {
        nextReports[report.icao] = report;
      }
      setReports(nextReports);
      setUpdatedAtIso(response.generatedAt);
      setStatus('METAR/TAF OK');
    } catch {
      setStatus('Erreur METAR/TAF');
    }
  };

  return { ids, reports, status, updatedAtIso, refresh };
}
