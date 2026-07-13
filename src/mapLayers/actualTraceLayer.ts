import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Stroke, Style } from 'ol/style';
import { fromLonLat } from 'ol/proj';
import type { GpsPosition } from '../domain/gps.types';
import { deriveSegmentStartIndices } from '../services/traces/traceSegments';

export type ActualTraceLayer = VectorLayer<VectorSource<Feature<LineString>>>;

const TRACE_STYLE = [
  new Style({
    stroke: new Stroke({ color: 'rgba(5, 11, 18, 0.82)', width: 7, lineCap: 'round', lineJoin: 'round' })
  }),
  new Style({
    stroke: new Stroke({ color: '#FF3FA4', width: 4, lineCap: 'round', lineJoin: 'round' })
  })
];

interface TraceLayerState {
  pointCount: number;
  lastPoint: GpsPosition | null;
  currentFeature: Feature<LineString> | null;
  segmentStartsKey: string;
}

const stateByLayer = new WeakMap<ActualTraceLayer, TraceLayerState>();

function samePoint(a: GpsPosition | null, b: GpsPosition | null): boolean {
  return Boolean(a && b
    && a.timestamp === b.timestamp
    && a.latitude === b.latitude
    && a.longitude === b.longitude);
}

function coordinate(position: GpsPosition): number[] {
  return fromLonLat([position.longitude, position.latitude]);
}

function startsKey(indices: number[]): string {
  return indices.join(',');
}

function rebuildLayer(layer: ActualTraceLayer, positions: GpsPosition[], explicitStarts: number[]): void {
  const source = layer.getSource();
  if (!source) return;
  source.clear(true);

  const starts = deriveSegmentStartIndices(positions, explicitStarts, true);
  const allStarts = [0, ...starts];
  let currentFeature: Feature<LineString> | null = null;

  allStarts.forEach((start, segmentIndex) => {
    if (start >= positions.length) return;
    const end = (allStarts[segmentIndex + 1] ?? positions.length) - 1;
    const feature = new Feature(new LineString(positions.slice(start, end + 1).map(coordinate)));
    feature.setId(`actual-trace-segment-${segmentIndex}`);
    source.addFeature(feature);
    currentFeature = feature;
  });

  stateByLayer.set(layer, {
    pointCount: positions.length,
    lastPoint: positions.at(-1) ?? null,
    currentFeature,
    segmentStartsKey: startsKey(starts)
  });
}

export function createActualTraceLayer(positions: GpsPosition[] = [], segmentStartIndices: number[] = []): ActualTraceLayer {
  const layer: ActualTraceLayer = new VectorLayer({
    source: new VectorSource<Feature<LineString>>(),
    style: TRACE_STYLE,
    properties: { name: 'actual-trace' },
    renderBuffer: 32,
    zIndex: 21
  });
  rebuildLayer(layer, positions, segmentStartIndices);
  return layer;
}

/**
 * Ajoute le nouveau point directement à la géométrie courante lorsque la trace
 * grandit normalement. Une reconstruction complète n'est faite qu'après un
 * reset, une compaction ou une modification rétroactive.
 */
export function updateActualTraceLayer(
  layer: ActualTraceLayer,
  positions: GpsPosition[],
  segmentStartIndices: number[] = []
): void {
  const state = stateByLayer.get(layer);
  const normalizedStarts = deriveSegmentStartIndices(positions, segmentStartIndices, true);
  const nextStartsKey = startsKey(normalizedStarts);
  const appendedOne = state
    && positions.length === state.pointCount + 1
    && samePoint(state.lastPoint, positions.at(-2) ?? null)
    && (nextStartsKey === state.segmentStartsKey || normalizedStarts.at(-1) === positions.length - 1);

  if (!appendedOne) {
    rebuildLayer(layer, positions, segmentStartIndices);
    return;
  }

  const source = layer.getSource();
  const nextPoint = positions.at(-1);
  if (!source || !nextPoint) return;
  const beginsSegment = normalizedStarts.at(-1) === positions.length - 1 && nextStartsKey !== state.segmentStartsKey;
  let currentFeature = state.currentFeature;

  if (beginsSegment || !currentFeature) {
    currentFeature = new Feature(new LineString([coordinate(nextPoint)]));
    currentFeature.setId(`actual-trace-segment-${normalizedStarts.length}`);
    source.addFeature(currentFeature);
  } else {
    currentFeature.getGeometry()?.appendCoordinate(coordinate(nextPoint));
  }

  stateByLayer.set(layer, {
    pointCount: positions.length,
    lastPoint: nextPoint,
    currentFeature,
    segmentStartsKey: nextStartsKey
  });
}
