import { useCallback, useRef, useState } from 'react';
import type { GpsPosition } from '../domain/gps.types';
import { toGpsPosition } from '../services/gps/geolocationService';

const POSITION_MAX_AGE_MS = 120_000;

export function useOneShotPosition() {
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const requestedAtRef = useRef(0);

  const requestPosition = useCallback(async (): Promise<GpsPosition | null> => {
    if (position && Date.now() - requestedAtRef.current <= POSITION_MAX_AGE_MS) {
      setLocationError(null);
      return position;
    }

    if (!('geolocation' in navigator)) {
      setLocationError('Localisation indisponible dans ce navigateur.');
      return null;
    }

    setLocating(true);
    setLocationError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (nativePosition) => {
          const next = toGpsPosition(nativePosition);
          requestedAtRef.current = Date.now();
          setPosition(next);
          setLocating(false);
          resolve(next);
        },
        (error) => {
          const message = error.code === error.PERMISSION_DENIED
            ? 'Permission de localisation refusée.'
            : error.code === error.TIMEOUT
              ? 'Position GPS introuvable dans le délai imparti.'
              : 'Position GPS ponctuelle indisponible.';
          setLocationError(message);
          setLocating(false);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 30_000,
          timeout: 12_000
        }
      );
    });
  }, [position]);

  return { position, locating, locationError, requestPosition };
}
