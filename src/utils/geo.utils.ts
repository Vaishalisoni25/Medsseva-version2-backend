/**
 * Calculate distance in kilometers between two latitude/longitude points using Haversine formula.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const DEFAULT_BOOKING_RADIUS_KM = 3;

export function hasValidCoordinates(
  lat: number | null | undefined,
  lon: number | null | undefined
): lat is number {
  return lat != null && lon != null && !Number.isNaN(lat) && !Number.isNaN(lon);
}

/**
 * Returns true when both points are within radiusKm.
 * When allowMissing is false (default), missing coordinates => false.
 */
export function isWithinServiceRadius(
  userLat: number | null | undefined,
  userLon: number | null | undefined,
  targetLat: number | null | undefined,
  targetLon: number | null | undefined,
  radiusKm = DEFAULT_BOOKING_RADIUS_KM,
  allowMissing = false
): boolean {
  if (!hasValidCoordinates(userLat, userLon) || !hasValidCoordinates(targetLat, targetLon)) {
    return allowMissing;
  }
  const distance = calculateDistanceKm(userLat!, userLon!, targetLat!, targetLon!);
  return distance <= radiusKm;
}
