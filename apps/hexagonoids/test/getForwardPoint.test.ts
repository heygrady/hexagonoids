import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { describe, expect, test } from 'vitest'

import { getForwardPoint } from '../src/components/hexagonoids/ship/getNextPoint'

describe('getForwardPoint', () => {
  test('90 degrees', () => {
    const toForward = getForwardPoint(Math.PI / 2)
    expect(toForward).equalsWithEpsilon(Vector3.Forward())

    const toDown = getForwardPoint(Math.PI)
    expect(toDown).equalsWithEpsilon(Vector3.Down())

    const toBackward = getForwardPoint(2 * Math.PI * 0.75)
    expect(toBackward).equalsWithEpsilon(Vector3.Backward())

    const toUp = getForwardPoint(2 * Math.PI)
    expect(toUp).equalsWithEpsilon(Vector3.Up())
  })

  test('45 degrees', () => {
    const turn = 0.7071067690849304
    const rad45 = Math.PI / 4
    const at45 = new Vector3(0, turn, turn)
    const at135 = new Vector3(0, -turn, turn)
    const at225 = new Vector3(0, -turn, -turn)
    const at315 = new Vector3(0, turn, -turn)

    const to45 = getForwardPoint(rad45)
    expect(to45).equalsWithEpsilon(at45)

    const to135 = getForwardPoint(rad45 * 3)
    expect(to135).equalsWithEpsilon(at135)

    const to225 = getForwardPoint(rad45 * 5)
    expect(to225).equalsWithEpsilon(at225)

    const to315 = getForwardPoint(rad45 * 7)
    expect(to315).equalsWithEpsilon(at315)
  })

  test('30 degrees', () => {
    const turn = 0.8660253882408142
    const rad30 = Math.PI / 6
    const at30 = new Vector3(0, turn, 0.5)
    const at60 = new Vector3(0, 0.5, turn)
    const at120 = new Vector3(0, -0.5, turn)
    const at150 = new Vector3(0, -turn, 0.5)
    const at210 = new Vector3(0, -turn, -0.5)
    const at240 = new Vector3(0, -0.5, -turn)
    const at300 = new Vector3(0, 0.5, -turn)
    const at330 = new Vector3(0, turn, -0.5)

    const to30 = getForwardPoint(rad30)
    expect(to30).equalsWithEpsilon(at30)

    const to60 = getForwardPoint(rad30 * 2)
    expect(to60).equalsWithEpsilon(at60)

    const to120 = getForwardPoint(rad30 * 4)
    expect(to120).equalsWithEpsilon(at120)

    const to150 = getForwardPoint(rad30 * 5)
    expect(to150).equalsWithEpsilon(at150)

    const to210 = getForwardPoint(rad30 * 7)
    expect(to210).equalsWithEpsilon(at210)

    const to240 = getForwardPoint(rad30 * 8)
    expect(to240).equalsWithEpsilon(at240)

    const to300 = getForwardPoint(rad30 * 10)
    expect(to300).equalsWithEpsilon(at300)

    const to330 = getForwardPoint(rad30 * 11)
    expect(to330).equalsWithEpsilon(at330)
  })
})
