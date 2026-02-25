import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import type { RockState } from '@heygrady/hexagonoids-engine'
import {
  latLngToQuaternion,
  ROCK_LARGE_RADIUS,
  ROCK_MEDIUM_RADIUS,
  ROCK_SMALL_RADIUS,
  SHIP_RADIUS,
} from '@heygrady/hexagonoids-engine'
import { describe, expect, it } from 'vitest'
import {
  collisionRadius,
  computeClosingSpeed,
  computeLeadAim,
  computeThreatLevel,
  computeTTC,
  fireWindow,
  rockRadius,
  ticksToAlign,
} from '../../src/agents/seekDestroyUtils.js'

function mockRock(
  lat: number,
  lng: number,
  size: 0 | 1 | 2 = 2,
  angularVelocity: Vector3 = Vector3.Zero()
): RockState {
  return {
    id: 'rock-1',
    orientation: latLngToQuaternion(lat, lng),
    lat,
    lng,
    angularVelocity,
    size,
    value: size === 2 ? 50 : size === 1 ? 100 : 200,
  }
}

describe('rockRadius', () => {
  it('returns correct radius for each rock size', () => {
    expect(rockRadius(2)).toBe(ROCK_LARGE_RADIUS)
    expect(rockRadius(1)).toBe(ROCK_MEDIUM_RADIUS)
    expect(rockRadius(0)).toBe(ROCK_SMALL_RADIUS)
  })
})

describe('computeClosingSpeed', () => {
  it('returns positive speed for an approaching rock', () => {
    // Rock north of ship, moving south (toward ship)
    const rock = mockRock(5, 0, 2, new Vector3(-0.2, 0, 0))
    const speed = computeClosingSpeed(0, 0, rock)

    expect(speed).toBeGreaterThan(0)
  })

  it('returns near-zero speed for a stationary rock', () => {
    const rock = mockRock(5, 0, 2, Vector3.Zero())
    const speed = computeClosingSpeed(0, 0, rock)

    expect(Math.abs(speed)).toBeLessThan(0.001)
  })
})

describe('computeTTC', () => {
  it('returns zero when already overlapping', () => {
    const ttc = computeTTC(0.05, 1.0, 0.1)

    expect(ttc).toBe(0)
  })

  it('returns Infinity when rock is not closing', () => {
    const ttc = computeTTC(1.0, -0.5, 0.1)

    expect(ttc).toBe(Number.POSITIVE_INFINITY)
  })

  it('returns positive time for closing rock', () => {
    const ttc = computeTTC(1.0, 2.0, 0.1)

    expect(ttc).toBeCloseTo(0.45, 1)
  })
})

describe('collisionRadius', () => {
  it('combines ship and rock radii', () => {
    expect(collisionRadius(2)).toBe(SHIP_RADIUS + ROCK_LARGE_RADIUS)
  })
})

describe('computeThreatLevel', () => {
  it('returns zero for infinite TTC', () => {
    expect(computeThreatLevel(Number.POSITIVE_INFINITY, 2)).toBe(0)
  })

  it('returns higher threat for closer rocks', () => {
    const farThreat = computeThreatLevel(5.0, 2)
    const closeThreat = computeThreatLevel(1.0, 2)

    expect(closeThreat).toBeGreaterThan(farThreat)
  })

  it('returns higher threat for larger rocks at same distance', () => {
    const smallThreat = computeThreatLevel(2.0, 0)
    const largeThreat = computeThreatLevel(2.0, 2)

    expect(largeThreat).toBeGreaterThan(smallThreat)
  })
})

describe('computeLeadAim', () => {
  it('returns a bearing and positive intercept distance for a stationary rock', () => {
    const rock = mockRock(10, 0, 2, Vector3.Zero())
    const result = computeLeadAim(0, 0, rock)

    expect(result.interceptDist).toBeGreaterThan(0)
    expect(result.tof).toBeGreaterThan(0)
    expect(typeof result.bearing).toBe('number')
  })
})

describe('fireWindow', () => {
  it('grows for closer rocks', () => {
    const farWindow = fireWindow(2, 1.0)
    const nearWindow = fireWindow(2, 0.1)

    expect(nearWindow).toBeGreaterThan(farWindow)
  })

  it('never falls below the base minimum', () => {
    const window = fireWindow(0, 100)

    expect(window).toBeGreaterThanOrEqual(0.12)
  })
})

describe('ticksToAlign', () => {
  it('returns zero for zero angle', () => {
    expect(ticksToAlign(0)).toBe(0)
  })

  it('returns more ticks for larger angles', () => {
    const smallTicks = ticksToAlign(0.1)
    const largeTicks = ticksToAlign(1.0)

    expect(largeTicks).toBeGreaterThan(smallTicks)
  })

  it('returns fewer ticks when already mid-turn', () => {
    const fromStandstill = ticksToAlign(0.5)
    const midTurn = ticksToAlign(0.5, 200)

    expect(midTurn).toBeLessThan(fromStandstill)
  })
})
