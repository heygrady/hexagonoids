import type { Quat, Vec3 } from '../math/types.js'
import type { ShipState } from '../types.js'

/**
 * Pool for ShipState objects. Ships churn less than bullets/rocks but
 * still regenerate per-scenario during training.
 *
 * Contract: caller must overwrite ALL stale fields after obtain().
 */
export class ShipPool {
  private readonly pool: ShipState[] = []

  obtain(): ShipState {
    return this.pool.pop() ?? ShipPool.create()
  }

  release(ship: ShipState): void {
    this.pool.push(ship)
  }

  private static create(): ShipState {
    return {
      id: '',
      playerId: '',
      orientation: new Float64Array(4) as Quat,
      position: new Float64Array(3) as Vec3,
      angularVelocity: new Float64Array(3) as Vec3,
      yaw: 0,
      alive: true,
      firedAt: null,
    }
  }
}
