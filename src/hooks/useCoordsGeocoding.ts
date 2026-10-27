import { useRef, useState } from 'react';
import { reverseGeocode, type ReverseGeocodeResult } from '@/services/geocoding.service';

/**
 * Backfills a form from a picked point. `toFields` names every field a
 * suggestion may fill, undefined where this point resolved nothing. A field
 * still holding the previous point's suggestion is cleared when the new
 * point has nothing for it — it described somewhere else. What the operator
 * typed is kept unless the new point has a value of its own.
 */
export function useCoordsGeocoding<F extends { latitude: string; longitude: string }, K extends keyof F>(
  setForm: React.Dispatch<React.SetStateAction<F>>,
  toFields: (r: ReverseGeocodeResult) => Record<K, string | undefined>,
) {
  const [isGeocoding, setIsGeocoding] = useState(false);
  const suggested = useRef<Partial<Record<K, string>>>({});
  // A slow answer for an earlier click must not land over a later one.
  const latest = useRef(0);

  const onLocationPick = async (lat: string, lon: string) => {
    const call = ++latest.current;
    setForm((prev) => ({ ...prev, latitude: lat, longitude: lon }));
    setIsGeocoding(true);
    try {
      const next = toFields(await reverseGeocode(lat, lon));
      if (call !== latest.current) return;
      const before = suggested.current;
      setForm((prev) => {
        const out = { ...prev };
        for (const k of Object.keys(next) as K[]) {
          const value = next[k];
          if (value) out[k] = value as F[K];
          else if (before[k] !== undefined && prev[k] === before[k]) out[k] = '' as F[K];
        }
        return out;
      });
      suggested.current = Object.fromEntries(Object.entries(next).filter(([, v]) => v)) as Partial<Record<K, string>>;
    } finally {
      if (call === latest.current) setIsGeocoding(false);
    }
  };

  return { isGeocoding, onLocationPick };
}
