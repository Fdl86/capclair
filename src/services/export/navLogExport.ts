import type { AircraftProfile, FuelPlanConfig } from '../../domain/aircraft.types';
import type { NavRoute } from '../../domain/navigation.types';
import type { NavLogExportResult } from './navLogExport.types';
import { navLogFileName } from './navLogFileName';
import { renderNavLogPdf } from './navLogPdf';
import { buildNavLogSnapshot } from './navLogSnapshot';

export interface ExportNavLogPdfInput {
  route: NavRoute;
  aircraft: AircraftProfile;
  fuelPlanConfig: FuelPlanConfig;
  alternateCode: string;
}

let templatePromise: Promise<Uint8Array> | null = null;

function templateUrl(): string {
  return new URL('templates/fiche-nav-a4-paysage-v5.pdf', document.baseURI).toString();
}

async function loadTemplate(): Promise<Uint8Array> {
  if (!templatePromise) {
    templatePromise = fetch(templateUrl(), { cache: 'force-cache' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Gabarit PDF indisponible (${response.status}).`);
        return new Uint8Array(await response.arrayBuffer());
      })
      .catch((error) => {
        templatePromise = null;
        throw error;
      });
  }
  return templatePromise;
}

function downloadPdf(fileName: string, bytes: Uint8Array): void {
  const copy = Uint8Array.from(bytes);
  const blob = new Blob([copy.buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportNavLogPdf(input: ExportNavLogPdfInput): Promise<NavLogExportResult> {
  const snapshot = buildNavLogSnapshot(input);
  const fileName = navLogFileName(snapshot);
  const template = await loadTemplate();
  const pdfBytes = await renderNavLogPdf(snapshot, template);

  downloadPdf(fileName, pdfBytes);
  return {
    ok: true,
    mode: 'web-download',
    fileName,
    message: snapshot.warnings.length
      ? `Téléchargement lancé. ${snapshot.warnings.join(' ')}`
      : 'Téléchargement du PDF lancé.',
    omittedBranchCount: snapshot.omittedBranchCount,
    warnings: snapshot.warnings
  };
}
