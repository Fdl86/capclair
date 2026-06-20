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

function formatMinutes(value: number) {
  return `${Math.round(value)} min`;
}

function numberValue(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function EditableMinute({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="fuel-input">
      <span>{label}</span>
      <div>
        <input type="number" min={0} step={1} value={value} onChange={(event) => onChange(numberValue(event.target.value, value))} />
        <small>min</small>
      </div>
    </label>
  );
}

function EditableLiter({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="fuel-input">
      <span>{label}</span>
      <div>
        <input type="number" min={0} step={1} value={value} onChange={(event) => onChange(numberValue(event.target.value, value))} />
        <small>L</small>
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
    <div className="fuel-planning-panel">
      <div className="subpanel-title-row">
        <div>
          <span>Devis carburant</span>
          <strong>Minutes + litres</strong>
        </div>
        <em>{formatLiters(fuel.fuelPerHourL)} - {fuel.fuelPerMinuteL.toFixed(2).replace('.', ',')} L/min</em>
      </div>

      <div className="fuel-input-grid">
        <EditableMinute label="Roulage départ" value={config.taxiDepartureMin} onChange={(value) => onChangeConfig({ taxiDepartureMin: value })} />
        <EditableMinute label="Arrivée" value={config.arrivalMin} onChange={(value) => onChangeConfig({ arrivalMin: value })} />
        <EditableMinute label="Arr. déroutement" value={config.alternateArrivalMin} onChange={(value) => onChangeConfig({ alternateArrivalMin: value })} />
        <EditableMinute label="Réserve finale" value={config.finalReserveMin} onChange={(value) => onChangeConfig({ finalReserveMin: value })} />
        <EditableMinute label="Marge" value={config.marginMin} onChange={(value) => onChangeConfig({ marginMin: value })} />
        <EditableLiter label="Vol à bord" value={config.fuelOnBoardL} onChange={(value) => onChangeConfig({ fuelOnBoardL: value })} />
      </div>

      <div className="fuel-meta-grid">
        <span><b>Conso</b>{formatLiters(fuel.fuelPerHourL)} / {fuel.fuelPerMinuteL.toFixed(2).replace('.', ',')} L/min</span>
        <span><b>Essence non utilisable</b>{formatLiters(fuel.unusableFuelL)}</span>
      </div>

      <div className="fuel-table">
        <FuelRow line={fuel.lines.route} />
        <FuelRow line={fuel.lines.taxiDeparture} />
        <FuelRow line={fuel.lines.arrival} />
        <FuelRow line={fuel.lines.diversion} />
        <FuelRow line={fuel.lines.alternateArrival} />
        <FuelRow line={fuel.lines.finalReserve} />
        <FuelRow line={fuel.lines.margin} />
        <FuelRow line={fuel.lines.totalMinimum} strong />
        <FuelRow line={fuel.lines.regulatory} strong />
        <div className="fuel-row strong">
          <span>Vol à bord</span>
          <strong>-</strong>
          <b>{formatLitersCompact(fuel.fuelOnBoardL)}</b>
        </div>
        <div className="fuel-row strong">
          <span>Heure limite</span>
          <strong>{formatMinutes(fuel.lines.timeLimit.minutes)}</strong>
          <b>{formatLitersCompact(fuel.lines.timeLimit.liters)}</b>
        </div>
      </div>

      <div className={`fuel-margin ${fuel.remainingAfterMinimumL >= 0 ? 'ok' : 'warn'}`}>
        <strong>Marge restante après minimum</strong>
        <span>{formatLiters(fuel.remainingAfterMinimumL)}</span>
      </div>
    </div>
  );
}
