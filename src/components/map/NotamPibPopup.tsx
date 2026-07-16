import { useEffect } from 'react';
import type { NotamPibSelection } from '../../mapLayers/notamPibLayer';

interface NotamPibPopupProps {
  selections: NotamPibSelection[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onClose: () => void;
}

export function NotamPibPopup({ selections, selectedIndex, onSelectIndex, onClose }: NotamPibPopupProps) {
  const selection = selections[Math.min(selectedIndex, selections.length - 1)];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!selection) return null;
  return (
    <aside className="notam-map-popup" aria-label="Détail NOTAM" role="dialog" aria-modal="false">
      <div className="notam-map-popup-header">
        {selections.length > 1 ? (
          <div className="notam-map-popup-tabs" aria-label="Éléments superposés">
            {selections.map((item, index) => (
              <button
                type="button"
                key={item.id}
                className={index === selectedIndex ? 'active' : ''}
                onClick={() => onSelectIndex(index)}
                aria-label={`Afficher l’élément ${index + 1} sur ${selections.length}`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        ) : <span className="notam-map-popup-header-spacer" />}
        <button type="button" className="notam-map-popup-close" onClick={onClose} aria-label="Fermer">×</button>
      </div>
      <div className="notam-map-popup-body">
        <span className="notam-map-popup-beta">NOTAM / PIB BETA</span>
        <h3>{selection.title}</h3>
        <strong>{selection.notamId}{selection.supAipId ? ` - SUP AIP ${selection.supAipId}` : ''}</strong>
        <p>{selection.geometryLabel}</p>
        <p>{selection.temporalLabel}</p>
        {selection.warning && <p className="notam-map-popup-warning">{selection.warning}</p>}
        <details>
          <summary>Texte NOTAM complet</summary>
          <pre>{selection.rawText}</pre>
        </details>
      </div>
    </aside>
  );
}
