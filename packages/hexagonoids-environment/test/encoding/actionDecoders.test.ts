import { describe, expect, it } from 'vitest'
import {
  binaryDecoder,
  groupedCategoricalDecoder,
  pairedDecoder,
  selectDecoder,
} from '../../src/encoding/actionDecoders.js'

describe('groupedCategoricalDecoder', () => {
  it('chooses left from the turn category', () => {
    expect(groupedCategoricalDecoder([0.8, 0.2, 0.9, 0.1, 0.7, 0.2, 0.1])).toEqual(
      {
        thrust: true,
        fire: true,
        left: true,
        right: false,
      }
    )
  })

  it('chooses none when none wins the turn category', () => {
    expect(groupedCategoricalDecoder([0.2, 0.8, 0.1, 0.9, 0.2, 0.7, 0.1])).toEqual(
      {
        thrust: false,
        fire: false,
        left: false,
        right: false,
      }
    )
  })

  it('chooses right from the turn category', () => {
    expect(groupedCategoricalDecoder([0.5, 0.5, 0.5, 0.5, 0.2, 0.1, 0.7])).toEqual(
      {
        thrust: true,
        fire: true,
        left: false,
        right: true,
      }
    )
  })

  it('ties fall back to none', () => {
    expect(groupedCategoricalDecoder([0.5, 0.5, 0.5, 0.5, 0.4, 0.4, 0.4])).toEqual(
      {
        thrust: true,
        fire: true,
        left: false,
        right: false,
      }
    )
  })
})

describe('pairedDecoder', () => {
  it('legacy paired turn resolves conflicting sides exclusively', () => {
    expect(pairedDecoder([0.8, 0.2, 0.9, 0.1, 0.7, 0.3, 0.6, 0.4])).toEqual({
      thrust: true,
      fire: true,
      left: true,
      right: false,
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
})

describe('binaryDecoder', () => {
  it('legacy binary decoder thresholds booleans independently', () => {
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
})

describe('selectDecoder', () => {
  it('length 7 → grouped categorical decoder', () => {
    const decoder = selectDecoder(7)
    expect(decoder).toBe(groupedCategoricalDecoder)
  })

  it('length >= 8 → paired decoder', () => {
    const decoder = selectDecoder(8)
    expect(decoder).toBe(pairedDecoder)
  })

  it('length < 7 → binary decoder', () => {
    const decoder = selectDecoder(4)
    expect(decoder).toBe(binaryDecoder)
  })
})
