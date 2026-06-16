interface MapScaleSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const values = ['Auto', '1/500 000', '1/1 000 000', 'Fond simplifié'];

export function MapScaleSelector({ value, onChange }: MapScaleSelectorProps) {
  return (
    <div className="scale-selector" role="group" aria-label="Sélecteur de carte">
      {values.map((item) => (
        <button key={item} type="button" className={value === item ? 'active' : ''} onClick={() => onChange(item)}>
          {item}
        </button>
      ))}
    </div>
  );
}
