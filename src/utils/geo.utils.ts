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
  const R = 6371; // Earth's radius in kilometers
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

/**
 * Filter items by service radius (default 3 km).
 */
export function isWithinServiceRadius(
  userLat: number | null | undefined,
  userLon: number | null | undefined,
  targetLat: number | null | undefined,
  targetLon: number | null | undefined,
  radiusKm = 3
): boolean {
  if (
    userLat === null ||
    userLat === undefined ||
    userLon === null ||
    userLon === undefined ||
    targetLat === null ||
    targetLat === undefined ||
    targetLon === null ||
    targetLon === undefined
  ) {
    return true; // Default to true if coordinates are not specified to ensure serviceability
  }
  const distance = calculateDistanceKm(userLat, userLon, targetLat, targetLon);
  return distance <= radiusKm;
}
