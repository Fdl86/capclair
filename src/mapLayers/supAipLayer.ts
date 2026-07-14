import Feature, { type FeatureLike } from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import type Geometry from 'ol/geom/Geometry';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Fill, Stroke, Style, Text } from 'ol/style';
import type { SupAipProperties, SupAipSelection, SupAipVisualStatus } from '../domain/supaip.types';
import { getSupAipVisualStatus } from '../services/supaip/supAipStatus';

export type SupAipLayer = VectorLayer<VectorSource<Feature<Geometry>>>;

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

const styleCache = new Map<string, Style>();

function featureProperties(feature: FeatureLike): Partial<SupAipProperties> {
  return feature.getProperties() as Partial<SupAipProperties>;
}

function styleFor(feature: FeatureLike, resolution: number): Style {
  const properties = featureProperties(feature);
  const status = getSupAipVisualStatus(properties);
  const showLabel = resolution <= 2500;
  const cacheKey = `${status}:${showLabel ? properties.name ?? properties.zoneType ?? 'SUP AIP' : 'no-label'}`;
  const cached = styleCache.get(cacheKey);
  if (cached) return cached;

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

export function createSupAipLayer({
  visible = false,
  onLoadStart,
  onLoadEnd,
  onLoadError
}: CreateSupAipLayerOptions = {}): SupAipLayer {
  const source = new VectorSource<Feature<Geometry>>({
    url: '/data/supaip-beta.geojson',
    format: new GeoJSON({ featureProjection: 'EPSG:3857' })
  });

  source.on('featuresloadstart', () => onLoadStart?.());
  source.on('featuresloadend', () => onLoadEnd?.(source.getFeatures().length));
  source.on('featuresloaderror', () => onLoadError?.());

  return new VectorLayer({
    source,
    visible,
    style: styleFor,
    properties: {
      name: 'supaip-beta-overlay',
      capclairLayerType: 'supaip-beta'
    },
    renderBuffer: 160,
    updateWhileAnimating: false,
    updateWhileInteracting: false,
    zIndex: 16
  });
}

export function supAipSelectionFromFeature(feature: Feature<Geometry>): SupAipSelection | null {
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
    visualStatus: getSupAipVisualStatus(properties)
  };
}
