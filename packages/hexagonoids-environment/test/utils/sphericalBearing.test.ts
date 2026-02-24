import { describe, expect, it } from 'vitest'
import {
  relativeBearing,
  sphericalBearing,
} from '../../src/utils/sphericalBearing.js'

describe('sphericalBearing', () => {
  it('returns 0 when target is due north', () => {
    // From equator to north pole
    const bearing = sphericalBearing(0, 0, 90, 0)
    expect(bearing).toBeCloseTo(0, 10)
  })

  it('returns PI when target is due south', () => {
    const bearing = sphericalBearing(0, 0, -45, 0)
    expect(bearing).toBeCloseTo(Math.PI, 5)
  })

  it('returns PI/2 when target is due east', () => {
    const bearing = sphericalBearing(0, 0, 0, 90)
    expect(bearing).toBeCloseTo(Math.PI / 2, 10)
  })

  it('returns -PI/2 when target is due west', () => {
    const bearing = sphericalBearing(0, 0, 0, -90)
    expect(bearing).toBeCloseTo(-Math.PI / 2, 10)
  })

  it('returns correct bearing for non-trivial positions', () => {
    // London (51.5, -0.1) to Paris (48.9, 2.3) — roughly SE
    const bearing = sphericalBearing(51.5, -0.1, 48.9, 2.3)
    // Should be positive (east) and negative latitude (south) = SE quadrant
    expect(bearing).toBeGreaterThan(0)
    expect(bearing).toBeLessThan(Math.PI)
  })

  it('returns values in [-PI, PI] range', () => {
    // Various random positions
    const positions: [number, number, number, number][] = [
      [45, 90, -45, -90],
      [-30, 170, 60, -170],
      [0, 0, 0, 180],
    ]

    for (const [lat1, lng1, lat2, lng2] of positions) {
      const bearing = sphericalBearing(lat1, lng1, lat2, lng2)
      expect(bearing).toBeGreaterThanOrEqual(-Math.PI)
      expect(bearing).toBeLessThanOrEqual(Math.PI)
    }
  })
})

describe('relativeBearing', () => {
  it('returns 0 when target is directly ahead', () => {
    const rel = relativeBearing(0, 0)
    expect(rel).toBeCloseTo(0, 10)
  })

  it('returns positive when target is to the right', () => {
    const rel = relativeBearing(Math.PI / 2, 0)
    expect(rel).toBeCloseTo(Math.PI / 2, 10)
  })

  it('returns negative when target is to the left', () => {
    const rel = relativeBearing(-Math.PI / 2, 0)
    expect(rel).toBeCloseTo(-Math.PI / 2, 10)
  })

  it('normalizes to [-PI, PI]', () => {
    // Bearing 0.1 rad, yaw -PI → relative should wrap
    const rel = relativeBearing(0.1, -Math.PI)
    expect(rel).toBeGreaterThanOrEqual(-Math.PI)
    expect(rel).toBeLessThanOrEqual(Math.PI)
  })

  it('accounts for ship heading', () => {
    // Target at bearing PI/4, ship heading PI/4 → target is directly ahead
    const rel = relativeBearing(Math.PI / 4, Math.PI / 4)
    expect(rel).toBeCloseTo(0, 10)
  })
})
