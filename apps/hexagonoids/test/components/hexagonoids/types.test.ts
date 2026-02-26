import { describe, expect, it } from 'vitest'

import {
  packInputs,
  unpackInputs,
} from '../../../src/components/hexagonoids/types'

describe('packInputs', () => {
  it('returns 0 when no inputs are active', () => {
    const result = packInputs({
      left: false,
      right: false,
      thrust: false,
      fire: false,
    })
    expect(result).toBe(0)
  })

  it('returns 15 when all inputs are active', () => {
    const result = packInputs({
      left: true,
      right: true,
      thrust: true,
      fire: true,
    })
    expect(result).toBe(0b1111)
  })

  it('maps each input to the correct bit', () => {
    expect(
      packInputs({ left: true, right: false, thrust: false, fire: false })
    ).toBe(0b0001)
    expect(
      packInputs({ left: false, right: true, thrust: false, fire: false })
    ).toBe(0b0010)
    expect(
      packInputs({ left: false, right: false, thrust: true, fire: false })
    ).toBe(0b0100)
    expect(
      packInputs({ left: false, right: false, thrust: false, fire: true })
    ).toBe(0b1000)
  })
})

describe('unpackInputs', () => {
  it('returns all false for 0', () => {
    const result = unpackInputs(0)
    expect(result).toEqual({
      left: false,
      right: false,
      thrust: false,
      fire: false,
    })
  })

  it('returns all true for 15', () => {
    const result = unpackInputs(0b1111)
    expect(result).toEqual({
      left: true,
      right: true,
      thrust: true,
      fire: true,
    })
  })

  it('round-trips through pack and unpack', () => {
    const input = { left: true, right: false, thrust: true, fire: false }
    const result = unpackInputs(packInputs(input))
    expect(result).toEqual(input)
  })
})
