import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { describe, expect, test } from 'vitest'

import { boundingPoints } from '../../src/components/hexagonoids/sphereArenaCamera/SphereArenaCamera'

describe('boundingPoints', () => {
  test('throws on empty points array', () => {
    expect(() => boundingPoints([])).toThrow('Points array cannot be empty.')
  })

  test('returns identical min and max for a single point', () => {
    const point = new Vector3(3, -1, 5)

    const [min, max] = boundingPoints([point])

    expect(min.x).toBe(3)
    expect(min.y).toBe(-1)
    expect(min.z).toBe(5)
    expect(max.x).toBe(3)
    expect(max.y).toBe(-1)
    expect(max.z).toBe(5)
  })

  test('computes bounding box from multiple points', () => {
    const points = [
      new Vector3(-2, 0, 1),
      new Vector3(3, -4, 7),
      new Vector3(1, 5, -3),
    ]

    const [min, max] = boundingPoints(points)

    expect(min.x).toBe(-2)
    expect(min.y).toBe(-4)
    expect(min.z).toBe(-3)
    expect(max.x).toBe(3)
    expect(max.y).toBe(5)
    expect(max.z).toBe(7)
  })
})
