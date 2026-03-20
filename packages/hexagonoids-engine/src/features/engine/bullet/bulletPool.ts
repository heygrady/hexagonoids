import type { Quat, Vec3 } from '../math/types.js'
import type { BulletState } from '../types.js'

/**
 * Pool for BulletState objects. Reuses entity objects and their owned
 * Float64Arrays across spawn/destroy cycles to eliminate allocation pressure
 * during training (thousands of bullets per organism evaluation).
 *
 * Contract: caller must overwrite ALL stale fields after obtain().
 */
export class BulletPool {
  private readonly pool: BulletState[] = []

  obtain(): BulletState {
    return this.pool.pop() ?? BulletPool.create()
  }

  release(bullet: BulletState): void {
    this.pool.push(bullet)
  }

  private static create(): BulletState {
    return {
      id: '',
      ownerId: '',
      orientation: new Float64Array(4) as Quat,
      position: new Float64Array(3) as Vec3,
      angularVelocity: new Float64Array(3) as Vec3,
      firedAt: null,
    }
  }
}
