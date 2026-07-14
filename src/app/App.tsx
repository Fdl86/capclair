import { lazy, Suspense, useEffect, useState } from 'react';
import type { ScreenId } from './routes';
import { findAerodrome } from '../data/aerodromeCatalog';
import { AppShell } from '../components/layout/AppShell';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PlanningScreen } from '../screens/PlanningScreen';
import { CalculationsScreen } from '../screens/CalculationsScreen';
import { TrackingScreen } from '../screens/TrackingScreen';
import { TracesScreen } from '../screens/TracesScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { Button } from '../components/ui/Button';
import { useActiveRoute } from '../hooks/useActiveRoute';
import { useTraces } from '../hooks/useTraces';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { useAircraftProfiles } from '../hooks/useAircraftProfiles';
import { useAerodromeWeather } from '../hooks/useAerodromeWeather';
import { DEFAULT_FUEL_PLAN_CONFIG } from '../domain/aircraft.types';
import type { MapBaseLayer } from '../mapEngine/mapTypes';
import { isRouteReady, routeMissingMessage } from '../services/navigation/routeValidation';
import { useOneShotPosition } from '../hooks/useOneShotPosition';
import { importGpxFile } from '../services/import/gpxImport';
import type { TraceSaveResult } from '../services/storage/traceStorage';
import { exportNavLogPdf } from '../services/export/navLogExport';

const TraceReplayScreen = lazy(() => import('../screens/TraceReplayScreen').then((module) => ({ default: module.TraceReplayScreen })));

function routeEndpointCode(route: ReturnType<typeof useActiveRoute>['route'], type: 'depart' | 'destination') {
  return route.points.find((point) => point.type === type)?.code ?? '';
}

function safeAerodromeCode(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return '';
  return findAerodrome(normalized) ? normalized : '';
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('planning');
  const [appNotice, setAppNotice] = useState<string | null>(null);
  const [trackingUnsavedTrace, setTrackingUnsavedTrace] = useState(false);
  const [pendingScreen, setPendingScreen] = useState<ScreenId | null>(null);
  const [replayTraceId, setReplayTraceId] = useState<string | null>(null);
  const routeState = useActiveRoute();
  const traceState = useTraces();
  const aircraftState = useAircraftProfiles();
  const oneShotPosition = useOneShotPosition();
  const [alternateCode, setAlternateCode] = useLocalStorageState('capclair.alternateCode.v2.web', '');
  const [fuelPlanConfigRaw, setFuelPlanConfig] = useLocalStorageState('capclair.fuelPlan.v1', DEFAULT_FUEL_PLAN_CONFIG);
  const [mapBaseLayer, setMapBaseLayer] = useLocalStorageState<MapBaseLayer>('capclair.mapBaseLayer.v1', 'free');
  const [showSupAip, setShowSupAip] = useLocalStorageState('capclair.supaipOverlay.v1', false);
  const fuelPlanConfig = { ...DEFAULT_FUEL_PLAN_CONFIG, ...fuelPlanConfigRaw };
  const ready = isRouteReady(routeState.route);
  const replayTrace = replayTraceId ? traceState.traces.find((trace) => trace.id === replayTraceId) ?? null : null;

  const departureCode = routeEndpointCode(routeState.route, 'depart');
  const destinationCode = routeEndpointCode(routeState.route, 'destination');
  const safeAlternateCode = safeAerodromeCode(alternateCode);
  const aerodromeWeatherState = useAerodromeWeather([departureCode, destinationCode, safeAlternateCode].filter(Boolean));

  useEffect(() => {
    const profileTasKt = aircraftState.activeProfile.cruiseTasKt;
    if (routeState.route.profile.tasKt !== profileTasKt) {
      routeState.setTasKt(profileTasKt);
    }
  }, [aircraftState.activeProfile.id, aircraftState.activeProfile.cruiseTasKt, routeState.route.profile.tasKt]);

  useEffect(() => {
    setFuelPlanConfig((current) => ({
      ...current,
      finalReserveMin: aircraftState.activeProfile.reserveMinutes
    }));
  }, [aircraftState.activeProfile.id, aircraftState.activeProfile.reserveMinutes]);

  const navigate = (screen: ScreenId) => {
    setAppNotice(null);

    if ((screen === 'calculations' || screen === 'tracking') && !ready) {
      const message = routeMissingMessage(routeState.route);
      routeState.setRouteMessage(message);
      setAppNotice(message);
      setCurrentScreen('planning');
      return;
    }

    if (currentScreen === 'tracking' && trackingUnsavedTrace && screen !== 'tracking') {
      setPendingScreen(screen);
      return;
    }

    setCurrentScreen(screen);
  };

  const setAlternate = (code: string): boolean => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setAlternateCode('');
      return true;
    }
    if (!findAerodrome(normalized)) return false;
    setAlternateCode(normalized);
    return true;
  };

  const selectAircraft = (profileId: string) => {
    const selected = aircraftState.selectProfile(profileId);
    routeState.setTasKt(selected.cruiseTasKt);
    setFuelPlanConfig((current) => ({ ...current, finalReserveMin: selected.reserveMinutes }));
  };

  const updateAircraft = (profileId: string, patch: Parameters<typeof aircraftState.updateProfile>[1]) => {
    const updated = aircraftState.updateProfile(profileId, patch);
    if (profileId !== aircraftState.activeProfile.id) return;
    if (typeof patch.cruiseTasKt === 'number') routeState.setTasKt(updated.cruiseTasKt);
    if (typeof patch.reserveMinutes === 'number') {
      setFuelPlanConfig((current) => ({ ...current, finalReserveMin: updated.reserveMinutes }));
    }
  };

  const createAircraft = () => {
    const profile = aircraftState.createProfile();
    routeState.setTasKt(profile.cruiseTasKt);
    setFuelPlanConfig((current) => ({ ...current, finalReserveMin: profile.reserveMinutes }));
  };

  const resetNavigation = () => {
    routeState.resetRoute(aircraftState.activeProfile.cruiseTasKt);
    setAlternateCode('');
    setAppNotice(null);
  };

  const updateFuelPlanConfig = (patch: Partial<typeof DEFAULT_FUEL_PLAN_CONFIG>) => {
    setFuelPlanConfig((current) => ({
      ...current,
      ...patch,
      finalReserveMin: clamp(patch.finalReserveMin ?? current.finalReserveMin, 0, 180),
      marginLiters: clamp(patch.marginLiters ?? current.marginLiters ?? 0, 0, 500)
    }));
  };

  const handleImportGpx = async (file: File): Promise<TraceSaveResult> => {
    const imported = await importGpxFile(file);
    const saved = await traceState.saveTrace(imported.trace);
    if (!saved.ok) return saved;
    setReplayTraceId(imported.trace.id);
    setCurrentScreen('replay');
    return {
      ...saved,
      message: `${imported.message} ${saved.message}`
    };
  };

  return (
    <AppShell currentScreen={currentScreen} onNavigate={navigate} immersive={currentScreen === 'replay'}>
      <Suspense fallback={<div className="screen-loading">Chargement de l’écran...</div>}>
      {appNotice && (
        <div className="app-notice" role="status">
          <span>{appNotice}</span>
          <button type="button" onClick={() => setAppNotice(null)} aria-label="Fermer">×</button>
        </div>
      )}

      {currentScreen === 'planning' && (
        <PlanningScreen
          route={routeState.route}
          selectedPointId={routeState.selectedPointId}
          routeMessage={routeState.routeMessage}
          onSelectPoint={routeState.setSelectedPointId}
          onSetDepartureCode={routeState.setDepartureCode}
          onSetDestinationCode={routeState.setDestinationCode}
          onAddWaypointAt={routeState.addWaypointAt}
          onRemovePoint={routeState.removePoint}
          onReverseRoute={routeState.reverseRoute}
          onResetRoute={resetNavigation}
          alternateCode={safeAlternateCode}
          onSetAlternateCode={setAlternate}
          onCalculations={() => navigate('calculations')}
          mapBaseLayer={mapBaseLayer}
          onMapBaseLayerChange={setMapBaseLayer}
          showSupAip={showSupAip}
          onToggleSupAip={() => setShowSupAip((current) => !current)}
          aircraftPosition={oneShotPosition.position}
          onRequestPosition={oneShotPosition.requestPosition}
          locating={oneShotPosition.locating}
          locationError={oneShotPosition.locationError}
        />
      )}
      {currentScreen === 'calculations' && (
        <CalculationsScreen
          route={routeState.route}
          weatherStatus={routeState.weatherStatus}
          weatherUpdating={routeState.weatherUpdating}
          onSetBranchAltitude={routeState.setBranchAltitudeFt}
          onRefreshWinds={routeState.refreshWinds}
          onSetTasKt={(tasKt) => updateAircraft(aircraftState.activeProfile.id, { cruiseTasKt: tasKt })}
          onSetDefaultAltitudeFt={routeState.setDefaultAltitudeFt}
          aircraftProfiles={aircraftState.profiles}
          activeAircraft={aircraftState.activeProfile}
          onSelectAircraft={selectAircraft}
          fuelPlanConfig={fuelPlanConfig}
          onSetFuelPlanConfig={updateFuelPlanConfig}
          alternateCode={safeAlternateCode}
          aerodromeWeatherReports={aerodromeWeatherState.reports}
          aerodromeWeatherStatus={aerodromeWeatherState.status}
          aerodromeWeatherUpdatedAt={aerodromeWeatherState.updatedAtIso}
          onRefreshAerodromeWeather={aerodromeWeatherState.refresh}
          onValidate={() => navigate('tracking')}
          onExport={() => exportNavLogPdf({
            route: routeState.route,
            aircraft: aircraftState.activeProfile,
            fuelPlanConfig,
            alternateCode: safeAlternateCode
          })}
          onBackPlanning={() => navigate('planning')}
        />
      )}
      {currentScreen === 'tracking' && (
        <TrackingScreen
          route={routeState.route}
          onTraceReady={traceState.saveTrace}
          mapBaseLayer={mapBaseLayer}
          onMapBaseLayerChange={setMapBaseLayer}
          showSupAip={showSupAip}
          onToggleSupAip={() => setShowSupAip((current) => !current)}
          onRecordingStateChange={setTrackingUnsavedTrace}
        />
      )}
      {currentScreen === 'traces' && (
        <TracesScreen
          traces={traceState.traces}
          onDeleteTrace={traceState.deleteTrace}
          onImportGpx={handleImportGpx}
          onOpenReplay={(traceId) => {
            setReplayTraceId(traceId);
            setCurrentScreen('replay');
          }}
          onBack={() => navigate('more')}
          replayDisabled={trackingUnsavedTrace}
          isLoading={traceState.isLoading}
          storageMode={traceState.storageMode}
          storageMessage={traceState.storageMessage}
        />
      )}
      {currentScreen === 'replay' && replayTrace && (
        <TraceReplayScreen
          trace={replayTrace}
          mapBaseLayer={mapBaseLayer}
          onMapBaseLayerChange={setMapBaseLayer}
          showSupAip={showSupAip}
          onToggleSupAip={() => setShowSupAip((current) => !current)}
          onBack={() => {
            setReplayTraceId(null);
            setCurrentScreen('traces');
          }}
        />
      )}
      {currentScreen === 'replay' && !replayTrace && (
        <div className="replay-missing-trace">
          <strong>Trace introuvable</strong>
          <Button variant="secondary" onClick={() => { setReplayTraceId(null); setCurrentScreen('traces'); }}>Retour aux traces</Button>
        </div>
      )}
      {currentScreen === 'more' && (
        <MoreScreen
          onNavigate={navigate}
          aircraftProfiles={aircraftState.profiles}
          activeAircraft={aircraftState.activeProfile}
          onSelectAircraft={selectAircraft}
          onUpdateAircraft={updateAircraft}
          onCreateAircraft={createAircraft}
        />
      )}

      </Suspense>

      <ConfirmDialog
        open={pendingScreen !== null}
        title="Quitter le suivi en cours ?"
        message="La trace en cours ou terminée n’est pas encore sauvegardée. Annulez puis utilisez Arrêter et sauvegarder pour la conserver."
        confirmLabel="Quitter sans sauvegarder"
        onCancel={() => setPendingScreen(null)}
        onConfirm={() => {
          const target = pendingScreen;
          setPendingScreen(null);
          setTrackingUnsavedTrace(false);
          if (target) setCurrentScreen(target);
        }}
      />
    </AppShell>
  );
}
