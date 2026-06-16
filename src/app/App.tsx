import { useState } from 'react';
import type { ScreenId } from './routes';
import { AppShell } from '../components/layout/AppShell';
import { HomeScreen } from '../screens/HomeScreen';
import { PlanningScreen } from '../screens/PlanningScreen';
import { CalculationsScreen } from '../screens/CalculationsScreen';
import { ZonesScreen } from '../screens/ZonesScreen';
import { TrackingScreen } from '../screens/TrackingScreen';
import { TracesScreen } from '../screens/TracesScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { useActiveRoute } from '../hooks/useActiveRoute';
import { useTraces } from '../hooks/useTraces';

export function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('home');
  const routeState = useActiveRoute();
  const traceState = useTraces();

  return (
    <AppShell currentScreen={currentScreen} onNavigate={setCurrentScreen}>
      {currentScreen === 'home' && <HomeScreen onNavigate={setCurrentScreen} />}
      {currentScreen === 'planning' && (
        <PlanningScreen
          route={routeState.route}
          selectedPointId={routeState.selectedPointId}
          onSelectPoint={routeState.setSelectedPointId}
          onAddPoint={routeState.addMockPoint}
          onRemovePoint={routeState.removePoint}
          onCalculations={() => setCurrentScreen('calculations')}
          onZones={() => setCurrentScreen('zones')}
        />
      )}
      {currentScreen === 'calculations' && (
        <CalculationsScreen route={routeState.route} onValidate={() => setCurrentScreen('tracking')} onExport={() => setCurrentScreen('traces')} />
      )}
      {currentScreen === 'zones' && <ZonesScreen />}
      {currentScreen === 'tracking' && <TrackingScreen route={routeState.route} onTraceReady={traceState.saveTrace} />}
      {currentScreen === 'traces' && <TracesScreen traces={traceState.traces} onDeleteTrace={traceState.deleteTrace} />}
      {currentScreen === 'more' && <MoreScreen onNavigate={setCurrentScreen} />}
    </AppShell>
  );
}
