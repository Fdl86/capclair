import type { CSSProperties, ReactNode } from 'react';
import type { BranchZoneBlock, BranchZoneProfile, AirspaceType } from '../../domain/airspace.types';
import type { NavPoint, NavRoute } from '../../domain/navigation.types';
import type { TerrainSample } from '../../services/navigation/terrainService';

interface VerticalProfileBannerProps {
  route: NavRoute;
  profiles: Record<string, BranchZoneProfile>;
  terrainSamples?: TerrainSample[];
}

interface GlobalZoneBlock extends BranchZoneBlock {
  globalStart: number;
  globalEnd: number;
  branchId: string;
}

interface RouteMarker {
  code: string;
  distanceNm: number;
  ratio: number;
  type: NavPoint['type'];
}

interface PlannedAltitudeSegment {
  id: string;
  altitudeFt: number;
  startRatio: number;
  endRatio: number;
}

interface ProfileBounds {
  min: number;
  max: number;
}

const TYPE_ORDER: Record<AirspaceType, number> = {
  CTR: 100,
  TMA: 96,
  CTA: 92,
  R: 86,
  D: 82,
  P: 80,
  RMZ: 72,
  TMZ: 70,
  SIV: 58
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pointById(route: NavRoute, id: string): NavPoint | null {
  return route.points.find((point) => point.id === id) ?? null;
}

function pointCode(route: NavRoute, id: string): string {
  const point = pointById(route, id);
  return point?.code ?? point?.nom ?? id.toUpperCase();
}

function pointLabel(point: NavPoint): string {
  if (point.type === 'depart') return point.code ?? 'D';
  if (point.type === 'destination') return point.code ?? 'A';
  return point.code ?? point.nom;
}

function routeMarkers(route: NavRoute): RouteMarker[] {
  const markers: RouteMarker[] = [];
  const total = Math.max(1, route.distanceTotale);
  let cumulativeDistance = 0;

  route.points.forEach((point, index) => {
    if (index === 0) {
      markers.push({ code: pointLabel(point), distanceNm: 0, ratio: 0, type: point.type });
      return;
    }

    const branch = route.branches[index - 1];
    cumulativeDistance += branch?.distanceNm ?? 0;
    markers.push({
      code: pointLabel(point),
      distanceNm: Number(cumulativeDistance.toFixed(1)),
      ratio: clamp(cumulativeDistance / total, 0, 1),
      type: point.type
    });
  });

  return markers;
}

function buildGlobalBlocks(route: NavRoute, profiles: Record<string, BranchZoneProfile>): GlobalZoneBlock[] {
  const total = Math.max(1, route.distanceTotale);
  let cumulativeDistance = 0;
  const blocks: GlobalZoneBlock[] = [];

  for (const branch of route.branches) {
    const profile = profiles[branch.id];
    const branchDistance = branch.distanceNm;
    const branchStart = cumulativeDistance;

    if (profile) {
      for (const block of profile.blocks) {
        const globalStart = clamp((branchStart + block.startRatio * branchDistance) / total, 0, 1);
        const globalEnd = clamp((branchStart + block.endRatio * branchDistance) / total, 0, 1);
        if (globalEnd <= globalStart) continue;
        blocks.push({ ...block, branchId: branch.id, globalStart, globalEnd });
      }
    }

    cumulativeDistance += branchDistance;
  }

  return blocks
    .sort((a, b) => {
      const aInside = a.containsPlannedAltitude ? 1 : 0;
      const bInside = b.containsPlannedAltitude ? 1 : 0;
      return bInside - aInside || (TYPE_ORDER[b.zoneType] ?? 0) - (TYPE_ORDER[a.zoneType] ?? 0) || b.priority - a.priority;
    })
    .slice(0, 48);
}

function plannedAltitudeSegments(route: NavRoute): PlannedAltitudeSegment[] {
  const total = Math.max(1, route.distanceTotale);
  let cumulativeDistance = 0;

  return route.branches.map((branch) => {
    const start = cumulativeDistance / total;
    cumulativeDistance += branch.distanceNm;
    const end = cumulativeDistance / total;
    return {
      id: branch.id,
      altitudeFt: branch.altitudeFt,
      startRatio: clamp(start, 0, 1),
      endRatio: clamp(end, 0, 1)
    };
  });
}

function scaleBounds(route: NavRoute, blocks: GlobalZoneBlock[], terrainSamples: TerrainSample[] = []): ProfileBounds {
  const maxBranchAltitude = Math.max(route.profile.defaultAltitudeFt, ...route.branches.map((branch) => branch.altitudeFt));
  const usefulCeilings = blocks
    .filter((block) => block.containsPlannedAltitude || block.altitudeRelation === 'uncertain' || block.floorFt <= maxBranchAltitude + 2000)
    .map((block) => Math.min(block.ceilingFt, 14500));
  const maxTerrain = terrainSamples.length ? Math.max(...terrainSamples.map((sample) => sample.elevationFt)) : 0;
  const rawMax = Math.max(4500, maxBranchAltitude + 1200, maxTerrain + 1200, ...usefulCeilings);
  const roundedMax = Math.ceil(rawMax / 500) * 500;
  return { min: 0, max: clamp(roundedMax, 4500, 14500) };
}

function altitudeY(altitudeFt: number, bounds: ProfileBounds): number {
  return clamp(100 - ((altitudeFt - bounds.min) / (bounds.max - bounds.min)) * 100, 0, 100);
}

function blockStyle(block: GlobalZoneBlock, bounds: ProfileBounds): CSSProperties {
  const left = block.globalStart * 100;
  const width = Math.max(1.5, (block.globalEnd - block.globalStart) * 100);
  const top = altitudeY(Math.min(block.ceilingFt, bounds.max), bounds);
  const bottom = 100 - altitudeY(Math.max(block.floorFt, bounds.min), bounds);
  return {
    left: `${clamp(left, 0, 99)}%`,
    width: `${clamp(width, 1.5, 100 - left)}%`,
    top: `${clamp(top, 0, 98)}%`,
    bottom: `${clamp(bottom, 0, 98)}%`
  };
}

function altitudeLineStyle(segment: PlannedAltitudeSegment, bounds: ProfileBounds): CSSProperties {
  const left = segment.startRatio * 100;
  const width = Math.max(1.5, (segment.endRatio - segment.startRatio) * 100);
  return {
    left: `${clamp(left, 0, 99)}%`,
    width: `${clamp(width, 1.5, 100 - left)}%`,
    top: `${altitudeY(segment.altitudeFt, bounds)}%`
  };
}

function markerStyle(marker: RouteMarker): CSSProperties {
  return { left: `${clamp(marker.ratio * 100, 0, 100)}%` };
}

function blockLabel(block: BranchZoneBlock): string {
  const classLabel = block.classCode ? ` ${block.classCode}` : '';
  return `${block.zoneType} ${block.zoneName}${classLabel}`;
}

function contactLabel(block?: BranchZoneBlock): string {
  if (!block?.contact?.frequency) return 'À confirmer';
  return `${block.contact.callsign} ${block.contact.frequency}`;
}

function blockRelationClass(block: BranchZoneBlock): string {
  if (block.containsPlannedAltitude) return 'inside';
  if (block.altitudeRelation === 'uncertain') return 'uncertain';
  return block.altitudeRelation;
}

function blockTypeClass(block: BranchZoneBlock): string {
  return `type-${block.zoneType.toLowerCase()}`;
}

function shouldShowBlockName(block: GlobalZoneBlock): boolean {
  const width = (block.globalEnd - block.globalStart) * 100;
  return block.containsPlannedAltitude || width >= 8;
}

function axisLevels(bounds: ProfileBounds): number[] {
  const step = Math.max(500, Math.ceil((bounds.max - bounds.min) / 4 / 500) * 500);
  const levels: number[] = [];
  for (let level = bounds.min; level <= bounds.max; level += step) levels.push(level);
  if (!levels.includes(bounds.max)) levels.push(bounds.max);
  return levels.sort((a, b) => b - a).slice(0, 6);
}

function altitudeLabel(value: number): string {
  return value <= 0 ? 'SFC' : `${Math.round(value)} ft`;
}

function bestActiveBlocks(profiles: Record<string, BranchZoneProfile>): { primary?: BranchZoneBlock; secondary?: BranchZoneBlock } {
  const active = Object.values(profiles).flatMap((profile) => profile.activeBlocks);
  const sorted = [...active].sort((a, b) => b.priority - a.priority);
  const primary = sorted[0];
  const secondary = sorted.find((block) => block.zoneId !== primary?.zoneId);
  return { primary, secondary };
}

function legendBlocks(blocks: GlobalZoneBlock[]): GlobalZoneBlock[] {
  const byZone = new Map<string, GlobalZoneBlock>();
  for (const block of blocks) {
    const key = `${block.zoneId}:${block.floorFt}:${block.ceilingFt}`;
    const current = byZone.get(key);
    if (!current || (block.containsPlannedAltitude && !current.containsPlannedAltitude) || block.priority > current.priority) {
      byZone.set(key, block);
    }
  }

  return [...byZone.values()]
    .sort((a, b) => {
      const aInside = a.containsPlannedAltitude ? 1 : 0;
      const bInside = b.containsPlannedAltitude ? 1 : 0;
      return bInside - aInside || (TYPE_ORDER[b.zoneType] ?? 0) - (TYPE_ORDER[a.zoneType] ?? 0) || a.zoneName.localeCompare(b.zoneName);
    })
    .slice(0, 18);
}

function terrainPolygonPoints(samples: TerrainSample[], bounds: ProfileBounds): string {
  if (!samples.length) return '';
  const profilePoints = samples
    .map((sample) => `${(sample.distanceRatio * 100).toFixed(2)},${altitudeY(sample.elevationFt, bounds).toFixed(2)}`)
    .join(' ');
  return `0,100 ${profilePoints} 100,100`;
}

function Section({ title, meta, defaultOpen = false, children }: { title: string; meta?: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details className="vertical-profile-section" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        {meta && <strong>{meta}</strong>}
      </summary>
      <div className="vertical-profile-section-body">{children}</div>
    </details>
  );
}

export function VerticalProfileBanner({ route, profiles, terrainSamples = [] }: VerticalProfileBannerProps) {
  const blocks = buildGlobalBlocks(route, profiles);
  const bounds = scaleBounds(route, blocks, terrainSamples);
  const markers = routeMarkers(route);
  const altitudeSegments = plannedAltitudeSegments(route);
  const contacts = bestActiveBlocks(profiles);
  const legend = legendBlocks(blocks);
  const terrainPoints = terrainPolygonPoints(terrainSamples, bounds);
  const activeCount = blocks.filter((block) => block.containsPlannedAltitude).length;

  return (
    <div className="vertical-profile-banner">
      <Section title="Profil vertical" meta={`${route.distanceTotale.toFixed(1)} NM`} defaultOpen>
        <div className="vertical-profile-body">
          <div className="vertical-profile-axis" aria-hidden="true">
            {axisLevels(bounds).map((level) => (
              <span key={level} style={{ top: `${altitudeY(level, bounds)}%` }}>
                {altitudeLabel(level)}
              </span>
            ))}
          </div>

          <div className="vertical-profile-canvas" aria-label="Profil vertical zones et terrain">
            {terrainPoints && (
              <svg className="vertical-terrain-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polygon points={terrainPoints} />
              </svg>
            )}

            {axisLevels(bounds).map((level) => (
              <div key={`grid-${level}`} className="vertical-profile-gridline" style={{ top: `${altitudeY(level, bounds)}%` }} />
            ))}

            {altitudeSegments.map((segment) => (
              <div key={`alt-${segment.id}`} className="vertical-profile-altitude-line" style={altitudeLineStyle(segment, bounds)}>
                <span>{segment.altitudeFt} ft</span>
              </div>
            ))}

            {blocks.map((block) => {
              const relation = blockRelationClass(block);
              const labelVisible = shouldShowBlockName(block);
              return (
                <div
                  key={block.id}
                  className={`vertical-zone-block ${blockTypeClass(block)} ${relation}`}
                  style={blockStyle(block, bounds)}
                  title={`${blockLabel(block)} - ${block.floorLabel} / ${block.ceilingLabel}`}
                >
                  {labelVisible && <b>{block.zoneType} {block.zoneName}</b>}
                  {block.containsPlannedAltitude && <small>{block.floorLabel} - {block.ceilingLabel}</small>}
                </div>
              );
            })}

            {markers.slice(1, -1).map((marker) => (
              <div key={`separator-${marker.code}-${marker.distanceNm}`} className="vertical-branch-separator" style={markerStyle(marker)} />
            ))}

            <div className="vertical-profile-route-baseline" />
            {markers.map((marker) => (
              <div key={`marker-${marker.code}-${marker.distanceNm}`} className={`vertical-profile-marker ${marker.type}`} style={markerStyle(marker)}>
                <i />
                <b>{marker.code}</b>
                <small>{marker.distanceNm.toFixed(1)} NM</small>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Zones présentes" meta={activeCount ? `${activeCount} à l'altitude prévue` : 'À vérifier'}>
        {legend.length ? (
          <div className="vertical-profile-legend">
            {legend.map((block) => (
              <span key={`legend-${block.id}`} className={`${blockTypeClass(block)} ${blockRelationClass(block)}`}>
                <i />
                <b>{block.zoneType}</b>
                <em>{block.zoneName}</em>
              </span>
            ))}
          </div>
        ) : (
          <p className="vertical-profile-muted">Aucune zone calculée sur ce profil. Vérifier la carte et la documentation officielle.</p>
        )}
      </Section>

      <Section title="Contacts" meta={contacts.primary ? contactLabel(contacts.primary) : 'À confirmer'}>
        <div className="vertical-profile-contact-row">
          <div>
            <span>Principal</span>
            <strong>{contacts.primary ? blockLabel(contacts.primary) : 'À confirmer'}</strong>
            <small>{contactLabel(contacts.primary)}</small>
          </div>
          <div>
            <span>Secondaire</span>
            <strong>{contacts.secondary ? blockLabel(contacts.secondary) : 'Aucun clair'}</strong>
            <small>{contactLabel(contacts.secondary)}</small>
          </div>
          <div>
            <span>Lecture</span>
            <p>{blocks.length ? `Profil calculé sur ${route.distanceTotale.toFixed(1)} NM. Terrain affiché si disponible.` : 'Aucune zone principale fiable. Vérifier carte et documentation.'}</p>
          </div>
        </div>
      </Section>
    </div>
  );
}
