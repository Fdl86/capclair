import { useEffect, useState } from 'react';
import type { FuelLine, FuelPlanConfig, FuelPlanSummary } from '../../domain/aircraft.types';

interface FuelPlanningPanelProps {
  fuel: FuelPlanSummary;
  config: FuelPlanConfig;
  onChangeConfig: (patch: Partial<FuelPlanConfig>) => void;
}

function formatLiters(value: number) {
  return `${value.toFixed(1).replace('.', ',')} L`;
}

function formatLitersCompact(value: number) {
  return `${Math.round(value)} L`;
}

function formatMinutes(value: number | null) {
  return value === null ? '-' : `${Math.round(value)} min`;
}

function EditableNumber({ label, value, unit, step, max, onChange }: {
  label: string;
  value: number;
  unit: string;
  step: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft.replace(',', '.'));
    const next = Number.isFinite(parsed) ? Math.max(0, Math.min(max, parsed)) : value;
    setDraft(String(next));
    onChange(next);
  };

  return (
    <label className="fuel-input fuel-input-compact">
      <span>{label}</span>
      <div>
        <input
          type="number"
          min={0}
          max={max}
          step={step}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
        <small>{unit}</small>
      </div>
    </label>
  );
}

function FuelRow({ line, strong = false }: { line: FuelLine; strong?: boolean }) {
  return (
    <div className={`fuel-row ${strong ? 'strong' : ''}`}>
      <span>{line.label}</span>
      <strong>{formatMinutes(line.minutes)}</strong>
      <b>{formatLiters(line.liters)}</b>
    </div>
  );
}

export function FuelPlanningPanel({ fuel, config, onChangeConfig }: FuelPlanningPanelProps) {
  return (
    <div className="fuel-planning-panel fuel-planning-panel-compact">
      <div className="fuel-premium-head">
        <div>
          <span>Devis carburant</span>
          <strong>Minutes + litres</strong>
        </div>
        <em><span>Consommation horaire / minute</span>{formatLiters(fuel.fuelPerHourL)} - {fuel.fuelPerMinuteL.toFixed(2).replace('.', ',')} L/min</em>
      </div>

      <div className="fuel-input-grid fuel-input-grid-compact fuel-input-grid-minimal">
        <EditableNumber label="Réserve finale" value={config.finalReserveMin} unit="min" step={1} max={180} onChange={(value) => onChangeConfig({ finalReserveMin: value })} />
        <EditableNumber label="Marge" value={config.marginLiters ?? 0} unit="L" step={0.5} max={500} onChange={(value) => onChangeConfig({ marginLiters: value })} />
      </div>

      {!fuel.isFuelDataValid && (
        <div className="fuel-capacity-alert danger">
          Données carburant invalides. Vérifiez la consommation, la capacité totale et le carburant inutilisable dans le profil avion.
        </div>
      )}

      {fuel.isFuelDataValid && !fuel.isCapacitySufficient && (
        <div className="fuel-capacity-alert danger">
          Capacité insuffisante : il manque {formatLiters(fuel.fuelDeficitL)} pour ce devis.
        </div>
      )}

      <div className="fuel-table fuel-table-compact">
        <FuelRow line={fuel.lines.route} />
        <FuelRow line={fuel.lines.taxiDeparture} />
        <FuelRow line={fuel.lines.arrival} />
        <FuelRow line={fuel.lines.diversion} />
        <FuelRow line={fuel.lines.alternateArrival} />
        <FuelRow line={fuel.lines.finalReserve} />
        <FuelRow line={fuel.lines.totalNecessary} strong />
        <FuelRow line={fuel.lines.margin} />
        <FuelRow line={fuel.lines.fuelRequired} strong />
      </div>

      <div className="fuel-kpi-strip">
        <div>
          <span>Emport carburant</span>
          <strong>{formatLitersCompact(fuel.lines.fuelRequired.liters)}</strong>
        </div>
        <div>
          <span>Autonomie capacité utile</span>
          <strong>{formatMinutes(fuel.enduranceMinutes)}</strong>
        </div>
        <div className={!fuel.isCapacitySufficient ? 'fuel-kpi-danger' : ''}>
          <span>{fuel.isCapacitySufficient ? 'Reste capacité utile' : 'Déficit capacité'}</span>
          <strong>{formatLitersCompact(fuel.isCapacitySufficient ? fuel.remainingUsableFuelL : fuel.fuelDeficitL)}</strong>
        </div>
      </div>
    </div>
  );
}
