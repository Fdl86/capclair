import type { BranchZoneBlock, BranchZoneProfile } from '../../domain/airspace.types';
import type { NavBranch, NavRoute } from '../../domain/navigation.types';

interface ZoneCompleteRouteBannerProps {
  route: NavRoute;
  profiles: Record<string, BranchZoneProfile>;
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
}

function pointName(route: NavRoute, id: string) {
  const point = route.points.find((item) => item.id === id);
  return point?.code ?? point?.nom ?? id.toUpperCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function plannedAltitude(route: NavRoute) {
  const altitudes = route.branches.map((branch) => branch.altitudeFt);
  if (!altitudes.length) return route.profile.defaultAltitudeFt;
  const first = altitudes[0];
  return altitudes.every((altitude) => altitude === first) ? first : first;
}

function buildRouteMarkers(route: NavRoute): RouteMarker[] {
  let distance = 0;
  const total = Math.max(1, route.distanceTotale);
  const markers: RouteMarker[] = [];

  if (route.points[0]) {
    markers.push({ code: pointName(route, route.points[0].id), distanceNm: 0, ratio: 0 });
  }

  route.branches.forEach((branch) => {
    distance += branch.distanceNm;
    markers.push({ code: pointName(route, branch.to), distanceNm: Number(distance.toFixed(1)), ratio: clamp(distance / total, 0, 1) });
  });

  return markers;
}

function buildGlobalBlocks(route: NavRoute, profiles: Record<string, BranchZoneProfile>): GlobalZoneBlock[] {
  const total = Math.max(1, route.distanceTotale);
  let cumulative = 0;
  const blocks: GlobalZoneBlock[] = [];

  for (const branch of route.branches) {
    const profile = profiles[branch.id];
    if (profile) {
      const branchStart = cumulative;
      const branchDistance = branch.distanceNm;
      for (const block of profile.blocks) {
        blocks.push({
          ...block,
          branchId: branch.id,
          globalStart: clamp((branchStart + block.startRatio * branchDistance) / total, 0, 1),
          globalEnd: clamp((branchStart + block.endRatio * branchDistance) / total, 0, 1)
        });
      }
    }
    cumulative += branch.distanceNm;
  }

  return blocks
    .filter((block) => block.globalEnd > block.globalStart)
    .sort((a, b) => b.priority - a.priority || a.floorFt - b.floorFt)
    .slice(0, 48);
}

function scaleBounds(route: NavRoute, blocks: GlobalZoneBlock[]) {
  const altitude = plannedAltitude(route);
  const relevant = blocks.filter((block) => block.floorFt < 18000);
  const maxCeiling = Math.max(
    altitude + 1000,
    ...relevant.map((block) => Math.min(block.ceilingFt, 14000)),
    3000
  );
  return { min: 0, max: Math.min(Math.max(maxCeiling, 4500), 14000) };
}

function blockStyle(block: GlobalZoneBlock, min: number, max: number) {
  const top = 100 - ((Math.min(block.ceilingFt, max) - min) / (max - min)) * 100;
  const bottom = ((Math.max(block.floorFt, min) - min) / (max - min)) * 100;
  const left = block.globalStart * 100;
  const width = Math.max(3, (block.globalEnd - block.globalStart) * 100);

  return {
    left: `${clamp(left, 0, 98)}%`,
    width: `${clamp(width, 3, 100 - left)}%`,
    top: `${clamp(top, 2, 96)}%`,
    bottom: `${clamp(bottom, 2, 96)}%`
  };
}

function altitudeStyle(altitudeFt: number, min: number, max: number) {
  const y = 100 - ((altitudeFt - min) / (max - min)) * 100;
  return { top: `${clamp(y, 2, 98)}%` };
}

function blockLabel(block: BranchZoneBlock) {
  const classLabel = block.classCode ? ` ${block.classCode}` : '';
  return `${block.zoneType} ${block.zoneName}${classLabel}`;
}

function contactLabel(block?: BranchZoneBlock) {
  if (!block?.contact?.frequency) return 'À confirmer';
  return `${block.contact.callsign} ${block.contact.frequency}`;
}

function bestActiveBlocks(profiles: Record<string, BranchZoneProfile>) {
  const active = Object.values(profiles).flatMap((profile) => profile.activeBlocks);
  const sorted = active.sort((a, b) => b.priority - a.priority);
  const primary = sorted[0];
  const secondary = sorted.find((block) => block.zoneId !== primary?.zoneId);
  return { primary, secondary };
}

function markerStyle(marker: RouteMarker) {
  return { left: `${clamp(marker.ratio * 100, 0, 100)}%` };
}

export function ZoneCompleteRouteBanner({ route, profiles }: ZoneCompleteRouteBannerProps) {
  const blocks = buildGlobalBlocks(route, profiles);
  const bounds = scaleBounds(route, blocks);
  const altitude = plannedAltitude(route);
  const markers = buildRouteMarkers(route);
  const contacts = bestActiveBlocks(profiles);
  const visibleBlocks = blocks.filter((block) => block.ceilingFt > bounds.min && block.floorFt < bounds.max);

  return (
    <div className="complete-zone-frieze">
      <div className="complete-zone-frieze-head">
        <div>
          <span>Frise zones</span>
          <strong>Navigation complète</strong>
        </div>
        <div>
          <span>ALT planifiée</span>
          <strong>{altitude} ft</strong>
        </div>
        <div>
          <span>Distance</span>
          <strong>{route.distanceTotale.toFixed(1)} NM</strong>
        </div>
      </div>

      <div className="complete-zone-frieze-body">
        <div className="complete-zone-axis">
          <span>{bounds.max} ft</span>
          <span>{Math.round(bounds.max * 0.75)} ft</span>
          <span>{Math.round(bounds.max * 0.5)} ft</span>
          <span>{Math.round(bounds.max * 0.25)} ft</span>
          <span>SFC</span>
        </div>

        <div className="complete-zone-canvas">
          <div className="complete-zone-altitude-line" style={altitudeStyle(altitude, bounds.min, bounds.max)}>
            <span>ALT planifiée {altitude} ft</span>
          </div>

          {visibleBlocks.map((block, index) => (
            <div
              key={`${block.id}:${index}`}
              className={`complete-zone-block ${block.zoneType.toLowerCase()} ${block.status}`}
              style={blockStyle(block, bounds.min, bounds.max)}
              title={`${blockLabel(block)} - ${block.floorLabel} / ${block.ceilingLabel}`}
            >
              <b>{block.zoneType} {block.zoneName}</b>
              <small>{block.floorLabel} - {block.ceilingLabel}</small>
              <em>{block.contact?.frequency ?? 'À confirmer'}</em>
            </div>
          ))}

          <div className="complete-zone-route-line" />
          {markers.map((marker, index) => (
            <div key={`${marker.code}:${index}`} className="complete-zone-marker" style={markerStyle(marker)}>
              <i />
              <b>{marker.code}</b>
              <small>{marker.distanceNm.toFixed(1)} NM</small>
            </div>
          ))}
        </div>
      </div>

      <div className="complete-zone-contact-row">
        <div>
          <span>Contact principal</span>
          <strong>{contacts.primary ? blockLabel(contacts.primary) : 'À confirmer'}</strong>
          <small>{contactLabel(contacts.primary)}</small>
        </div>
        <div>
          <span>Contact secondaire</span>
          <strong>{contacts.secondary ? blockLabel(contacts.secondary) : 'Aucun clair'}</strong>
          <small>{contactLabel(contacts.secondary)}</small>
        </div>
        <div>
          <span>Remarque</span>
          <p>{contacts.primary ? `Zones calculées par position et altitude sur ${route.distanceTotale.toFixed(1)} NM.` : 'Aucune zone principale fiable. Vérifier carte et documentation.'}</p>
        </div>
      </div>

      <div className="complete-zone-legend">
        <span className="inside">Dans la zone</span>
        <span className="below">Sous la zone</span>
        <span className="above">Au-dessus</span>
        <span className="confirm">Doute / à confirmer</span>
      </div>
    </div>
  );
}
