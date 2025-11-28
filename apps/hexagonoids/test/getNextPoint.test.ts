import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { describe, expect, test } from 'vitest'

import { getNextPoint } from '../src/components/hexagonoids/ship/getNextPoint'

describe('getNextPoint', () => {
  test('90 degrees', () => {
    const toForward = getNextPoint(0, Math.PI / 2)
    expect(toForward).equalsWithEpsilon(Vector3.Forward())

    const toRight = getNextPoint(Math.PI / 2, Math.PI / 2)
    expect(toRight).equalsWithEpsilon(Vector3.Right())

    const toBackward = getNextPoint(0, -Math.PI / 2)
    expect(toBackward).equalsWithEpsilon(Vector3.Backward())

    const toLeft = getNextPoint(-Math.PI / 2, Math.PI / 2)
    expect(toLeft).equalsWithEpsilon(Vector3.Left())
  })
})
