import { describe, expect, test } from 'vitest'

import { degToRad } from '../src/components/hexagonoids/geoCoords/degToRad'
import {
  wrapRadians,
  wrapHalfCircle,
} from '../src/components/hexagonoids/ship/orientation'

describe('wrapRadians', () => {
  test('wraps 2pi to 0', () => {
    expect(wrapRadians(0)).toBe(0)
    expect(wrapRadians(2 * Math.PI)).toBe(0)
    expect(wrapRadians(4 * Math.PI)).toBe(0)
  })
  test('wraps pi to pi', () => {
    expect(wrapRadians(Math.PI)).toBe(Math.PI)
    expect(wrapRadians(3 * Math.PI)).toBe(Math.PI)
    expect(wrapRadians(5 * Math.PI)).toBe(Math.PI)
  })
  test('wraps -pi to -pi', () => {
    expect(wrapRadians(-Math.PI)).toBe(-Math.PI)
    expect(wrapRadians(3 * -Math.PI)).toBe(-Math.PI)
    expect(wrapRadians(5 * -Math.PI)).toBe(-Math.PI)
  })
})

describe('wrapHalfCircle', () => {
  test('wraps 2pi to 0', () => {
    expect(wrapHalfCircle(0)).toBe(0)
    expect(wrapHalfCircle(2 * Math.PI)).toBe(0)
    expect(wrapHalfCircle(4 * Math.PI)).toBe(0)
  })
  test('wraps pi to pi', () => {
    expect(wrapHalfCircle(Math.PI)).toBe(Math.PI)
    expect(wrapHalfCircle(3 * Math.PI)).toBe(Math.PI)
    expect(wrapHalfCircle(5 * Math.PI)).toBe(Math.PI)
  })
  test('wraps -pi to -pi', () => {
    expect(wrapHalfCircle(-Math.PI)).toBe(-Math.PI)
    expect(wrapHalfCircle(3 * -Math.PI)).toBe(-Math.PI)
    expect(wrapHalfCircle(5 * -Math.PI)).toBe(-Math.PI)
  })
  test('wraps -pi*1.5 to pi/2', () => {
    expect(wrapHalfCircle(-Math.PI * 1.5)).toBe(Math.PI / 2)
  })
  test('wraps pi*3.5 to -pi/2', () => {
    expect(wrapHalfCircle(Math.PI * 3.5)).toBe(-Math.PI / 2)
  })
  test('wraps 181 degrees to -179 degrees', () => {
    expect(wrapHalfCircle(degToRad(181))).toBe(degToRad(-179))
  })
  test('wraps heading', () => {
    const heading = -3.1108690043350893 - Math.PI
    expect(wrapHalfCircle(heading)).toBe(0.03072364925470339)
  })
})
