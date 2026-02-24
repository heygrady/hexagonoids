const TWO_PI = 2 * Math.PI

/**
 * Map a relative bearing (radians) to a sector index [0, sectorCount-1].
 * Sector 0 is centered on bearing 0 (straight ahead).
 * Sectors increase clockwise.
 */
export function bearingToSector(
  relativeBearing: number,
  sectorCount: number
): number {
  const sectorAngle = TWO_PI / sectorCount
  const halfSector = sectorAngle / 2
  const normalized =
    (((relativeBearing + halfSector) % TWO_PI) + TWO_PI) % TWO_PI
  return Math.floor(normalized / sectorAngle) % sectorCount
}
