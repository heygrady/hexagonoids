import { describe, expect, it } from 'vitest'
import {
  binaryDecoder,
  pairedDecoder,
  selectDecoder,
} from '../../src/encoding/actionDecoders.js'

describe('pairedDecoder', () => {
  it('first-of-pair wins → true', () => {
    expect(pairedDecoder([0.8, 0.2, 0.9, 0.1, 0.7, 0.3, 0.6, 0.4])).toEqual({
      thrust: true,
      fire: true,
      left: true,
      right: true,
    })
  })

  it('second-of-pair wins → false', () => {
    expect(pairedDecoder([0.2, 0.8, 0.1, 0.9, 0.3, 0.7, 0.4, 0.6])).toEqual({
      thrust: false,
      fire: false,
      left: false,
      right: false,
    })
  })

  it('equal values → true (>= comparison)', () => {
    expect(pairedDecoder([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5])).toEqual({
      thrust: true,
      fire: true,
      left: true,
      right: true,
    })
  })

  it('missing outputs default to 0', () => {
    expect(pairedDecoder([])).toEqual({
      thrust: true,
      fire: true,
      left: true,
      right: true,
    })
  })
})

describe('binaryDecoder', () => {
  it('above 0.5 → true', () => {
    expect(binaryDecoder([0.8, 0.9, 0.6, 0.7])).toEqual({
      thrust: true,
      fire: true,
      left: true,
      right: true,
    })
  })

  it('at or below 0.5 → false', () => {
    expect(binaryDecoder([0.5, 0.4, 0.3, 0.0])).toEqual({
      thrust: false,
      fire: false,
      left: false,
      right: false,
    })
  })

  it('missing outputs default to 0 → false', () => {
    expect(binaryDecoder([])).toEqual({
      thrust: false,
      fire: false,
      left: false,
      right: false,
    })
  })
})

describe('selectDecoder', () => {
  it('length >= 8 → paired decoder', () => {
    const decoder = selectDecoder(8)
    expect(decoder).toBe(pairedDecoder)
  })

  it('length >= 8 for 9 outputs → paired decoder', () => {
    const decoder = selectDecoder(9)
    expect(decoder).toBe(pairedDecoder)
  })

  it('length < 8 → binary decoder', () => {
    const decoder = selectDecoder(4)
    expect(decoder).toBe(binaryDecoder)
  })

  it('length 0 → binary decoder', () => {
    const decoder = selectDecoder(0)
    expect(decoder).toBe(binaryDecoder)
  })
})
