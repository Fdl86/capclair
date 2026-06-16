import { useState } from 'react';
import type { NavRoute } from '../domain/navigation.types';
import { Page } from '../components/layout/Page';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { OpenLayersMap } from '../components/map/OpenLayersMap';
import { MapScaleSelector } from '../components/map/MapScaleSelector';
import { RoutePointList } from '../components/navigation/RoutePointList';
import { mockTrace } from '../data/mockTrace';

interface PlanningScreenProps {
  route: NavRoute;
  selectedPointId: string | null;
  onSelectPoint: (pointId: string) => void;
  onAddPoint: () => void;
  onRemovePoint: (pointId: string) => void;
  onCalculations: () => void;
  onZones: () => void;
}

export function PlanningScreen({ route, selectedPointId, onSelectPoint, onAddPoint, onRemovePoint, onCalculations, onZones }: PlanningScreenProps) {
  const [scale, setScale] = useState('1/500 000');

  return (
    <Page title="Planification" subtitle="Route prévue sur fond OACI-VFR 1/500 000 quand la couche est accessible.">
      <div className="planning-layout">
        <div className="map-card tall">
          <MapScaleSelector value={scale} onChange={setScale} />
          <OpenLayersMap route={route} trace={mockTrace.slice(0, 2)} aircraft={null} selectedPointId={selectedPointId} />
        </div>

        <Card className="route-panel">
          <div className="panel-title-row">
            <div>
              <span>Route ({route.points.length} points)</span>
              <strong>{route.nom}</strong>
            </div>
            <button type="button" onClick={onCalculations}>Calculs</button>
          </div>
          <RoutePointList points={route.points} selectedPointId={selectedPointId} onSelect={onSelectPoint} onRemove={onRemovePoint} />
          <div className="route-actions-row">
            <Button variant="secondary" onClick={onZones}>Zones</Button>
            <Button variant="primary" onClick={onAddPoint}>Ajouter un point</Button>
          </div>
        </Card>
      </div>
    </Page>
  );
}
