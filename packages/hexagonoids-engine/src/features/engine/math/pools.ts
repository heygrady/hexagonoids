import type { Quat, Vec3 } from './types.js'

/**
 * A Vec3 obtained from a pool with lifecycle methods.
 * Call `release()` when done, or `copyAndRelease()` to get a durable copy.
 */
export interface PooledVec3 extends Vec3 {
  /** Return this array to the pool. Values become invalid after release. */
  release(): void
  /** Create a durable Vec3 copy and release this array back to the pool. */
  copyAndRelease(): Vec3
}

/**
 * A Quat obtained from a pool with lifecycle methods.
 * Call `release()` when done, or `copyAndRelease()` to get a durable copy.
 */
export interface PooledQuat extends Quat {
  /** Return this array to the pool. Values become invalid after release. */
  release(): void
  /** Create a durable Quat copy and release this array back to the pool. */
  copyAndRelease(): Quat
}

/** Pool for temporary Vec3 calculation vectors. */
export class Vec3Pool {
  private readonly pool: PooledVec3[] = []

  obtain(): PooledVec3 {
    return this.pool.pop() ?? this.bind(new Float64Array(3) as Vec3)
  }

  private bind(v: Vec3): PooledVec3 {
    const pool = this
    Object.defineProperty(v, 'release', {
      value() {
        pool.pool.push(v as PooledVec3)
      },
      enumerable: false,
      configurable: false,
    })
    Object.defineProperty(v, 'copyAndRelease', {
      value(): Vec3 {
        const copy = new Float64Array(v) as Vec3
        pool.pool.push(v as PooledVec3)
        return copy
      },
      enumerable: false,
      configurable: false,
    })
    return v as PooledVec3
  }
}

/** Pool for temporary Quat calculation vectors. */
export class QuatPool {
  private readonly pool: PooledQuat[] = []

  obtain(): PooledQuat {
    return this.pool.pop() ?? this.bind(new Float64Array(4) as Quat)
  }

  private bind(q: Quat): PooledQuat {
    const pool = this
    Object.defineProperty(q, 'release', {
      value() {
        pool.pool.push(q as PooledQuat)
      },
      enumerable: false,
      configurable: false,
    })
    Object.defineProperty(q, 'copyAndRelease', {
      value(): Quat {
        const copy = new Float64Array(q) as Quat
        pool.pool.push(q as PooledQuat)
        return copy
      },
      enumerable: false,
      configurable: false,
    })
    return q as PooledQuat
  }
}
