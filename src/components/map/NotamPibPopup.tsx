import type { NotamPibSelection } from '../../mapLayers/notamPibLayer';

interface NotamPibPopupProps {
  selections: NotamPibSelection[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onClose: () => void;
}

export function NotamPibPopup({ selections, selectedIndex, onSelectIndex, onClose }: NotamPibPopupProps) {
  const selection = selections[Math.min(selectedIndex, selections.length - 1)];
  if (!selection) return null;
  return (
    <aside className="notam-map-popup" aria-label="Détail NOTAM">
      <button type="button" className="notam-map-popup-close" onClick={onClose} aria-label="Fermer">×</button>
      {selections.length > 1 && (
        <div className="notam-map-popup-tabs">
          {selections.map((item, index) => <button type="button" key={item.id} className={index === selectedIndex ? 'active' : ''} onClick={() => onSelectIndex(index)}>{index + 1}</button>)}
        </div>
      )}
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
    </aside>
  );
}
