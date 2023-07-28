import type { Vector3 } from '@babylonjs/core'
import { expect } from 'vitest'

expect.extend({
  equalsWithEpsilon(received: Vector3, expected: Vector3) {
    const pass = received.equalsWithEpsilon(expected)

    if (pass) {
      return {
        message: () =>
          `Expected ${received.toString()} not to equal ${expected.toString()} with epsilon tolerance.`,
        expected,
        actual: received,
        pass: true,
      }
    } else {
      return {
        message: () =>
          `Expected ${received.toString()} to equal ${expected.toString()} with epsilon tolerance.`,
        expected,
        actual: received,
        pass: false,
      }
    }
  },
})
