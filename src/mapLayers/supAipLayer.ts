import Feature, { type FeatureLike } from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import type Geometry from 'ol/geom/Geometry';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style, Text } from 'ol/style';
import type { SupAipProperties, SupAipSelection, SupAipVisualStatus } from '../domain/supaip.types';
import { getSupAipVisualStatus } from '../services/supaip/supAipStatus';
import { isSupAipFeatureVisible } from '../services/supaip/supAipVisibility';
import { SUP_AIP_DATASET_URL } from '../services/supaip/supAipDataset';

export type SupAipLayer = VectorLayer<VectorSource<Feature<Geometry>>> & {
  refreshData: (datasetVersion?: string | null) => Promise<number>;
  lastLoadedAt: () => number | null;
  loadedDatasetVersion: () => string | null;
};

interface CreateSupAipLayerOptions {
  visible?: boolean;
  onLoadStart?: () => void;
  onLoadEnd?: (featureCount: number) => void;
  onLoadError?: () => void;
}

const palette: Record<SupAipVisualStatus, { stroke: string; fill: string; text: string; dash?: number[] }> = {
  active: { stroke: '#FF3D4F', fill: 'rgba(255, 61, 79, 0.22)', text: '#FFE6E9' },
  conditional: { stroke: '#FFB84D', fill: 'rgba(255, 184, 77, 0.15)', text: '#FFF0D3', dash: [9, 7] },
  published: { stroke: '#FF7A45', fill: 'rgba(255, 122, 69, 0.14)', text: '#FFE8DE' },
  upcoming: { stroke: '#59CFFF', fill: 'rgba(89, 207, 255, 0.10)', text: '#DFF8FF', dash: [4, 7] },
  expired: { stroke: '#7D8794', fill: 'rgba(90, 100, 112, 0.06)', text: '#D4D9DE', dash: [3, 8] },
  unknown: { stroke: '#D0D7DF', fill: 'rgba(208, 215, 223, 0.08)', text: '#F2F5F8', dash: [5, 6] }
};

const styleCache = new Map<string, Style | Style[]>();

function featureProperties(feature: FeatureLike): Partial<SupAipProperties> {
  return feature.getProperties() as Partial<SupAipProperties>;
}

function defaultStyleFor(feature: FeatureLike, resolution: number): Style | undefined {
  if (!isSupAipFeatureVisible(feature as Feature<Geometry>)) return undefined;
  const properties = featureProperties(feature);
  const status = getSupAipVisualStatus(properties);
  const showLabel = resolution <= 2500;
  const cacheKey = `${status}:${showLabel ? properties.name ?? properties.zoneType ?? 'SUP AIP' : 'no-label'}`;
  const cached = styleCache.get(cacheKey);
  if (cached) return cached as Style;

  const colors = palette[status];
  const label = showLabel ? String(properties.name ?? properties.zoneType ?? 'SUP AIP') : '';
  const style = new Style({
    fill: new Fill({ color: colors.fill }),
    stroke: new Stroke({
      color: colors.stroke,
      width: status === 'active' ? 3.2 : 2.4,
      lineDash: colors.dash,
      lineCap: 'round',
      lineJoin: 'round'
    }),
    text: label ? new Text({
      text: label,
      font: '900 11px system-ui',
      fill: new Fill({ color: colors.text }),
      stroke: new Stroke({ color: 'rgba(5, 11, 18, 0.96)', width: 4 }),
      overflow: true
    }) : undefined
  });
  styleCache.set(cacheKey, style);
  return style;
}

function highlightStyles(feature: Feature<Geometry>, selectionOrder: number, active: boolean): Style | Style[] {
  const properties = featureProperties(feature);
  const status = getSupAipVisualStatus(properties);
  const colors = palette[status];
  const cacheKey = `highlight:${properties.id ?? 'unknown'}:${status}:${selectionOrder}:${active ? 'active' : 'dim'}`;
  const cached = styleCache.get(cacheKey);
  if (cached) return cached;

  const alpha = active ? 1 : 0.35;
  const styles: Style[] = [];

  if (active) {
    styles.push(new Style({
      stroke: new Stroke({ color: 'rgba(255,255,255,0.92)', width: 7.4, lineDash: colors.dash, lineCap: 'round', lineJoin: 'round' }),
      fill: new Fill({ color: 'rgba(255,255,255,0.05)' })
    }));
  }

  styles.push(new Style({
    fill: new Fill({ color: colors.fill.replace(/rgba\(([^)]+),\s*([0-9.]+)\)/, (_match, rgb, a) => `rgba(${rgb}, ${Math.min(1, Number(a) * (active ? 1.25 : alpha))})`) }),
    stroke: new Stroke({
      color: colors.stroke,
      width: active ? 4.3 : 2.8,
      lineDash: colors.dash,
      lineCap: 'round',
      lineJoin: 'round'
    }),
    text: active ? new Text({
      text: String(properties.name ?? properties.zoneType ?? 'SUP AIP'),
      font: '900 12px system-ui',
      fill: new Fill({ color: colors.text }),
      stroke: new Stroke({ color: 'rgba(5, 11, 18, 0.98)', width: 4 }),
      overflow: true,
      offsetY: -2
    }) : undefined
  }));

  styles.push(new Style({
    text: new Text({
      text: String(selectionOrder),
      font: '900 12px system-ui, sans-serif',
      fill: new Fill({ color: '#F9FBFF' }),
      backgroundFill: new Fill({ color: active ? 'rgba(83, 132, 255, 0.96)' : 'rgba(19, 34, 52, 0.92)' }),
      backgroundStroke: new Stroke({ color: active ? 'rgba(255,255,255,0.96)' : 'rgba(152, 198, 255, 0.80)', width: active ? 2 : 1.4 }),
      padding: [3, 7, 3, 7],
      overflow: true,
      offsetY: 16
    }),
    zIndex: active ? 1200 : 1100
  }));

  styleCache.set(cacheKey, styles);
  return styles;
}

export function createSupAipLayer({
  visible = false,
  onLoadStart,
  onLoadEnd,
  onLoadError
}: CreateSupAipLayerOptions = {}): SupAipLayer {
  const format = new GeoJSON({ featureProjection: 'EPSG:3857' });
  const source = new VectorSource<Feature<Geometry>>();
  let activeRequest = 0;
  let loadedAt: number | null = null;
  let loadedVersion: string | null = null;

  const layer = new VectorLayer({
    source,
    visible,
    style: defaultStyleFor,
    properties: {
      name: 'supaip-auto-beta-overlay',
      capclairLayerType: 'supaip-auto-beta'
    },
    renderBuffer: 160,
    updateWhileAnimating: false,
    updateWhileInteracting: false,
    zIndex: 16
  }) as SupAipLayer;

  const fetchFeatures = async (url: string, cache: RequestCache) => {
    const response = await fetch(url, {
      cache,
      headers: { Accept: 'application/geo+json, application/json' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const features = format.readFeatures(payload) as Feature<Geometry>[];
    if (features.length === 0) throw new Error('Base SUP AIP vide');
    return features;
  };

  layer.refreshData = async (datasetVersion = null) => {
    const requestId = ++activeRequest;
    onLoadStart?.();
    try {
      let features: Feature<Geometry>[];
      try {
        features = await fetchFeatures(SUP_AIP_DATASET_URL, 'no-cache');
      } catch (networkError) {
        if (source.getFeatures().length > 0) throw networkError;
        features = await fetchFeatures('/data/supaip-bootstrap.geojson', 'force-cache');
      }
      if (requestId !== activeRequest) return source.getFeatures().length;
      source.clear(true);
      source.addFeatures(features);
      loadedAt = Date.now();
      loadedVersion = datasetVersion;
      layer.changed();
      onLoadEnd?.(features.length);
      return features.length;
    } catch (error) {
      if (requestId === activeRequest) onLoadError?.();
      throw error;
    }
  };
  layer.lastLoadedAt = () => loadedAt;
  layer.loadedDatasetVersion = () => loadedVersion;
  return layer;
}

export function setSupAipSelectionHighlight(layer: SupAipLayer, selections: SupAipSelection[], selectedIndex: number) {
  const source = layer.getSource();
  if (!source) return;
  const orderById = new Map<string, number>();
  selections.forEach((selection, index) => orderById.set(selection.id, index + 1));
  const activeId = selections[Math.max(0, Math.min(selectedIndex, selections.length - 1))]?.id ?? null;

  source.getFeatures().forEach((feature) => {
    const featureId = String(feature.get('id') ?? '');
    const order = orderById.get(featureId);
    if (!order || !isSupAipFeatureVisible(feature)) {
      feature.setStyle(undefined);
      return;
    }
    feature.setStyle(highlightStyles(feature, order, featureId === activeId));
  });
  layer.changed();
}

export function supAipSelectionFromFeature(feature: Feature<Geometry>): SupAipSelection | null {
  if (!isSupAipFeatureVisible(feature)) return null;
  const properties = featureProperties(feature);
  if (!properties.id || !properties.name || !properties.supAip || !properties.sourcePdf) return null;

  return {
    id: properties.id,
    name: properties.name,
    zoneType: properties.zoneType ?? 'Zone temporaire',
    supAip: properties.supAip,
    title: properties.title ?? '',
    validFrom: properties.validFrom ?? '',
    validTo: properties.validTo ?? '',
    activationMode: properties.activationMode ?? 'published',
    activationText: properties.activationText ?? 'Consulter le PDF officiel.',
    activationWindowsUtc: properties.activationWindowsUtc,
    lowerLimit: properties.lowerLimit ?? '--',
    upperLimit: properties.upperLimit ?? '--',
    frequency: properties.frequency,
    sourcePdf: properties.sourcePdf,
    sourcePage: properties.sourcePage,
    beta: Boolean(properties.beta),
    dataScope: properties.dataScope,
    geometrySource: properties.geometrySource,
    geometryConfidence: properties.geometryConfidence,
    geometryWarnings: properties.geometryWarnings,
    verticalLimitsExtracted: properties.verticalLimitsExtracted,
    verticalLimitNotice: properties.verticalLimitNotice,
    sourcePageNumber: properties.sourcePageNumber,
    sourceFingerprint: properties.sourceFingerprint,
    parserVersion: properties.parserVersion,
    visualStatus: getSupAipVisualStatus(properties)
  };
}
