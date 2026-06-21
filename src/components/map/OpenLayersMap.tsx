import { useEffect, useMemo, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import { fromLonLat, toLonLat } from 'ol/proj';
import { boundingExtent } from 'ol/extent';
import type BaseLayer from 'ol/layer/Base';
import { createFreeMapLayer } from '../../mapSources/freeMapSource';
import { createOpenAipRasterLayer } from '../../mapSources/openAipRasterSource';
import { initialMapCenter, initialMapZoom } from '../../mapEngine/mapViewConfig';
import type { MapSourceStatus } from '../../mapEngine/mapTypes';
import { createPlannedRouteLayer } from '../../mapLayers/plannedRouteLayer';
import { createActualTraceLayer, updateActualTraceLayer, type ActualTraceLayer } from '../../mapLayers/actualTraceLayer';
import { createWaypointLayer } from '../../mapLayers/waypointLayer';
import { createAircraftLayer, updateAircraftLayer, type AircraftLayer } from '../../mapLayers/aircraftLayer';
import type { GpsPosition } from '../../domain/gps.types';
import type { NavRoute } from '../../domain/navigation.types';
import { MapControls } from './MapControls';
import { MapFallbackNotice } from './MapFallbackNotice';

interface OpenLayersMapProps {
  route: NavRoute;
  trace: GpsPosition[];
  aircraft: GpsPosition | null;
  selectedPointId: string | null;
  compact?: boolean;
  showTopo?: boolean;
  addWaypointMode?: boolean;
  onMapAddWaypoint?: (longitude: number, latitude: number) => void;
  onSourceStatusChange?: (status: MapSourceStatus) => void;
}

function replaceLayer(map: Map, previousLayer: BaseLayer | null, nextLayer: BaseLayer | null): BaseLayer | null {
  if (previousLayer) {
    map.removeLayer(previousLayer);
    previousLayer.dispose();
  }
  if (nextLayer) map.addLayer(nextLayer);
  return nextLayer;
}

export function OpenLayersMap({
  route,
  trace,
  aircraft,
  selectedPointId,
  compact = false,
  showTopo = true,
  addWaypointMode = false,
  onMapAddWaypoint,
  onSourceStatusChange
}: OpenLayersMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const baseLayerRef = useRef<BaseLayer | null>(null);
  const plannedRouteLayerRef = useRef<BaseLayer | null>(null);
  const waypointsLayerRef = useRef<BaseLayer | null>(null);
  const openAipRasterLayerRef = useRef<BaseLayer | null>(null);
  const traceLayerRef = useRef<ActualTraceLayer | null>(null);
  const aircraftLayerRef = useRef<AircraftLayer | null>(null);
  const [sourceStatus, setSourceStatus] = useState<MapSourceStatus>('free');

  const routeExtent = useMemo(() => {
    const coords = route.points.map((point) => fromLonLat([point.longitude, point.latitude]));
    return boundingExtent(coords);
  }, [route.points]);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return;

    const baseLayer = createFreeMapLayer();
    const openAipRasterLayer = createOpenAipRasterLayer();
    const traceLayer = createActualTraceLayer();
    const aircraftLayer = createAircraftLayer(null);

    baseLayerRef.current = baseLayer;
    openAipRasterLayerRef.current = openAipRasterLayer;
    traceLayerRef.current = traceLayer;
    aircraftLayerRef.current = aircraftLayer;

    const map = new Map({
      target: mapElementRef.current,
      controls: [],
      layers: [baseLayer, openAipRasterLayer, traceLayer, aircraftLayer],
      view: new View({
        center: initialMapCenter,
        zoom: initialMapZoom,
        minZoom: 6,
        maxZoom: 14,
        smoothExtentConstraint: false,
        smoothResolutionConstraint: false
      })
    });

    mapRef.current = map;
    setSourceStatus('free');
    onSourceStatusChange?.('free');

    return () => {
      plannedRouteLayerRef.current?.dispose();
      waypointsLayerRef.current?.dispose();
      openAipRasterLayerRef.current?.dispose();
      traceLayerRef.current?.dispose();
      aircraftLayerRef.current?.dispose();
      map.setTarget(undefined);
      mapRef.current = null;
      baseLayerRef.current = null;
      plannedRouteLayerRef.current = null;
      waypointsLayerRef.current = null;
      openAipRasterLayerRef.current = null;
      traceLayerRef.current = null;
      aircraftLayerRef.current = null;
    };
  }, [onSourceStatusChange]);

  useEffect(() => {
    baseLayerRef.current?.setVisible(showTopo);
  }, [showTopo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    plannedRouteLayerRef.current = replaceLayer(map, plannedRouteLayerRef.current, createPlannedRouteLayer(route.points));
  }, [route.points]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    waypointsLayerRef.current = replaceLayer(map, waypointsLayerRef.current, createWaypointLayer(route.points, selectedPointId));
  }, [route.points, selectedPointId]);

  useEffect(() => {
    const traceLayer = traceLayerRef.current;
    if (!traceLayer) return;
    updateActualTraceLayer(traceLayer, trace);
  }, [trace]);

  useEffect(() => {
    const aircraftLayer = aircraftLayerRef.current;
    if (!aircraftLayer) return;
    updateAircraftLayer(aircraftLayer, aircraft);
  }, [aircraft]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getView().fit(routeExtent, { padding: compact ? [48, 48, 48, 48] : [72, 58, 92, 58], duration: 0, maxZoom: 10 });
  }, [routeExtent, compact]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !addWaypointMode || !onMapAddWaypoint) return undefined;

    const handleClick = (event: { coordinate: number[] }) => {
      const [longitude, latitude] = toLonLat(event.coordinate);
      onMapAddWaypoint(longitude, latitude);
    };

    map.on('singleclick', handleClick);
    return () => {
      map.un('singleclick', handleClick);
    };
  }, [addWaypointMode, onMapAddWaypoint]);

  const zoom = (delta: number) => {
    const view = mapRef.current?.getView();
    if (!view) return;
    view.animate({ zoom: (view.getZoom() ?? initialMapZoom) + delta, duration: 120 });
  };

  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;
    if (aircraft) {
      map.getView().animate({ center: fromLonLat([aircraft.longitude, aircraft.latitude]), duration: 120 });
      return;
    }
    map.getView().fit(routeExtent, { padding: [72, 58, 92, 58], duration: 0, maxZoom: 10 });
  };

  return (
    <div className={`map-shell ${addWaypointMode ? 'is-adding-point' : ''}`}>
      <div ref={mapElementRef} className="ol-map" aria-label="Carte CAP CLAIR" />
      <div className="map-topline">
        <span>Carte aéro openAIP</span>
      </div>
      {addWaypointMode && (
        <div className="map-add-banner">
          Cliquez sur la carte pour placer le point
        </div>
      )}
      <MapControls onZoomIn={() => zoom(1)} onZoomOut={() => zoom(-1)} onRecenter={recenter} />
      {sourceStatus === 'fallback' && <MapFallbackNotice />}
    </div>
  );
}
