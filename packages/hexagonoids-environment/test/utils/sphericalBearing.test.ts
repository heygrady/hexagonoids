import { describe, expect, it } from 'vitest'
import { yawToBearing } from '../../src/utils/sphericalBearing.js'

describe('yawToBearing', () => {
  it('converts yaw 0 to bearing PI/2 (east)', () => {
    expect(yawToBearing(0)).toBeCloseTo(Math.PI / 2, 10)
  })

  it('converts yaw PI/2 to bearing PI (south)', () => {
    expect(yawToBearing(Math.PI / 2)).toBeCloseTo(Math.PI, 10)
  })

  it('converts yaw -PI/2 to bearing 0 (north)', () => {
    expect(yawToBearing(-Math.PI / 2)).toBeCloseTo(0, 10)
  })
})
