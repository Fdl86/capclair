import { useEffect, useState } from 'react';
import type { AircraftProfile } from '../../domain/aircraft.types';
import { AIRCRAFT_LIMITS, clampNumber } from '../../services/aircraft/aircraftValidation';
import { Button } from '../ui/Button';

interface AircraftProfilePanelProps {
  profiles: AircraftProfile[];
  activeProfile: AircraftProfile;
  onSelectProfile: (profileId: string) => void;
  onUpdateProfile: (profileId: string, patch: Partial<AircraftProfile>) => void;
  onCreateProfile: () => void;
}

function NumericField({ label, value, unit, onCommit, step = 1, min, max }: {
  label: string;
  value: number;
  unit?: string;
  step?: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft.replace(',', '.'));
    const next = Number.isFinite(parsed) ? clampNumber(parsed, min, max) : value;
    setDraft(String(next));
    onCommit(next);
  };

  return (
    <label className="aircraft-field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
        />
        {unit && <small>{unit}</small>}
      </div>
    </label>
  );
}

export function AircraftProfilePanel({
  profiles,
  activeProfile,
  onSelectProfile,
  onUpdateProfile,
  onCreateProfile
}: AircraftProfilePanelProps) {
  const totalCapacityL = activeProfile.usableFuelL;
  const unusableFuelL = activeProfile.unusableFuelL ?? 0;
  const usableFuelL = Math.max(0, totalCapacityL - unusableFuelL);
  const capacityError = unusableFuelL > totalCapacityL;

  return (
    <div className="aircraft-profile-panel">
      <div className="subpanel-title-row">
        <div>
          <span>Profil aéronef</span>
          <strong>{activeProfile.label}</strong>
        </div>
        <Button variant="secondary" onClick={onCreateProfile}>+ Avion</Button>
      </div>

      <select className="aircraft-select" value={activeProfile.id} onChange={(event) => onSelectProfile(event.target.value)}>
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>{profile.label}</option>
        ))}
      </select>

      <div className="aircraft-identity-grid">
        <label>
          <span>Modèle</span>
          <input value={activeProfile.model} onChange={(event) => onUpdateProfile(activeProfile.id, { model: event.target.value })} />
        </label>
        <label>
          <span>Immat</span>
          <input value={activeProfile.registration} onChange={(event) => onUpdateProfile(activeProfile.id, { registration: event.target.value.toUpperCase() })} />
        </label>
      </div>

      <div className="aircraft-field-grid">
        <NumericField
          label="TAS croisière"
          value={activeProfile.cruiseTasKt}
          unit="kt"
          min={AIRCRAFT_LIMITS.cruiseTasKt.min}
          max={AIRCRAFT_LIMITS.cruiseTasKt.max}
          onCommit={(value) => onUpdateProfile(activeProfile.id, { cruiseTasKt: value })}
        />
        <NumericField
          label="Conso"
          value={activeProfile.fuelBurnLh}
          unit="L/h"
          step={0.5}
          min={AIRCRAFT_LIMITS.fuelBurnLh.min}
          max={AIRCRAFT_LIMITS.fuelBurnLh.max}
          onCommit={(value) => onUpdateProfile(activeProfile.id, { fuelBurnLh: value })}
        />
        <NumericField
          label="Capacité totale réservoirs"
          value={totalCapacityL}
          unit="L"
          step={0.5}
          min={AIRCRAFT_LIMITS.totalFuelCapacityL.min}
          max={AIRCRAFT_LIMITS.totalFuelCapacityL.max}
          onCommit={(value) => onUpdateProfile(activeProfile.id, { usableFuelL: value })}
        />
        <NumericField
          label="Carburant inutilisable"
          value={unusableFuelL}
          unit="L"
          step={0.5}
          min={AIRCRAFT_LIMITS.unusableFuelL.min}
          max={totalCapacityL}
          onCommit={(value) => onUpdateProfile(activeProfile.id, { unusableFuelL: value })}
        />
        <NumericField
          label="Réserve défaut"
          value={activeProfile.reserveMinutes}
          unit="min"
          min={AIRCRAFT_LIMITS.reserveMinutes.min}
          max={AIRCRAFT_LIMITS.reserveMinutes.max}
          onCommit={(value) => onUpdateProfile(activeProfile.id, { reserveMinutes: value })}
        />
        <NumericField
          label="Vitesse montée"
          value={activeProfile.climbSpeedKt}
          unit="kt"
          min={AIRCRAFT_LIMITS.speedKt.min}
          max={AIRCRAFT_LIMITS.speedKt.max}
          onCommit={(value) => onUpdateProfile(activeProfile.id, { climbSpeedKt: value })}
        />
        <NumericField
          label="Taux montée"
          value={activeProfile.climbRateFpm}
          unit="ft/min"
          step={50}
          min={AIRCRAFT_LIMITS.verticalRateFpm.min}
          max={AIRCRAFT_LIMITS.verticalRateFpm.max}
          onCommit={(value) => onUpdateProfile(activeProfile.id, { climbRateFpm: value })}
        />
        <NumericField
          label="Vitesse descente"
          value={activeProfile.descentSpeedKt}
          unit="kt"
          min={AIRCRAFT_LIMITS.speedKt.min}
          max={AIRCRAFT_LIMITS.speedKt.max}
          onCommit={(value) => onUpdateProfile(activeProfile.id, { descentSpeedKt: value })}
        />
        <NumericField
          label="Taux descente"
          value={activeProfile.descentRateFpm}
          unit="ft/min"
          step={50}
          min={AIRCRAFT_LIMITS.verticalRateFpm.min}
          max={AIRCRAFT_LIMITS.verticalRateFpm.max}
          onCommit={(value) => onUpdateProfile(activeProfile.id, { descentRateFpm: value })}
        />
      </div>

      <p className={`aircraft-note ${capacityError ? 'aircraft-note-error' : ''}`}>
        {capacityError
          ? 'Le carburant inutilisable ne peut pas dépasser la capacité totale.'
          : `Carburant utilisable calculé : ${usableFuelL.toFixed(1).replace('.', ',')} L. Valeurs à vérifier avec le manuel de vol et les données club.`}
      </p>
    </div>
  );
}
