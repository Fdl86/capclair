import { useEffect, useMemo, useState } from 'react';
import type { NavRoute } from '../domain/navigation.types';
import type { NotamLayerSettings, PibAnalysis } from '../domain/notam.types';
import { routeSnapshotFromRoute } from '../domain/notam.types';
import { extractTextFromPdf } from '../services/notam/pdfTextExtractor';
import { analyzePibText } from '../services/notam/pibAnalysis';
import { clearStoredBriefing, loadStoredBriefing, storeBriefing } from '../services/notam/notamStorage';
import { readJson, writeJson } from '../services/storage/localStorageService';

const SETTINGS_KEY = 'capclair.notamPib.layerSettings.v1';
const DEFAULT_SETTINGS: NotamLayerSettings = { enabled: false, filter: 'all' };

export function usePibBriefing(route: NavRoute, alternateCodes: string[]) {
  const [analysis, setAnalysis] = useState<PibAnalysis | null>(null);
  const [loadingStored, setLoadingStored] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layerSettings, setLayerSettingsState] = useState<NotamLayerSettings>(() => readJson(SETTINGS_KEY, DEFAULT_SETTINGS));
  const currentRouteSnapshot = useMemo(() => routeSnapshotFromRoute(route, alternateCodes), [route, alternateCodes.join(',')]);

  useEffect(() => {
    let cancelled = false;
    void loadStoredBriefing().then((stored) => {
      if (!cancelled) setAnalysis(stored);
    }).finally(() => {
      if (!cancelled) setLoadingStored(false);
    });
    return () => { cancelled = true; };
  }, []);

  const setLayerSettings = (patch: Partial<NotamLayerSettings>) => {
    setLayerSettingsState((current) => {
      const next = { ...current, ...patch };
      writeJson(SETTINGS_KEY, next);
      return next;
    });
  };

  const runAnalysis = async (text: string, sourceKind: 'pdf' | 'text', sourceFileName: string | null) => {
    setAnalyzing(true);
    setError(null);
    try {
      const next = await analyzePibText({ text, sourceKind, sourceFileName, routeSnapshot: currentRouteSnapshot });
      await storeBriefing(next);
      setAnalysis(next);
      return next;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Analyse du briefing impossible.';
      setError(message);
      throw cause;
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzePdf = async (file: File) => {
    if (file.size > 30 * 1024 * 1024) throw new Error('Le PDF dépasse la limite locale de 30 Mo.');
    if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Le fichier sélectionné n’est pas un PDF.');
    setAnalyzing(true);
    setError(null);
    try {
      const extracted = await extractTextFromPdf(file);
      const next = await analyzePibText({ text: extracted.text, sourceKind: 'pdf', sourceFileName: file.name, sourceFingerprint: extracted.fingerprint, routeSnapshot: currentRouteSnapshot });
      await storeBriefing(next);
      setAnalysis(next);
      return next;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Import PDF impossible.';
      setError(message);
      throw cause;
    } finally {
      setAnalyzing(false);
    }
  };

  const reanalyze = async () => {
    if (!analysis) return null;
    return runAnalysis(analysis.rawText, analysis.sourceKind, analysis.sourceFileName);
  };

  const clear = async () => {
    await clearStoredBriefing();
    setAnalysis(null);
    setError(null);
    setLayerSettings({ enabled: false });
  };

  return {
    analysis,
    loadingStored,
    analyzing,
    error,
    currentRouteSnapshot,
    routeChangedSinceAnalysis: Boolean(analysis && analysis.routeSnapshot.signature !== currentRouteSnapshot.signature),
    layerSettings,
    setLayerSettings,
    analyzePdf,
    analyzeText: (text: string) => runAnalysis(text, 'text', null),
    reanalyze,
    clear
  };
}
