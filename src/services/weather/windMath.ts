import type { BranchWind } from '../../domain/navigation.types';

const toRad = (value: number) => (value * Math.PI) / 180;
const toDeg = (value: number) => (value * 180) / Math.PI;

export function windToComponents(wind: Pick<BranchWind, 'directionDeg' | 'speedKt'>) {
  const rad = toRad(wind.directionDeg);
  return {
    u: -wind.speedKt * Math.sin(rad),
    v: -wind.speedKt * Math.cos(rad)
  };
}

export function componentsToWind(u: number, v: number): BranchWind {
  const speedKt = Math.max(0, Math.round(Math.sqrt(u * u + v * v)));
  const directionDeg = Math.round((toDeg(Math.atan2(-u, -v)) + 360) % 360);
  return { directionDeg, speedKt };
}

export function averageWind(winds: BranchWind[]): BranchWind | null {
  if (!winds.length) return null;
  const sum = winds.reduce((acc, wind) => {
    const vector = windToComponents(wind);
    return { u: acc.u + vector.u, v: acc.v + vector.v };
  }, { u: 0, v: 0 });

  const averaged = componentsToWind(sum.u / winds.length, sum.v / winds.length);
  return {
    ...averaged,
    sourceTimeIso: winds[0]?.sourceTimeIso,
    provider: winds[0]?.provider
  };
}
