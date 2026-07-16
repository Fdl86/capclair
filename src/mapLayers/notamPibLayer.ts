import Feature from 'ol/Feature';
import GeoJSON from 'ol/format/GeoJSON';
import Point from 'ol/geom/Point';
import Polygon, { circular } from 'ol/geom/Polygon';
import type Geometry from 'ol/geom/Geometry';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style';
import { fromLonLat } from 'ol/proj';
import type { NotamLayerSettings, ParsedNotam, PibAnalysis } from '../domain/notam.types';

export type NotamPibGeometryKind = 'sup-exact' | 'e-polygon' | 'e-point' | 'q-approximation' | 'missing-sup-approximation';

export interface NotamPibSelection {
  id: string;
  notamId: string;
  title: string;
  kind: NotamPibGeometryKind;
  geometryLabel: string;
  warning: string | null;
  rawText: string;
  supAipId: string | null;
  temporalLabel: string;
}

export type NotamPibLayer = VectorLayer<VectorSource<Feature<Geometry>>>;

const exactSupStyle = new Style({
  stroke: new Stroke({ color: 'rgba(43, 207, 255, 0.98)', width: 3 }),
  fill: new Fill({ color: 'rgba(43, 207, 255, 0.11)' })
});
const exactPolygonStyle = new Style({
  stroke: new Stroke({ color: 'rgba(206, 112, 255, 0.98)', width: 3 }),
  fill: new Fill({ color: 'rgba(206, 112, 255, 0.12)' })
});
const pointStyle = new Style({
  image: new CircleStyle({
    radius: 7,
    fill: new Fill({ color: 'rgba(255, 224, 112, 0.95)' }),
    stroke: new Stroke({ color: 'rgba(5, 11, 18, 0.98)', width: 2 })
  })
});
const approximationStyle = new Style({
  stroke: new Stroke({ color: 'rgba(255, 169, 70, 0.95)', width: 2, lineDash: [9, 7] }),
  fill: new Fill({ color: 'rgba(255, 169, 70, 0.055)' })
});
const activeApproximationStyle = new Style({
  stroke: new Stroke({ color: 'rgba(255, 169, 70, 0.98)', width: 2.5, lineDash: [9, 7] }),
  fill: new Fill({ color: 'rgba(255, 169, 70, 0.07)' }),
  text: new Text({
    text: 'Approximation Q',
    font: '700 10px system-ui, sans-serif',
    fill: new Fill({ color: 'rgba(255, 215, 158, 0.96)' }),
    stroke: new Stroke({ color: 'rgba(5, 11, 18, 0.9)', width: 3 }),
    overflow: true
  })
});
const missingSupStyle = new Style({
  stroke: new Stroke({ color: 'rgba(255, 93, 93, 0.98)', width: 3, lineDash: [7, 5] }),
  fill: new Fill({ color: 'rgba(255, 93, 93, 0.08)' }),
  text: new Text({
    text: 'SUP AIP non cartographié - approximation Q',
    font: '800 10px system-ui, sans-serif',
    fill: new Fill({ color: 'rgba(255, 205, 205, 0.98)' }),
    stroke: new Stroke({ color: 'rgba(5, 11, 18, 0.95)', width: 3 }),
    overflow: true
  })
});
const cancelledStyle = new Style({
  stroke: new Stroke({ color: 'rgba(155, 166, 178, 0.8)', width: 2, lineDash: [4, 6] }),
  fill: new Fill({ color: 'rgba(100, 110, 120, 0.04)' })
});

function styleForFeature(feature: Feature<Geometry>) {
  if (feature.get('cancelled')) return cancelledStyle;
  switch (feature.get('kind') as NotamPibGeometryKind) {
    case 'sup-exact': return exactSupStyle;
    case 'e-polygon': return exactPolygonStyle;
    case 'e-point': return pointStyle;
    case 'missing-sup-approximation': return missingSupStyle;
    default: return feature.get('showApproximationLabel') ? activeApproximationStyle : approximationStyle;
  }
}

let supGeoJsonPromise: Promise<any> | null = null;
const updateRevisions = new WeakMap<NotamPibLayer, number>();

function loadSupGeoJson() {
  if (!supGeoJsonPromise) {
    supGeoJsonPromise = fetch('/data/supaip-current.geojson').then((response) => {
      if (!response.ok) throw new Error('Base SUP AIP indisponible');
      return response.json();
    }).catch((cause) => {
      supGeoJsonPromise = null;
      throw cause;
    });
  }
  return supGeoJsonPromise;
}

function temporalLabel(notam: ParsedNotam) {
  switch (notam.temporalStatus) {
    case 'active': return 'Créneau interprété actif';
    case 'future': return 'Créneau futur';
    case 'ended': return 'Créneau terminé';
    case 'published': return 'Publication en vigueur';
    case 'complex': return 'Horaire à vérifier';
    default: return 'Temporalité non interprétée';
  }
}

function selectionFor(notam: ParsedNotam, kind: NotamPibGeometryKind, title: string, supAipId: string | null, warning: string | null): NotamPibSelection {
  const geometryLabel: Record<NotamPibGeometryKind, string> = {
    'sup-exact': 'Géométrie SUP AIP issue de la base SIA CAP CLAIR',
    'e-polygon': 'Géométrie précise extraite explicitement du champ E',
    'e-point': 'Position précise extraite du champ E',
    'q-approximation': 'Zone d’influence NOTAM approximative issue du champ Q',
    'missing-sup-approximation': 'SUP AIP non cartographié - cercle Q approximatif uniquement'
  };
  return {
    id: `${notam.id}:${kind}:${supAipId ?? title}`,
    notamId: notam.id,
    title,
    kind,
    geometryLabel: geometryLabel[kind],
    warning,
    rawText: notam.rawText,
    supAipId,
    temporalLabel: temporalLabel(notam)
  };
}

function notamPassesFilter(notam: ParsedNotam, analysis: PibAnalysis, settings: NotamLayerSettings) {
  if (settings.filter === 'all') return true;
  if (settings.filter === 'route') return ['departure', 'destination', 'alternate', 'route'].includes(notam.routeRelevance);
  if (settings.filter === 'supaip') return notam.supAipReferences.length > 0;
  if (settings.filter === 'active') return notam.temporalStatus === 'active';
  return notam.temporalStatus === 'active'
    || ['complex', 'unknown'].includes(notam.temporalStatus)
    || notam.interpretationStatus === 'uninterpreted'
    || notam.supAipReferences.some((reference) => analysis.reconciliations.some((item) => item.reference.id === reference.id && ['partial', 'unmapped', 'absent'].includes(item.status)));
}

function addIndependentFeatures(
  source: VectorSource<Feature<Geometry>>,
  notam: ParsedNotam,
  analysis: PibAnalysis,
  allowMappedSupApproximation = false
) {
  const matchedSup = notam.supAipReferences
    .map((reference) => analysis.reconciliations.find((item) => item.reference.id === reference.id))
    .filter(Boolean);
  const hasMappedSup = matchedSup.some((item) => (item?.mappedGeometryCount ?? 0) > 0);
  const missingSup = matchedSup.find((item) => item && ['unmapped', 'absent'].includes(item.status));
  const cancelled = notam.lifecycleType === 'cancel' || notam.supAipReferences.some((reference) => reference.action === 'cancelled');

  if (notam.exactPolygon) {
    const coordinates = notam.exactPolygon.map((coordinate) => fromLonLat([coordinate.longitude, coordinate.latitude]));
    const selection = selectionFor(notam, 'e-polygon', `${notam.id} - contour du champ E`, notam.supAipReferences[0]?.id ?? null, 'Comparer ce contour avec le PDF officiel et la base SUP AIP avant utilisation opérationnelle.');
    source.addFeature(new Feature({ geometry: new Polygon([coordinates]), kind: 'e-polygon', selection, cancelled }));
    return;
  }

  const precisePointCode = /Q(?:OB|OL)/.test(notam.fields.q?.code ?? '');
  if (precisePointCode && notam.eCoordinates.length > 0) {
    notam.eCoordinates.forEach((coordinate, index) => {
      const selection = selectionFor(notam, 'e-point', `${notam.id} - position ${index + 1}`, null, null);
      source.addFeature(new Feature({ geometry: new Point(fromLonLat([coordinate.longitude, coordinate.latitude])), kind: 'e-point', selection, cancelled }));
    });
    return;
  }

  if (hasMappedSup && !allowMappedSupApproximation) return;
  if (notam.fields.q?.center && notam.fields.q.radiusNm !== null) {
    const kind: NotamPibGeometryKind = missingSup ? 'missing-sup-approximation' : 'q-approximation';
    const center = notam.fields.q.center;
    const geometry = circular([center.longitude, center.latitude], notam.fields.q.radiusNm * 1852, 64).transform('EPSG:4326', 'EPSG:3857');
    const supId = missingSup?.reference.id ?? notam.supAipReferences[0]?.id ?? null;
    const warning = kind === 'missing-sup-approximation'
      ? `SUP AIP ${supId} signalé dans le briefing mais non cartographié dans CAP CLAIR. Ce cercle ne représente pas la limite officielle.`
      : hasMappedSup
        ? `La géométrie SUP AIP ${supId ?? ''} n’a pas pu être chargée. Le cercle Q est affiché uniquement comme aide approximative.`
        : 'Le cercle Q indique seulement une zone d’influence approximative et ne constitue pas une limite aéronautique officielle.';
    const selection = selectionFor(notam, kind, supId ? `SUP AIP ${supId}` : notam.id, supId, warning);
    source.addFeature(new Feature({
      geometry,
      kind,
      selection,
      cancelled,
      showApproximationLabel: kind === 'q-approximation' && notam.temporalStatus === 'active'
    }));
  }
}

export function createNotamPibLayer(): NotamPibLayer {
  return new VectorLayer({
    source: new VectorSource(),
    visible: false,
    zIndex: 34,
    style: (feature) => styleForFeature(feature as Feature<Geometry>)
  });
}

export async function updateNotamPibLayer(layer: NotamPibLayer, analysis: PibAnalysis | null, settings: NotamLayerSettings) {
  const revision = (updateRevisions.get(layer) ?? 0) + 1;
  updateRevisions.set(layer, revision);
  const source = layer.getSource();
  source?.clear(true);
  layer.setVisible(Boolean(analysis && settings.enabled));
  if (!analysis || !settings.enabled || !source) return 0;

  const visibleNotams = analysis.notams.filter((notam) => notamPassesFilter(notam, analysis, settings));
  for (const notam of visibleNotams) addIndependentFeatures(source, notam, analysis);

  const citedSup = new Map<string, ParsedNotam[]>();
  for (const notam of visibleNotams) {
    for (const reference of notam.supAipReferences) {
      const reconciliation = analysis.reconciliations.find((item) => item.reference.id === reference.id);
      if ((reconciliation?.mappedGeometryCount ?? 0) <= 0) continue;
      const entries = citedSup.get(reference.id) ?? [];
      entries.push(notam);
      citedSup.set(reference.id, entries);
    }
  }

  if (citedSup.size > 0) {
    try {
      const geoJson = await loadSupGeoJson();
      if (updateRevisions.get(layer) !== revision) return 0;
      const relevantFeatures = (geoJson.features ?? []).filter((feature: any) => citedSup.has(String(feature.properties?.supAip ?? '')));
      const parsed = new GeoJSON().readFeatures({ type: 'FeatureCollection', features: relevantFeatures }, { featureProjection: 'EPSG:3857' }) as Feature<Geometry>[];
      for (const baseFeature of parsed) {
        const supId = String(baseFeature.get('supAip') ?? '');
        const linkedNotams = citedSup.get(supId) ?? [];
        const reconciliation = analysis.reconciliations.find((item) => item.reference.id === supId);
        const warning = reconciliation?.status === 'conservative'
          ? 'Géométrie CAP CLAIR affichée avec prudence: au moins une exclusion interne n’est pas découpée.'
          : reconciliation?.status === 'partial'
            ? 'Publication partiellement cartographiée. Consulter obligatoirement le PDF SIA.'
            : null;
        for (const notam of linkedNotams) {
          const feature = baseFeature.clone();
          feature.set('kind', 'sup-exact');
          feature.set('selection', selectionFor(notam, 'sup-exact', String(feature.get('name') ?? `SUP AIP ${supId}`), supId, warning));
          feature.set('cancelled', notam.lifecycleType === 'cancel' || notam.supAipReferences.some((reference) => reference.action === 'cancelled'));
          source.addFeature(feature);
        }
      }
    } catch {
      if (updateRevisions.get(layer) !== revision) return 0;
      for (const notam of visibleNotams) {
        const hasMappedReference = notam.supAipReferences.some((reference) => {
          const reconciliation = analysis.reconciliations.find((item) => item.reference.id === reference.id);
          return (reconciliation?.mappedGeometryCount ?? 0) > 0;
        });
        if (hasMappedReference) addIndependentFeatures(source, notam, analysis, true);
      }
    }
  }

  return updateRevisions.get(layer) === revision ? source.getFeatures().length : 0;
}

export function notamPibSelectionFromFeature(feature: Feature<Geometry>): NotamPibSelection | null {
  const selection = feature.get('selection') as NotamPibSelection | undefined;
  return selection ?? null;
}
