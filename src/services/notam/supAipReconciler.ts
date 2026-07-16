import type { SupAipReconciliation, SupAipReference, SupAipReconciliationStatus } from '../../domain/notam.types';

interface ManifestPublication {
  supAip: string;
  title?: string;
  mappedGeometryCount?: number;
  expectedNamedGeometryCount?: number | null;
  status?: string;
  sourcePdf?: string;
}

interface UnmappedPublication extends ManifestPublication {
  validFrom?: string;
  validTo?: string;
  reason?: string;
  partial?: boolean;
  conservative?: boolean;
  fallback?: boolean;
}

interface SupAipIndexes {
  manifest: Map<string, ManifestPublication>;
  unmapped: Map<string, UnmappedPublication>;
  featureCounts: Map<string, number>;
}

let indexesPromise: Promise<SupAipIndexes> | null = null;

function normalize(value: string) {
  const match = value.match(/0*(\d{1,3})\s*\/\s*(\d{2})/);
  return match ? `${String(Number(match[1])).padStart(3, '0')}/${match[2]}` : value.trim();
}

async function loadIndexes(): Promise<SupAipIndexes> {
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      fetch('/data/supaip-manifest.json').then((response) => {
        if (!response.ok) throw new Error('Manifest SUP AIP indisponible');
        return response.json();
      }),
      fetch('/data/supaip-unmapped.json').then((response) => {
        if (!response.ok) throw new Error('Statut SUP AIP indisponible');
        return response.json();
      }),
      fetch('/data/supaip-current.geojson').then((response) => {
        if (!response.ok) throw new Error('Géométries SUP AIP indisponibles');
        return response.json();
      })
    ]).then(([manifestJson, unmappedJson, geoJson]) => {
      const manifest = new Map<string, ManifestPublication>();
      const unmapped = new Map<string, UnmappedPublication>();
      const featureCounts = new Map<string, number>();
      for (const publication of manifestJson.publications ?? []) manifest.set(normalize(publication.supAip), publication);
      for (const publication of unmappedJson.publications ?? []) unmapped.set(normalize(publication.supAip), publication);
      for (const feature of geoJson.features ?? []) {
        const ref = normalize(String(feature.properties?.supAip ?? ''));
        if (ref) featureCounts.set(ref, (featureCounts.get(ref) ?? 0) + 1);
      }
      return { manifest, unmapped, featureCounts };
    });
  }
  return indexesPromise;
}

function statusFor(publication: ManifestPublication | undefined, detail: UnmappedPublication | undefined, count: number): SupAipReconciliationStatus {
  if (!publication && !detail && count === 0) return 'absent';
  if (detail?.partial || detail?.status === 'partial') return count > 0 ? 'partial' : 'unmapped';
  if (detail?.conservative || detail?.status === 'conservative') return 'conservative';
  if (detail?.fallback || detail?.status === 'fallback') return 'fallback';
  if (count === 0) return 'unmapped';
  return 'mapped';
}

function missingNames(reason: string | undefined) {
  if (!reason) return [];
  return [...reason.matchAll(/(?:ZRT|ZDT|ZRT\/ZDT)\s+([^:.;]+):\s*limites latérales non extraites/gi)].map((match) => match[0].split(':')[0].trim());
}

function warningFor(status: SupAipReconciliationStatus, detail: UnmappedPublication | undefined) {
  const reason = detail?.reason?.trim();
  if (status === 'partial') return `SUP AIP signalé dans le briefing mais partiellement cartographié dans CAP CLAIR.${reason ? ` ${reason}` : ''}`;
  if (status === 'unmapped') return `SUP AIP signalé dans le briefing mais non cartographié dans CAP CLAIR.${reason ? ` ${reason}` : ''}`;
  if (status === 'absent') return 'SUP AIP signalé dans le briefing mais absent de la base CAP CLAIR.';
  if (status === 'conservative') return `SUP AIP présent dans CAP CLAIR, affiché avec prudence.${reason ? ` ${reason}` : ''}`;
  if (status === 'fallback') return `SUP AIP présent dans CAP CLAIR avec une géométrie de repli.${reason ? ` ${reason}` : ''}`;
  return reason ?? null;
}

export async function reconcileSupAipReferences(references: SupAipReference[]): Promise<SupAipReconciliation[]> {
  const indexes = await loadIndexes();
  return references.map((reference) => {
    const id = normalize(reference.id);
    const publication = indexes.manifest.get(id);
    const detail = indexes.unmapped.get(id);
    const count = indexes.featureCounts.get(id) ?? publication?.mappedGeometryCount ?? detail?.mappedGeometryCount ?? 0;
    const status = statusFor(publication, detail, count);
    return {
      reference: { ...reference, id },
      status,
      title: detail?.title ?? publication?.title ?? null,
      sourcePdf: detail?.sourcePdf ?? publication?.sourcePdf ?? null,
      validFrom: detail?.validFrom ?? null,
      validTo: detail?.validTo ?? null,
      mappedGeometryCount: count,
      expectedGeometryCount: detail?.expectedNamedGeometryCount ?? publication?.expectedNamedGeometryCount ?? null,
      missingGeometryNames: missingNames(detail?.reason),
      warning: warningFor(status, detail)
    };
  });
}
