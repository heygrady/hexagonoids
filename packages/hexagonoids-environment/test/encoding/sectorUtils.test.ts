import { describe, expect, it } from 'vitest'
import { bearingToSector } from '../../src/encoding/sectorUtils.js'

describe('bearingToSector', () => {
  const SECTOR_COUNT = 8
  const QUARTER = Math.PI / 2
  const EIGHTH = Math.PI / 4

  it('bearing 0 (straight ahead) → sector 0', () => {
    expect(bearingToSector(0, SECTOR_COUNT)).toBe(0)
  })

  it('bearing π/4 (front-right) → sector 1', () => {
    expect(bearingToSector(EIGHTH, SECTOR_COUNT)).toBe(1)
  })

  it('bearing π/2 (right) → sector 2', () => {
    expect(bearingToSector(QUARTER, SECTOR_COUNT)).toBe(2)
  })

  it('bearing π (behind) → sector 4', () => {
    expect(bearingToSector(Math.PI, SECTOR_COUNT)).toBe(4)
  })

  it('negative bearing -π/4 (front-left) → sector 7', () => {
    expect(bearingToSector(-EIGHTH, SECTOR_COUNT)).toBe(7)
  })

  it('negative bearing -π/2 (left) → sector 6', () => {
    expect(bearingToSector(-QUARTER, SECTOR_COUNT)).toBe(6)
  })

  it('small positive bearing stays in sector 0', () => {
    // Just under half-sector boundary (22.5° = π/8)
    expect(bearingToSector(0.1, SECTOR_COUNT)).toBe(0)
  })

  it('boundary between sector 0 and 1 assigns to sector 1', () => {
    // Exactly at +π/8 boundary → sector 1
    const boundary = Math.PI / 8
    expect(bearingToSector(boundary, SECTOR_COUNT)).toBe(1)
  })

  it('just below sector 0/1 boundary stays in sector 0', () => {
    const justBelow = Math.PI / 8 - 0.001
    expect(bearingToSector(justBelow, SECTOR_COUNT)).toBe(0)
  })

  it('works with 4 sectors', () => {
    expect(bearingToSector(0, 4)).toBe(0)
    expect(bearingToSector(Math.PI / 2, 4)).toBe(1)
    expect(bearingToSector(Math.PI, 4)).toBe(2)
    expect(bearingToSector(-Math.PI / 2, 4)).toBe(3)
  })
})
