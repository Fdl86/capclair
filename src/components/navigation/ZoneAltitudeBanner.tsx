import type { NavBranch, NavRoute } from '../../domain/navigation.types';
import type { BranchZoneBlock, BranchZoneProfile } from '../../domain/airspace.types';

interface ZoneAltitudeBannerProps {
  route: NavRoute;
  profiles: Record<string, BranchZoneProfile>;
}

function pointName(route: NavRoute, id: string) {
  const point = route.points.find((item) => item.id === id);
  return point?.code ?? point?.nom ?? id.toUpperCase();
}

function branchName(route: NavRoute, branch: NavBranch) {
  return `${pointName(route, branch.from)} - ${pointName(route, branch.to)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function scaleBounds(profile: BranchZoneProfile) {
  const relevant = profile.blocks.filter((block) => block.floorFt < 18000);
  const maxCeiling = Math.max(
    profile.plannedAltitudeFt + 1000,
    ...relevant.map((block) => Math.min(block.ceilingFt, 14000)),
    3000
  );
  return { min: 0, max: Math.min(Math.max(maxCeiling, 4500), 14000) };
}

function blockStyle(block: BranchZoneBlock, min: number, max: number) {
  const top = 100 - ((Math.min(block.ceilingFt, max) - min) / (max - min)) * 100;
  const bottom = ((Math.max(block.floorFt, min) - min) / (max - min)) * 100;
  const left = block.startRatio * 100;
  const width = Math.max(6, (block.endRatio - block.startRatio) * 100);

  return {
    left: `${clamp(left, 0, 98)}%`,
    width: `${clamp(width, 4, 100 - left)}%`,
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
  if (!block?.contact?.frequency) return 'Fréq à confirmer';
  return `${block.contact.callsign} - ${block.contact.frequency}`;
}

export function ZoneAltitudeBanner({ route, profiles }: ZoneAltitudeBannerProps) {
  return (
    <div className="zone-altitude-banner-list">
      {route.branches.map((branch) => {
        const profile = profiles[branch.id];
        const bounds = scaleBounds(profile);
        const visibleBlocks = profile.blocks
          .filter((block) => block.ceilingFt > bounds.min && block.floorFt < bounds.max)
          .slice(0, 12);

        return (
          <div key={branch.id} className="zone-altitude-banner-card">
            <div className="zone-altitude-banner-head">
              <div>
                <span>{branchName(route, branch)}</span>
                <strong>{profile.label}</strong>
              </div>
              <div>
                <span>Contact</span>
                <strong>{contactLabel(profile.primaryBlock)}</strong>
              </div>
            </div>

            <div className="zone-altitude-banner-body">
              <div className="zone-altitude-axis">
                <span>{bounds.max} ft</span>
                <span>{Math.round(bounds.max / 2)} ft</span>
                <span>SFC</span>
              </div>
              <div className="zone-altitude-canvas">
                <div className="zone-altitude-line" style={altitudeStyle(profile.plannedAltitudeFt, bounds.min, bounds.max)}>
                  <span>{profile.plannedAltitudeFt} ft</span>
                </div>
                {visibleBlocks.map((block) => (
                  <div
                    key={block.id}
                    className={`zone-altitude-block ${block.zoneType.toLowerCase()} ${block.status}`}
                    style={blockStyle(block, bounds.min, bounds.max)}
                    title={`${blockLabel(block)} - ${block.floorLabel} / ${block.ceilingLabel}`}
                  >
                    <b>{block.zoneType} {block.zoneName}</b>
                    <small>{block.floorLabel} - {block.ceilingLabel}</small>
                  </div>
                ))}
                <div className="zone-altitude-progress-labels">
                  <span>{pointName(route, branch.from)}</span>
                  <span>{pointName(route, branch.to)}</span>
                </div>
              </div>
            </div>

            <div className="zone-altitude-banner-foot">
              {profile.secondaryBlocks.length ? (
                <span>Secondaire : {profile.secondaryBlocks.map(blockLabel).join(' / ')}</span>
              ) : (
                <span>{profile.caution ? 'À confirmer carte' : 'Zone principale claire'}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
