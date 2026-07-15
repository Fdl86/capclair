import { useEffect, useState } from 'react';
import type { ScreenId } from '../app/routes';
import type { AircraftProfile } from '../domain/aircraft.types';
import type { SupAipDisplayMode } from '../domain/supaip.types';
import { Page } from '../components/layout/Page';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Accordion } from '../components/ui/Accordion';
import { AircraftProfilePanel } from '../components/flight/AircraftProfilePanel';
import {
  SUP_AIP_ALTITUDE_ALL_SLIDER_VALUE,
  SUP_AIP_ALTITUDE_MIN_FL,
  SUP_AIP_CORRIDOR_MAX_NM,
  SUP_AIP_CORRIDOR_MIN_NM,
  SUP_AIP_ENDPOINT_MAX_NM,
  SUP_AIP_ENDPOINT_MIN_NM,
  formatSupAipAltitudeCeiling,
  supAipAltitudeFromSliderValue,
  supAipAltitudeSliderValue,
  type SupAipVisibilitySettings
} from '../services/supaip/supAipVisibility';
import {
  fetchSupAipDatasetStatus,
  formatSupAipDatasetTimestamp,
  isSupAipDatasetStale,
  type SupAipDatasetStatus
} from '../services/supaip/supAipDataset';

interface MoreScreenProps {
  onNavigate: (screen: ScreenId) => void;
  aircraftProfiles: AircraftProfile[];
  activeAircraft: AircraftProfile;
  onSelectAircraft: (profileId: string) => void;
  onUpdateAircraft: (profileId: string, patch: Partial<AircraftProfile>) => void;
  onCreateAircraft: () => void;
  supAipSettings: SupAipVisibilitySettings;
  onUpdateSupAipSettings: (patch: Partial<SupAipVisibilitySettings>) => void;
}

const modeLabel: Record<SupAipDisplayMode, string> = {
  off: 'Désactivés',
  route: 'Autour de la route',
  all: 'Tous affichés'
};

export function MoreScreen({
  onNavigate,
  aircraftProfiles,
  activeAircraft,
  onSelectAircraft,
  onUpdateAircraft,
  onCreateAircraft,
  supAipSettings,
  onUpdateSupAipSettings
}: MoreScreenProps) {
  const [supAipDatasetStatus, setSupAipDatasetStatus] = useState<SupAipDatasetStatus | null>(null);
  const [supAipDatasetError, setSupAipDatasetError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetchSupAipDatasetStatus(controller.signal)
      .then((status) => {
        setSupAipDatasetStatus(status);
        setSupAipDatasetError(false);
      })
      .catch(() => setSupAipDatasetError(true));
    return () => controller.abort();
  }, []);

  return (
    <Page title="Plus" subtitle="Accès rapide aux outils de préparation.">
      <div className="more-grid">
        <Accordion
          title="Avion"
          subtitle={activeAircraft.label}
          className="more-aircraft-accordion"
          defaultOpen={false}
          storageKey="capclair.accordion.more.aircraft.v1"
        >
          <AircraftProfilePanel
            profiles={aircraftProfiles}
            activeProfile={activeAircraft}
            onSelectProfile={onSelectAircraft}
            onUpdateProfile={onUpdateAircraft}
            onCreateProfile={onCreateAircraft}
          />
        </Accordion>

        <Accordion
          title="SUP AIP"
          subtitle={<>{modeLabel[supAipSettings.mode]} <span className="supaip-settings-beta">BETA</span></>}
          className="more-supaip-accordion"
          defaultOpen={false}
          storageKey="capclair.accordion.more.supaip.v1"
        >
          <div className="supaip-settings-panel">
            <div className="supaip-setting-block">
              <div className="supaip-setting-heading">
                <div>
                  <strong>Mode d'affichage</strong>
                  <span>Le bouton de la carte permet aussi de passer rapidement d'un mode à l'autre.</span>
                </div>
              </div>
              <div className="supaip-mode-selector" role="group" aria-label="Mode d'affichage des SUP AIP">
                {(['off', 'route', 'all'] as SupAipDisplayMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={supAipSettings.mode === mode ? 'active' : ''}
                    aria-pressed={supAipSettings.mode === mode}
                    onClick={() => onUpdateSupAipSettings({ mode })}
                  >
                    {mode === 'off' ? 'OFF' : mode === 'route' ? 'ROUTE' : 'TOUS'}
                  </button>
                ))}
              </div>
            </div>

            <label className="supaip-range-setting">
              <span className="supaip-setting-heading">
                <span>
                  <strong>Distance autour de la route</strong>
                  <small>Corridor de chaque côté de tous les segments.</small>
                </span>
                <output>{supAipSettings.routeCorridorNm} NM</output>
              </span>
              <input
                type="range"
                min={SUP_AIP_CORRIDOR_MIN_NM}
                max={SUP_AIP_CORRIDOR_MAX_NM}
                step={5}
                value={supAipSettings.routeCorridorNm}
                onChange={(event) => onUpdateSupAipSettings({ routeCorridorNm: Number(event.target.value) })}
              />
              <span className="supaip-range-limits"><small>{SUP_AIP_CORRIDOR_MIN_NM} NM</small><small>{SUP_AIP_CORRIDOR_MAX_NM} NM</small></span>
            </label>

            <label className="supaip-range-setting">
              <span className="supaip-setting-heading">
                <span>
                  <strong>Rayon départ et arrivée</strong>
                  <small>Protection élargie autour des deux aérodromes.</small>
                </span>
                <output>{supAipSettings.endpointRadiusNm} NM</output>
              </span>
              <input
                type="range"
                min={SUP_AIP_ENDPOINT_MIN_NM}
                max={SUP_AIP_ENDPOINT_MAX_NM}
                step={5}
                value={supAipSettings.endpointRadiusNm}
                onChange={(event) => onUpdateSupAipSettings({ endpointRadiusNm: Number(event.target.value) })}
              />
              <span className="supaip-range-limits"><small>{SUP_AIP_ENDPOINT_MIN_NM} NM</small><small>{SUP_AIP_ENDPOINT_MAX_NM} NM</small></span>
            </label>

            <label className="supaip-range-setting">
              <span className="supaip-setting-heading">
                <span>
                  <strong>Plafond d'affichage</strong>
                  <small>Affiche les zones dont le plancher connu peut concerner un vol jusqu'à ce niveau.</small>
                </span>
                <output>{formatSupAipAltitudeCeiling(supAipSettings.maxDisplayFlightLevel)}</output>
              </span>
              <input
                type="range"
                min={SUP_AIP_ALTITUDE_MIN_FL}
                max={SUP_AIP_ALTITUDE_ALL_SLIDER_VALUE}
                step={10}
                value={supAipAltitudeSliderValue(supAipSettings.maxDisplayFlightLevel)}
                onChange={(event) => onUpdateSupAipSettings({
                  maxDisplayFlightLevel: supAipAltitudeFromSliderValue(Number(event.target.value))
                })}
              />
              <span className="supaip-range-limits"><small>FL{SUP_AIP_ALTITUDE_MIN_FL}</small><small>TOUTES</small></span>
            </label>

            <div className="supaip-altitude-rule">
              <span aria-hidden="true">✓</span>
              <div>
                <strong>Filtrage vertical conservateur</strong>
                <p>Seules les zones dont le plancher absolu connu est strictement au-dessus du plafond choisi sont masquées. Les limites AGL, ASFC ou non extraites restent toujours affichées.</p>
              </div>
            </div>

            <div className={`supaip-dataset-status ${isSupAipDatasetStale(supAipDatasetStatus) ? 'stale' : ''}`}>
              <div className="supaip-dataset-status-heading">
                <strong>Mise à jour automatique</strong>
                <span>{supAipDatasetStatus?.mode === 'automatic' ? 'ACTIVE' : 'À INITIALISER'}</span>
              </div>
              {supAipDatasetError ? (
                <p>Le statut distant est indisponible. La dernière base chargée reste utilisable.</p>
              ) : supAipDatasetStatus ? (
                <>
                  <p>
                    <b>{supAipDatasetStatus.featureCount}</b> géométries affichées depuis <b>{supAipDatasetStatus.mappedPublicationCount}</b> publications spatiales.
                  </p>
                  <dl>
                    <div><dt>Base générée</dt><dd>{formatSupAipDatasetTimestamp(supAipDatasetStatus.generatedAt)}</dd></div>
                    <div><dt>Liste SIA</dt><dd>{formatSupAipDatasetTimestamp(supAipDatasetStatus.sourceUpdatedAt)}</dd></div>
                    <div><dt>PDF contrôlés</dt><dd>{supAipDatasetStatus.processedPublicationCount ?? (supAipDatasetStatus.downloadedPublicationCount + supAipDatasetStatus.reusedPublicationCount)} / {supAipDatasetStatus.listingPublicationCount}</dd></div>
                    <div><dt>SUP entièrement cartographiés</dt><dd>{supAipDatasetStatus.fullyMappedPublicationCount ?? Math.max(0, supAipDatasetStatus.mappedPublicationCount - supAipDatasetStatus.partialPublicationCount - (supAipDatasetStatus.conservativePublicationCount ?? 0))} / {supAipDatasetStatus.zonalPublicationCount}</dd></div>
                    <div><dt>SUP affichés avec prudence</dt><dd>{supAipDatasetStatus.conservativePublicationCount ?? supAipDatasetStatus.conservativelyMappedPublicationCount ?? 0}</dd></div>
                    <div><dt>SUP réellement partiels</dt><dd>{supAipDatasetStatus.partialPublicationCount}</dd></div>
                    <div><dt>SUP non cartographiés</dt><dd>{supAipDatasetStatus.completeUnmappedPublicationCount}</dd></div>
                    <div><dt>Verticales manquantes</dt><dd>{supAipDatasetStatus.missingVerticalFeatureCount ?? 0}</dd></div>
                    {(supAipDatasetStatus.safetyFallbackPublicationCount ?? 0) > 0 && <div><dt>Replis de sécurité</dt><dd>{supAipDatasetStatus.safetyFallbackPublicationCount} SUP / {supAipDatasetStatus.safetyFallbackFeatureCount ?? 0} zone(s)</dd></div>}
                    {(supAipDatasetStatus.ignoredReferenceObjectCount ?? 0) > 0 && <div><dt>Références permanentes ignorées</dt><dd>{supAipDatasetStatus.ignoredReferenceObjectCount}</dd></div>}
                  </dl>
                  {supAipDatasetStatus.incompleteCausePublicationCounts && Object.values(supAipDatasetStatus.incompleteCausePublicationCounts).some((count) => count > 0) && (
                    <div className="supaip-cause-summary">
                      <strong>Causes des publications à contrôler</strong>
                      <small>Une publication peut cumuler plusieurs causes.</small>
                      <ul>
                        {Object.entries(supAipDatasetStatus.incompleteCausePublicationCounts)
                          .filter(([, count]) => count > 0)
                          .map(([code, count]) => (
                            <li key={code}>
                              <span>{supAipDatasetStatus.incompleteCauseLabels?.[code] ?? code}</span>
                              <b>{count}</b>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                  {supAipDatasetStatus.mode === 'bootstrap' && <p className="supaip-dataset-alert">Le premier lancement du workflow GitHub est nécessaire pour remplacer la base initiale par la couverture automatique.</p>}
                  {(supAipDatasetStatus.completeUnmappedPublicationCount > 0 || supAipDatasetStatus.partialPublicationCount > 0) && <p className="supaip-dataset-alert">Les publications réellement incomplètes restent signalées. Elles ne sont jamais considérées comme absentes: consulter leur PDF officiel avant le vol.</p>}
                  {(supAipDatasetStatus.conservativePublicationCount ?? 0) > 0 && <p className="supaip-dataset-alert">Les SUP affichés avec prudence possèdent toutes leurs zones principales, mais au moins une exclusion interne n'est pas encore découpée. Le contour extérieur complet est conservé volontairement.</p>}
                  {(supAipDatasetStatus.missingVerticalFeatureCount ?? 0) > 0 && <p className="supaip-dataset-alert">Certaines zones n'ont pas de limites verticales extraites. La fiche l'indique explicitement et renvoie vers le PDF SIA.</p>}
                  {(supAipDatasetStatus.safetyFallbackPublicationCount ?? 0) > 0 && <p className="supaip-dataset-alert">Des géométries valides d'une version précédente ont été conservées après une régression du parseur. Leur nombre exact est désormais audité dans GitHub Actions.</p>}
                </>
              ) : <p>Lecture du statut...</p>}
              <a href="https://www.sia.aviation-civile.gouv.fr/documents/supaip/aip/id/6" target="_blank" rel="noreferrer">Ouvrir la liste officielle SIA</a>
            </div>

            <p className="supaip-settings-warning">Surimpression automatique BETA. Vérifier systématiquement le SIA, SOFIA et les NOTAM avant le vol.</p>
          </div>
        </Accordion>

        <Card>
          <h2>Log de nav</h2>
          <p>Tableau complet avec altitude, vent, route vraie, variation, route magnétique, cap et vitesse sol.</p>
          <Button variant="secondary" onClick={() => onNavigate('calculations')}>Ouvrir le log</Button>
        </Card>
        <Card>
          <h2>Traces</h2>
          <p>Historique des suivis GPS enregistrés.</p>
          <Button variant="secondary" onClick={() => onNavigate('traces')}>Ouvrir les traces</Button>
        </Card>
        <Card className="safety-card">
          <strong>Limites</strong>
          <p>Prototype non réglementaire. SUP AIP AUTO BETA avec contrôle obligatoire des publications non cartographiées, pas de NOTAM automatiques et pas de GPS en arrière-plan.</p>
        </Card>
      </div>
    </Page>
  );
}
