import type { AirspaceCatalogItem, AirspacePart, AirspaceType, BranchZoneBlock, BranchZoneProfile } from '../../domain/airspace.types';
import type { NavBranch, NavPoint, NavRoute } from '../../domain/navigation.types';

const ROUTE_BBOX_MARGIN = 0.08;

const TYPE_PRIORITY: Record<AirspaceType, number> = {
  CTR: 100,
  TMA: 92,
  CTA: 84,
  RMZ: 78,
  TMZ: 76,
  R: 72,
  D: 70,
  P: 68,
  SIV: 42
};

function pointById(points: NavPoint[], id: string): NavPoint | null {
  return points.find((point) => point.id === id) ?? null;
}

function bboxIntersects(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function buildBranchBbox(from: NavPoint, to: NavPoint): [number, number, number, number] {
  return [
    Math.min(from.latitude, to.latitude) - ROUTE_BBOX_MARGIN,
    Math.min(from.longitude, to.longitude) - ROUTE_BBOX_MARGIN,
    Math.max(from.latitude, to.latitude) + ROUTE_BBOX_MARGIN,
    Math.max(from.longitude, to.longitude) + ROUTE_BBOX_MARGIN
  ];
}

function pointInPolygon(latitude: number, longitude: number, polygon: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const yi = polygon[i][0];
    const xi = polygon[i][1];
    const yj = polygon[j][0];
    const xj = polygon[j][1];
    const intersects = ((yi > latitude) !== (yj > latitude)) &&
      longitude < ((xj - xi) * (latitude - yi)) / ((yj - yi) || 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}


function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

function segmentPolygonHitRatios(from: NavPoint, to: NavPoint, polygon: Array<[number, number]>): number[] {
  if (polygon.length < 3) return [];
  const px = from.longitude;
  const py = from.latitude;
  const rx = to.longitude - from.longitude;
  const ry = to.latitude - from.latitude;
  const lengthSquared = rx * rx + ry * ry;
  const epsilon = 1e-10;
  const ratios: number[] = [];

  if (pointInPolygon(from.latitude, from.longitude, polygon)) ratios.push(0);
  if (pointInPolygon(to.latitude, to.longitude, polygon)) ratios.push(1);
  if (lengthSquared <= epsilon) return ratios;

  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    const qx = a[1];
    const qy = a[0];
    const sx = b[1] - a[1];
    const sy = b[0] - a[0];
    const qpx = qx - px;
    const qpy = qy - py;
    const denominator = cross(rx, ry, sx, sy);

    if (Math.abs(denominator) <= epsilon) {
      if (Math.abs(cross(qpx, qpy, rx, ry)) > epsilon) continue;
      const t0 = (qpx * rx + qpy * ry) / lengthSquared;
      const t1 = t0 + (sx * rx + sy * ry) / lengthSquared;
      const overlapStart = Math.max(0, Math.min(t0, t1));
      const overlapEnd = Math.min(1, Math.max(t0, t1));
      if (overlapStart <= overlapEnd + epsilon) ratios.push(overlapStart, overlapEnd);
      continue;
    }

    const t = cross(qpx, qpy, sx, sy) / denominator;
    const u = cross(qpx, qpy, rx, ry) / denominator;
    if (t >= -epsilon && t <= 1 + epsilon && u >= -epsilon && u <= 1 + epsilon) {
      ratios.push(Math.max(0, Math.min(1, t)));
    }
  }

  return ratios
    .sort((a, b) => a - b)
    .filter((ratio, index, values) => index === 0 || Math.abs(ratio - values[index - 1]) > 1e-7);
}
function altitudeRelation(altitudeFt: number, part: AirspacePart): BranchZoneBlock['altitudeRelation'] {
  if (part.verticalUncertain) return 'uncertain';
  if (altitudeFt < part.floorFt) return 'below';
  if (altitudeFt > part.ceilingFt) return 'above';
  return 'inside';
}

function blockPriority(zone: AirspaceCatalogItem, part: AirspacePart, containsAltitude: boolean): number {
  let value = TYPE_PRIORITY[zone.type] ?? 10;
  if (containsAltitude) value += 100;
  if (part.verticalUncertain) value -= 15;
  if (zone.contacts.length) value += 8;
  return value;
}

function zoneLabel(block?: BranchZoneBlock): string {
  if (!block) return 'À confirmer';
  const classLabel = block.classCode ? ` ${block.classCode}` : '';
  return `${block.zoneType} ${block.zoneName}${classLabel}`;
}

function frequencyLabel(block?: BranchZoneBlock): string {
  if (!block?.contact?.frequency) return 'À confirmer';
  return block.contact.frequency;
}

function uniqueBlocks(blocks: BranchZoneBlock[]): BranchZoneBlock[] {
  const bestByKey = new Map<string, BranchZoneBlock>();
  for (const block of blocks) {
    const key = `${block.zoneId}:${block.floorFt}:${block.ceilingFt}:${block.startRatio.toFixed(2)}:${block.endRatio.toFixed(2)}`;
    const current = bestByKey.get(key);
    if (!current || block.priority > current.priority) bestByKey.set(key, block);
  }
  return [...bestByKey.values()];
}

function buildBlocksForBranch(route: NavRoute, branch: NavBranch, catalog: AirspaceCatalogItem[]): BranchZoneBlock[] {
  const from = pointById(route.points, branch.from);
  const to = pointById(route.points, branch.to);
  if (!from || !to) return [];

  const routeBbox = buildBranchBbox(from, to);
  const blocks: BranchZoneBlock[] = [];

  for (const zone of catalog) {
    for (const part of zone.parts) {
      if (!bboxIntersects(routeBbox, part.bbox)) continue;

      const hitRatios = segmentPolygonHitRatios(from, to, part.points);
      if (!hitRatios.length) continue;

      const relation = altitudeRelation(branch.altitudeFt, part);
      const containsPlannedAltitude = relation === 'inside' || relation === 'uncertain';
      const startRatio = hitRatios[0];
      const endRatio = hitRatios.at(-1)!;
      const contact = zone.contacts[0];
      const status: BranchZoneBlock['status'] = containsPlannedAltitude
        ? relation === 'uncertain' ? 'confirm' : 'activeAltitude'
        : 'crossedOutAltitude';

      blocks.push({
        id: `${branch.id}:${zone.id}:${part.id}`,
        zoneId: zone.id,
        zoneName: zone.name,
        zoneType: zone.type,
        classCode: part.classCode,
        floorFt: part.floorFt,
        ceilingFt: part.ceilingFt,
        floorLabel: part.floorLabel,
        ceilingLabel: part.ceilingLabel,
        verticalUncertain: part.verticalUncertain,
        startRatio,
        endRatio,
        containsPlannedAltitude,
        altitudeRelation: relation,
        contact,
        priority: blockPriority(zone, part, containsPlannedAltitude),
        status
      });
    }
  }

  return uniqueBlocks(blocks).sort((a, b) => b.priority - a.priority || a.floorFt - b.floorFt);
}

export function buildZoneProfilesFromCatalog(route: NavRoute, catalog: AirspaceCatalogItem[]): Record<string, BranchZoneProfile> {
  const profiles: Record<string, BranchZoneProfile> = {};

  for (const branch of route.branches) {
    const blocks = buildBlocksForBranch(route, branch, catalog);
    const activeBlocks = blocks.filter((block) => block.containsPlannedAltitude);
    const primaryBlock = activeBlocks[0] ?? blocks[0];
    const secondaryBlocks = activeBlocks.filter((block) => block.id !== primaryBlock?.id).slice(0, 3);

    profiles[branch.id] = {
      branchId: branch.id,
      plannedAltitudeFt: branch.altitudeFt,
      blocks: blocks.slice(0, 18),
      activeBlocks,
      primaryBlock,
      secondaryBlocks,
      label: zoneLabel(primaryBlock),
      frequencyLabel: frequencyLabel(primaryBlock),
      caution: blocks.some((block) => block.verticalUncertain) || !primaryBlock || secondaryBlocks.length > 0
    };
  }

  return profiles;
}


export async function buildZoneProfiles(route: NavRoute): Promise<Record<string, BranchZoneProfile>> {
  const module = await import('../../data/airspaceCatalog');
  return buildZoneProfilesFromCatalog(route, module.AIRSPACE_CATALOG);
}
