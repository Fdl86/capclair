import { useRef, useState } from 'react';
import type { BriefingRouteSnapshot, NotamLayerSettings, ParsedNotam, PibAnalysis, PibRouteContext } from '../../domain/notam.types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface NotamPibPanelProps {
  analysis: PibAnalysis | null;
  currentRoute: BriefingRouteSnapshot;
  routeChangedSinceAnalysis: boolean;
  loadingStored: boolean;
  analyzing: boolean;
  error: string | null;
  layerSettings: NotamLayerSettings;
  onLayerSettingsChange: (patch: Partial<NotamLayerSettings>) => void;
  onAnalyzePdf: (file: File) => Promise<unknown>;
  onAnalyzeText: (text: string) => Promise<unknown>;
  onReanalyze: () => Promise<unknown>;
  onClear: () => Promise<void>;
  onUseDetectedRoute: (context: PibRouteContext) => void;
}

function formatUtc(value: string | null) {
  if (!value) return 'Non détectée';
  return new Date(value).toLocaleString('fr-FR', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' }) + ' UTC';
}

function routeLabel(departure: string | null, destination: string | null) {
  return departure && destination ? `${departure} > ${destination}` : 'Aucun trajet complet';
}

function statusLabel(notam: ParsedNotam) {
  if (notam.temporalStatus === 'active') return 'Actif au créneau';
  if (notam.temporalStatus === 'future') return 'Futur';
  if (notam.temporalStatus === 'ended') return 'Terminé';
  if (notam.temporalStatus === 'complex') return 'Horaire à vérifier';
  if (notam.temporalStatus === 'published') return 'Publication en vigueur';
  return 'Non interprété';
}

function relevanceLabel(notam: ParsedNotam) {
  switch (notam.routeRelevance) {
    case 'departure': return 'Départ';
    case 'destination': return 'Destination';
    case 'alternate': return 'Dégagement';
    case 'route': return 'Route';
    case 'outside': return 'Hors corridor estimé';
    default: return 'Pertinence non déterminée';
  }
}

function NotamRow({ notam, onOpen }: { notam: ParsedNotam; onOpen: () => void }) {
  return (
    <button type="button" className="notam-result-row" onClick={onOpen}>
      <span>
        <strong>{notam.id}</strong>
        <small>{notam.section ?? notam.fields.q?.code ?? 'NOTAM'}</small>
      </span>
      <span className="notam-row-meta">
        <em className={`notam-status status-${notam.temporalStatus}`}>{statusLabel(notam)}</em>
        <small>{relevanceLabel(notam)}</small>
      </span>
    </button>
  );
}

function ResultGroup({ title, items, onOpen }: { title: string; items: ParsedNotam[]; onOpen: (notam: ParsedNotam) => void }) {
  if (items.length === 0) return null;
  return (
    <section className="notam-result-group">
      <h4>{title}<span>{items.length}</span></h4>
      <div>{items.map((notam, index) => <NotamRow key={`${title}-${notam.id}-${index}`} notam={notam} onOpen={() => onOpen(notam)} />)}</div>
    </section>
  );
}


function reconciliationStatusLabel(status: PibAnalysis['reconciliations'][number]['status']) {
  const labels: Record<PibAnalysis['reconciliations'][number]['status'], string> = {
    mapped: 'Présent et cartographié',
    partial: 'Présent mais partiellement cartographié',
    conservative: 'Présent, affiché avec prudence',
    fallback: 'Présent avec géométrie de repli',
    unmapped: 'Présent mais non cartographié',
    absent: 'Absent de la base CAP CLAIR',
    ambiguous: 'Référence ambiguë à vérifier'
  };
  return labels[status];
}

function supAipActionLabel(action: PibAnalysis['reconciliations'][number]['reference']['action']) {
  const labels: Record<PibAnalysis['reconciliations'][number]['reference']['action'], string> = {
    trigger: 'NOTAM Trigger',
    activated: 'Activation signalée',
    modified: 'Modification signalée',
    extended: 'Prolongation signalée',
    cancelled: 'Annulation signalée',
    replaced: 'Remplacement signalé',
    mentioned: 'Référence détectée',
    ambiguous: 'Référence ambiguë'
  };
  return labels[action];
}

function SupAipReconciliationList({ analysis }: { analysis: PibAnalysis }) {
  if (analysis.reconciliations.length === 0) return null;
  return (
    <section className="notam-supaip-reconciliation">
      <h4>Contrôle croisé SUP AIP</h4>
      {analysis.reconciliations.map((item) => (
        <article key={item.reference.id} className={`notam-supaip-match match-${item.status}`}>
          <div>
            <strong>SUP AIP {item.reference.id}</strong>
            <span>{supAipActionLabel(item.reference.action)}</span>
          </div>
          <p>{item.title ?? 'Publication non identifiée dans la base CAP CLAIR'}</p>
          <dl>
            <div><dt>État</dt><dd>{reconciliationStatusLabel(item.status)}</dd></div>
            <div><dt>Géométries</dt><dd>{item.mappedGeometryCount}{item.expectedGeometryCount !== null ? ` / ${item.expectedGeometryCount}` : ''}</dd></div>
          </dl>
          {item.warning && <p className="notam-priority-warning">{item.warning}</p>}
          {item.sourcePdf && <a href={item.sourcePdf} target="_blank" rel="noreferrer">Ouvrir le PDF officiel SIA</a>}
        </article>
      ))}
    </section>
  );
}

export function NotamPibPanel({
  analysis,
  currentRoute,
  routeChangedSinceAnalysis,
  loadingStored,
  analyzing,
  error,
  layerSettings,
  onLayerSettingsChange,
  onAnalyzePdf,
  onAnalyzeText,
  onReanalyze,
  onClear,
  onUseDetectedRoute
}: NotamPibPanelProps) {
  const [text, setText] = useState('');
  const [selectedNotam, setSelectedNotam] = useState<ParsedNotam | null>(null);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const importPdf = async (file: File | undefined) => {
    if (!file) return;
    setLocalMessage(null);
    try {
      await onAnalyzePdf(file);
      setLocalMessage('PDF analysé localement. Aucune donnée envoyée vers un serveur tiers.');
    } catch (cause) {
      setLocalMessage(cause instanceof Error ? cause.message : 'Import impossible.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const analyzeText = async () => {
    if (text.trim().length < 20) {
      setLocalMessage('Collez le contenu complet du PIB avant de lancer l’analyse.');
      return;
    }
    setLocalMessage(null);
    try {
      await onAnalyzeText(text);
      setLocalMessage('Texte analysé et dernier briefing enregistré localement.');
    } catch (cause) {
      setLocalMessage(cause instanceof Error ? cause.message : 'Analyse impossible.');
    }
  };

  const alertNotams = analysis?.notams.filter((notam) => notam.temporalStatus === 'active' || notam.temporalStatus === 'complex' || notam.interpretationStatus === 'uninterpreted' || notam.supAipReferences.some((reference) => analysis.reconciliations.some((item) => item.reference.id === reference.id && ['partial', 'unmapped', 'absent'].includes(item.status)))) ?? [];
  const confirmedSupIds = new Set(analysis?.reconciliations.filter((item) => ['mapped', 'conservative', 'fallback'].includes(item.status)).map((item) => item.reference.id) ?? []);
  const missingSupIds = new Set(analysis?.reconciliations.filter((item) => ['partial', 'unmapped', 'absent'].includes(item.status)).map((item) => item.reference.id) ?? []);
  const routeNotams = analysis?.notams.filter((notam) => ['departure', 'destination', 'alternate', 'route'].includes(notam.routeRelevance)) ?? [];
  const confirmedSup = analysis?.notams.filter((notam) => notam.supAipReferences.some((reference) => confirmedSupIds.has(reference.id))) ?? [];
  const missingSup = analysis?.notams.filter((notam) => notam.supAipReferences.some((reference) => missingSupIds.has(reference.id))) ?? [];
  const actions = analysis?.notams.filter((notam) => notam.supAipReferences.some((reference) => reference.action !== 'mentioned')) ?? [];
  const independent = analysis?.notams.filter((notam) => notam.supAipReferences.length === 0) ?? [];
  const uninterpreted = analysis?.notams.filter((notam) => notam.interpretationStatus === 'uninterpreted' || ['complex', 'unknown'].includes(notam.temporalStatus)) ?? [];

  const clearBriefing = async () => {
    await onClear();
    setText('');
    setSelectedNotam(null);
    setLocalMessage('Briefing et données locales effacés.');
  };

  return (
    <div className="notam-pib-panel">
      <div className="notam-safety-banner">
        <strong>Aide visuelle BETA</strong>
        <p>Le briefing importé ne remplace jamais SOFIA, le SIA ni la préparation réglementaire. Son absence d’un SUP AIP ne masque jamais la base CAP CLAIR.</p>
      </div>

      <div className="notam-current-route">
        <span>Trajet CAP CLAIR actuel</span>
        <strong>{routeLabel(currentRoute.departure, currentRoute.destination)}</strong>
        <small>{currentRoute.departureTimeIso ? formatUtc(currentRoute.departureTimeIso) : 'Heure de départ non définie'}</small>
      </div>

      <div className="notam-import-actions">
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={(event) => void importPdf(event.target.files?.[0])} />
        <Button variant="primary" disabled={analyzing} onClick={() => inputRef.current?.click()}>{analyzing ? 'Analyse en cours...' : 'Importer un PDF SOFIA'}</Button>
        <span>ou</span>
        <label>
          <span>Coller le contenu du PIB</span>
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Collez ici le briefing SOFIA complet..." rows={9} />
        </label>
        <div className="notam-text-actions">
          <Button disabled={analyzing} onClick={() => void analyzeText()}>Analyser le briefing</Button>
          <Button variant="ghost" disabled={!text} onClick={() => setText('')}>Effacer le texte</Button>
        </div>
      </div>

      {(error || localMessage) && <p className={`notam-import-message ${error ? 'error' : ''}`}>{error ?? localMessage}</p>}
      {loadingStored && <p className="notam-import-message">Lecture du dernier briefing local...</p>}

      {analysis && (
        <>
          <section className={`notam-route-context context-${analysis.routeContextMode}`}>
            <div>
              <span>Trajet détecté dans le briefing</span>
              <strong>{routeLabel(analysis.context.departure, analysis.context.destination)}</strong>
              <small>Dégagements: {analysis.context.alternates.join(', ') || 'non détectés'} - Départ: {formatUtc(analysis.context.departureTimeIso)}</small>
              <small>Plage PIB: FL{String(analysis.context.floorFl ?? 0).padStart(3, '0')} à FL{String(analysis.context.ceilingFl ?? 999).padStart(3, '0')} - demi-couloir {analysis.context.halfCorridorNm ?? 'non détecté'} NM - rayon {analysis.context.radiusNm ?? 'non détecté'} NM</small>
            </div>
            {analysis.routeContextMode === 'matching' && <em>Correspondance confirmée</em>}
            {analysis.routeContextMode === 'mismatch' && <em>Trajets différents - analyse prudente</em>}
            {analysis.routeContextMode === 'detected-only' && <em>Trajet disponible dans le PIB</em>}
            {analysis.context.departure && analysis.context.destination && analysis.routeContextMode !== 'matching' && (
              <Button variant="secondary" onClick={() => onUseDetectedRoute(analysis.context)}>Utiliser ce trajet dans CAP CLAIR</Button>
            )}
          </section>

          <div className="notam-analysis-warnings">
            {analysis.warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>

          {routeChangedSinceAnalysis && (
            <div className="notam-route-changed">
              <p>Le trajet CAP CLAIR a changé depuis cette analyse.</p>
              <Button disabled={analyzing} onClick={() => void onReanalyze()}>Réévaluer avec le trajet actuel</Button>
            </div>
          )}

          <section className="notam-analysis-meta">
            <div><span>Import</span><strong>{formatUtc(analysis.importedAtIso)}</strong></div>
            <div><span>Fichier</span><strong>{analysis.sourceFileName ?? 'Texte collé'}</strong></div>
            <div><span>Période</span><strong>{formatUtc(analysis.context.departureTimeIso)}</strong></div>
          </section>

          <section className="notam-summary-grid">
            <div><strong>{analysis.summary.totalNotams}</strong><span>NOTAM</span></div>
            <div><strong>{analysis.summary.supAipReferenceCount}</strong><span>SUP AIP cités</span></div>
            <div><strong>{analysis.summary.supAipMatchCount}</strong><span>Correspondances</span></div>
            <div className={analysis.summary.supAipMissingOrIncompleteCount ? 'warn' : ''}><strong>{analysis.summary.supAipMissingOrIncompleteCount}</strong><span>SUP incomplets</span></div>
            <div className={analysis.summary.uninterpretedCount ? 'warn' : ''}><strong>{analysis.summary.uninterpretedCount}</strong><span>À vérifier</span></div>
            <div><strong>{analysis.summary.approximateCircleCount}</strong><span>Cercles Q</span></div>
          </section>

          <section className="notam-layer-settings">
            <label>
              <input type="checkbox" checked={layerSettings.enabled} onChange={(event) => onLayerSettingsChange({ enabled: event.target.checked })} />
              <span><strong>NOTAM / PIB BETA sur la carte</strong><small>Désactivé par défaut. Les cercles Q restent explicitement approximatifs.</small></span>
            </label>
            <select value={layerSettings.filter} onChange={(event) => onLayerSettingsChange({ filter: event.target.value as NotamLayerSettings['filter'] })} disabled={!layerSettings.enabled}>
              <option value="all">Tous les NOTAM</option>
              <option value="route">Uniquement la route</option>
              <option value="alerts">Uniquement les alertes</option>
              <option value="supaip">Uniquement les SUP AIP cités</option>
              <option value="active">Actifs à l’heure prévue</option>
            </select>
          </section>

          <SupAipReconciliationList analysis={analysis} />

          <div className="notam-results">
            <ResultGroup title="Alertes prioritaires" items={alertNotams} onOpen={setSelectedNotam} />
            <ResultGroup title="Concernant le trajet" items={routeNotams} onOpen={setSelectedNotam} />
            <ResultGroup title="SUP AIP confirmés" items={confirmedSup} onOpen={setSelectedNotam} />
            <ResultGroup title="SUP AIP manquants ou incomplets" items={missingSup} onOpen={setSelectedNotam} />
            <ResultGroup title="Activations et modifications" items={actions} onOpen={setSelectedNotam} />
            <ResultGroup title="NOTAM indépendants" items={independent} onOpen={setSelectedNotam} />
            <ResultGroup title="Éléments non interprétés" items={uninterpreted} onOpen={setSelectedNotam} />
          </div>

          <Button variant="danger" onClick={() => void clearBriefing()}>Effacer le briefing</Button>
        </>
      )}

      <Modal open={selectedNotam !== null} title={selectedNotam?.id ?? 'NOTAM'} onClose={() => setSelectedNotam(null)}>
        {selectedNotam && (
          <div className="notam-detail">
            <dl>
              <div><dt>Validité</dt><dd>{formatUtc(selectedNotam.fields.validFromIso)} - {selectedNotam.fields.validToPermanent ? 'PERM' : formatUtc(selectedNotam.fields.validToIso)}</dd></div>
              <div><dt>Temporalité</dt><dd>{selectedNotam.temporalExplanation}</dd></div>
              <div><dt>Aérodrome/FIR</dt><dd>{selectedNotam.fields.a.join(', ') || 'Non interprété'}</dd></div>
              <div><dt>Limites Q</dt><dd>{selectedNotam.fields.q ? `FL${String(selectedNotam.fields.q.lowerFl ?? 0).padStart(3, '0')} / FL${String(selectedNotam.fields.q.upperFl ?? 999).padStart(3, '0')}` : 'Non interprétées'}</dd></div>
              <div><dt>Géométrie</dt><dd>{selectedNotam.exactPolygon ? 'Polygone précis extrait du champ E' : selectedNotam.eCoordinates.length ? 'Position(s) précise(s) du champ E' : selectedNotam.fields.q?.center ? 'Zone d’influence NOTAM approximative issue de Q' : 'Aucune géométrie'}</dd></div>
            </dl>
            {selectedNotam.warnings.map((warning) => <p key={warning} className="notam-priority-warning">{warning}</p>)}
            <h3>Texte brut original</h3>
            <pre>{selectedNotam.rawText}</pre>
          </div>
        )}
      </Modal>
    </div>
  );
}
