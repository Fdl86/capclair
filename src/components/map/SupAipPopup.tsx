import type { SupAipSelection } from '../../domain/supaip.types';
import { formatSupAipDateRange, supAipStatusLabel } from '../../services/supaip/supAipStatus';

interface SupAipPopupProps {
  selection: SupAipSelection;
  onClose: () => void;
}

function hasExtractedVerticalLimits(selection: SupAipSelection): boolean {
  if (typeof selection.verticalLimitsExtracted === 'boolean') return selection.verticalLimitsExtracted;
  const lower = selection.lowerLimit?.trim();
  const upper = selection.upperLimit?.trim();
  return Boolean(lower && upper && lower.toLocaleLowerCase('fr-FR') !== 'à vérifier' && upper.toLocaleLowerCase('fr-FR') !== 'à vérifier');
}

export function SupAipPopup({ selection, onClose }: SupAipPopupProps) {
  const automaticGeometry = selection.geometrySource?.startsWith('automatic') ?? false;
  const verticalLimitsExtracted = hasExtractedVerticalLimits(selection);
  const geometryWarning = selection.geometryWarnings?.[0];

  return (
    <aside className={`supaip-popup status-${selection.visualStatus}`} aria-label={`Détail ${selection.name}`}>
      <div className="supaip-popup-heading">
        <div>
          <span>SUP AIP {selection.supAip} - AUTO BETA</span>
          <strong>{selection.name}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer le détail SUP AIP">×</button>
      </div>

      <div className="supaip-popup-status">
        <i aria-hidden="true" />
        <strong>{supAipStatusLabel(selection.visualStatus)}</strong>
      </div>

      <p>{selection.title}</p>
      <dl>
        <div><dt>Validité</dt><dd>{formatSupAipDateRange(selection.validFrom, selection.validTo)}</dd></div>
        <div>
          <dt>Vertical</dt>
          <dd>
            {verticalLimitsExtracted
              ? <strong className="supaip-vertical-value">{selection.lowerLimit} - {selection.upperLimit}</strong>
              : <span className="supaip-vertical-missing">{selection.verticalLimitNotice || 'Limites verticales non extraites - consulter le PDF SIA'}</span>}
          </dd>
        </div>
        <div><dt>Activation</dt><dd>{selection.activationText}</dd></div>
        {selection.frequency && <div><dt>Information</dt><dd>{selection.frequency}</dd></div>}
        {automaticGeometry && (
          <div>
            <dt>Géométrie</dt>
            <dd>
              Extraite automatiquement du PDF SIA
              {selection.sourcePageNumber ? ` - page ${selection.sourcePageNumber}` : ''}
              {selection.geometryConfidence === 'medium' ? ' - contrôle renforcé conseillé' : ''}
              {geometryWarning ? <span className="supaip-geometry-warning">{geometryWarning}</span> : null}
            </dd>
          </div>
        )}
      </dl>

      <div className="supaip-popup-actions">
        <a href={selection.sourcePdf} target="_blank" rel="noreferrer">PDF SIA officiel</a>
        <button type="button" onClick={onClose}>Fermer</button>
      </div>

      <small>Surimpression BETA. Toujours vérifier le PDF SIA, SOFIA et les NOTAM avant le vol.</small>
    </aside>
  );
}
