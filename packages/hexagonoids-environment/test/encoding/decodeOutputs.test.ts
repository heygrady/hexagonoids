import { describe, expect, it } from 'vitest'
import { decodeOutputs } from '../../src/encoding/decodeOutputs.js'

describe('decodeOutputs', () => {
  it('all above threshold → left wins tie when left=right', () => {
    expect(decodeOutputs([1, 1, 1, 1])).toEqual({
      thrust: true,
      fire: true,
      left: true,
      right: false,
    })
  })

  it('both turns above threshold → stronger signal wins', () => {
    expect(decodeOutputs([1, 1, 0.7, 0.9])).toEqual({
      thrust: true,
      fire: true,
      left: false,
      right: true,
    })
    expect(decodeOutputs([1, 1, 0.9, 0.7])).toEqual({
      thrust: true,
      fire: true,
      left: true,
      right: false,
    })
  })

  it('all below threshold → all false', () => {
    expect(decodeOutputs([0, 0, 0, 0])).toEqual({
      thrust: false,
      fire: false,
      left: false,
      right: false,
    })
  })

  it('mixed outputs around 0.75 threshold', () => {
    expect(decodeOutputs([0.8, 0.8, 0.4, 0.4])).toEqual({
      thrust: true,
      fire: true,
      left: false,
      right: false,
    })
  })

  it('values between 0.5 and 0.75 → false (below 0.75 threshold)', () => {
    expect(decodeOutputs([0.6, 0.7, 0.74, 0.5])).toEqual({
      thrust: false,
      fire: false,
      left: false,
      right: false,
    })
  })

  it('[1, 0, 1, 0] → thrust+left', () => {
    expect(decodeOutputs([1, 0, 1, 0])).toEqual({
      thrust: true,
      fire: false,
      left: true,
      right: false,
    })
  })

  it('exactly 0.5 → false (strictly greater than threshold)', () => {
    expect(decodeOutputs([0.5, 0.5, 0.5, 0.5])).toEqual({
      thrust: false,
      fire: false,
      left: false,
      right: false,
    })
  })

  it('empty array → all false (defaults to 0)', () => {
    expect(decodeOutputs([])).toEqual({
      thrust: false,
      fire: false,
      left: false,
      right: false,
    })
  })

  it('short array → missing values default to false', () => {
    expect(decodeOutputs([0.9])).toEqual({
      thrust: true,
      fire: false,
      left: false,
      right: false,
    })
  })
})
