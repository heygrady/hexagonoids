import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { latLngToCell } from 'h3-js'
import { describe, expect, test } from 'vitest'

import {
  latLngToVector3,
  vector3ToCell,
  vector3ToLatLng,
  wrap180,
  wrap90,
} from '../src/index.js'

describe('h3-babylon', () => {
  test.skip('latLngToCell', () => {
    const lat = 45
    const lng = 40
    const res = 2
    const h = latLngToCell(lat, lng, res)
    expect(h).toBe('822d57fffffffff')
  })
  test('latLngToVector3', () => {
    const lat = 45
    const lng = 40
    const radius = 2
    const v = latLngToVector3(lat, lng, radius)
    expect(v).toEqual(
      new Vector3(1.0833504408394037, 1.414213562373095, 0.9090389553440873)
    )
  })
  test('vector3ToLatLng', () => {
    const expectedLat = 45
    const expectedLng = 40
    const position = new Vector3(
      1.0833504408394037,
      1.414213562373095,
      0.9090389553440873
    )
    const [lat, lng] = vector3ToLatLng(position)
    expect(lat).toBeCloseTo(expectedLat)
    expect(lng).toBeCloseTo(expectedLng)
  })
  test('vector3ToCell', () => {
    const lat = 45
    const lng = 40
    const res = 2
    const position = new Vector3(
      1.0833504408394037,
      1.414213562373095,
      0.9090389553440873
    )
    const h = vector3ToCell(position, res)
    const expectedCell = latLngToCell(lat, lng, res)
    expect(h).toBe(expectedCell)
  })

  describe('wrap90', () => {
    test('preserves 90', () => {
      const degrees = 90
      const wrapped = wrap90(degrees)
      expect(wrapped).toBe(degrees)
    })

    test('wraps above 90', () => {
      const degrees = 95
      const expected = 85
      const wrapped = wrap90(degrees)
      expect(wrapped).toBe(expected)
    })
    test('wraps below -90', () => {
      const degrees = -95
      const expected = -85
      const wrapped = wrap90(degrees)
      expect(wrapped).toBe(expected)
    })
    test('wraps silly number', () => {
      const degrees = -9595
      const expected = 55
      const wrapped = wrap90(degrees)
      expect(wrapped).toBe(expected)
    })
  })
  describe('wrap180', () => {
    test('preserves 180', () => {
      const degrees = 180
      const wrapped = wrap180(degrees)
      expect(wrapped).toBe(degrees)
    })
    test('wraps above 180', () => {
      const degrees = 185
      const expected = -175
      const wrapped = wrap180(degrees)
      expect(wrapped).toBe(expected)
    })
    test('wraps below -180', () => {
      const degrees = -185
      const expected = 175
      const wrapped = wrap180(degrees)
      expect(wrapped).toBe(expected)
    })
    test('wraps silly number', () => {
      const degrees = -9595
      const expected = 125
      const wrapped = wrap180(degrees)
      expect(wrapped).toBe(expected)
    })
  })
})
