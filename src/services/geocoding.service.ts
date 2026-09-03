/**
 * Reverse geocoding is intentionally client-side and keyless: OpenStreetMap
 * Nominatim (address) and Open-Meteo (elevation) both allow unauthenticated
 * browser requests, so there is nothing for a backend proxy to add here.
 */
export interface ReverseGeocodeResult {
  road?: string;
  municipality?: string;
  neighborhood?: string;
  altitude?: number;
}

export async function reverseGeocode(
  lat: number | string,
  lon: number | string,
): Promise<ReverseGeocodeResult> {
  const [geoResult, elevResult] = await Promise.allSettled([
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es`,
    ).then((r) => (r.ok ? r.json() : null)),
    fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`,
    ).then((r) => (r.ok ? r.json() : null)),
  ]);

  const result: ReverseGeocodeResult = {};

  if (geoResult.status === 'fulfilled' && geoResult.value?.address) {
    const addr = geoResult.value.address;
    result.municipality = addr.municipality || addr.county || addr.town || addr.city;
    result.neighborhood = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district;
    const road = addr.road || addr.pedestrian || addr.footway;
    if (road) result.road = addr.house_number ? `${road} #${addr.house_number}` : road;
  }

  if (elevResult.status === 'fulfilled' && elevResult.value?.elevation?.[0] != null) {
    result.altitude = Math.round(elevResult.value.elevation[0]);
  }

  return result;
}
