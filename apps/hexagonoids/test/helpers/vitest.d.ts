import '@testing-library/jest-dom/vitest'
import type { Vector3 } from '@babylonjs/core/Maths/math.vector'

interface CustomMatchers<R = unknown> {
  equalsWithEpsilon(expected: Vector3, epsilon?: number): R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
