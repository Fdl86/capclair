import { describe, expect, it } from 'vitest';
import fixture from '../../src/services/notam/__fixtures__/sofia-lfbi-lfou.txt?raw';
import type { BriefingRouteSnapshot } from '../../src/domain/notam.types';
import { normalizeSofiaText } from '../../src/services/notam/sofiaText';
import { parsePibRouteContext } from '../../src/services/notam/pibContextParser';
import { parseNotams } from '../../src/services/notam/notamParser';

const route: BriefingRouteSnapshot = {
  routeId: 'test',
  routeName: 'LFBI > LFOU',
  departure: 'LFBI',
  destination: 'LFOU',
  alternates: ['LFJB', 'LFCT'],
  departureTimeIso: '2026-07-16T07:15:00Z',
  maxAltitudeFt: 3500,
  points: [
    { id: 'lfbi', nom: 'Poitiers', code: 'LFBI', type: 'depart', latitude: 46.5877, longitude: 0.3067 },
    { id: 'lfou', nom: 'Cholet', code: 'LFOU', type: 'destination', latitude: 47.0821, longitude: -0.8771 }
  ],
  signature: 'fixture'
};

describe('SOFIA PIB parser', () => {
  const text = normalizeSofiaText(fixture);
  const context = parsePibRouteContext(text);
  const notams = parseNotams(text, context, route);

  it('detects the route metadata from the real SOFIA fixture', () => {
    expect(context.type).toBe('PIB TRAJET');
    expect(context.departure).toBe('LFBI');
    expect(context.destination).toBe('LFOU');
    expect(context.alternates).toEqual(['LFJB', 'LFCT']);
    expect(context.departureTimeIso).toBe('2026-07-16T07:15:00Z');
    expect(context.floorFl).toBe(0);
    expect(context.ceilingFl).toBe(115);
    expect(context.radiusNm).toBe(30);
    expect(context.halfCorridorNm).toBe(15);
  });

  it('parses all NOTAM blocks across page boundaries', () => {
    expect(notams).toHaveLength(36);
    expect(notams.find((notam) => notam.id === 'LFFA-B3027/26')?.fields.e).toContain('INDISPONIBLE');
    expect(notams.every((notam) => notam.fields.q !== null)).toBe(true);
  });

  it('detects and normalizes the three SUP AIP references', () => {
    const references = [...new Set(notams.flatMap((notam) => notam.supAipReferences.map((reference) => reference.id)))];
    expect(references).toEqual(['077/26', '207/25', '055/26']);
    expect(notams.find((notam) => notam.id === 'LFFA-R1871/26')?.supAipReferences[0]?.action).toBe('modified');
  });

  it('extracts the LFDB21Z polygon and simple active schedules', () => {
    const polygon = notams.find((notam) => notam.id === 'LFFA-R1871/26');
    expect(polygon?.eCoordinates).toHaveLength(34);
    expect(polygon?.exactPolygon).toHaveLength(34);
    expect(notams.find((notam) => notam.id === 'LFFA-F1552/26')?.temporalStatus).toBe('active');
    expect(notams.find((notam) => notam.id === 'LFFA-F1558/26')?.temporalStatus).toBe('active');
  });

  it('does not interpret SR-SS as a certain active schedule', () => {
    expect(notams.find((notam) => notam.id === 'LFFA-W0947/26')?.temporalStatus).toBe('complex');
  });

  it('accepts ICAO B/C fields, a multiline Q field and removes exact duplicates', () => {
    const block = `LFFA-R9999/26 NOTAMN
Q) LFBB / QRTCA / IV / BO / W /
000/095 / 4635N00018E005
A)LFBB
B)2607160700
C)2607161600
E) TEST DE PARSING MULTILIGNE
F) SFC
G) FL095`;
    const parsed = parseNotams(`${block}\n${block}`, context, route);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].lifecycleType).toBe('new');
    expect(parsed[0].fields.validFromIso).toBe('2026-07-16T07:00:00Z');
    expect(parsed[0].fields.validToIso).toBe('2026-07-16T16:00:00Z');
    expect(parsed[0].fields.q).toMatchObject({ lowerFl: 0, upperFl: 95, radiusNm: 5 });
  });
});
