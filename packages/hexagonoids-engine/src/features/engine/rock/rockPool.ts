import type { Quat, Vec3 } from '../math/types.js'
import type { RockState } from '../types.js'

/**
 * Pool for RockState objects. Reuses entity objects and their owned
 * Float64Arrays across spawn/split/destroy cycles. Rocks have the highest
 * churn rate: wave spawns + splits generate thousands per organism evaluation.
 *
 * Contract: caller must overwrite ALL stale fields after obtain().
 */
export class RockPool {
  private readonly pool: RockState[] = []

  obtain(): RockState {
    return this.pool.pop() ?? RockPool.create()
  }

  release(rock: RockState): void {
    this.pool.push(rock)
  }

  private static create(): RockState {
    return {
      id: '',
      orientation: new Float64Array(4) as Quat,
      position: new Float64Array(3) as Vec3,
      angularVelocity: new Float64Array(3) as Vec3,
      size: 2,
      value: 0,
    }
  }
}
