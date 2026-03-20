import {
  defaultBulletState,
  defaultRockState,
  defaultShipState,
} from '../../src/features/engine/defaults.js'
import { vec3, vec3Zero } from '../../src/features/engine/math/create.js'
import {
  quatFromUnitPoint,
  quatToUnitPoint,
} from '../../src/features/engine/math/quat.js'
import type { Quat, Vec3 } from '../../src/features/engine/math/types.js'
import type {
  BulletState,
  RockState,
  ShipState,
} from '../../src/features/engine/types.js'

/**
 * Create a ShipState for testing. Orientation is derived from position via quatFromUnitPoint.
 */
export function makeShip(
  overrides: Partial<
    Omit<ShipState, 'orientation' | 'position' | 'angularVelocity'>
  > & {
    position?: Vec3
    angularVelocity?: Vec3
    orientation?: Quat
  } = {}
): ShipState {
  const position = overrides.position ?? vec3(0, 1, 0)
  const orientation = overrides.orientation ?? (new Float64Array(4) as Quat)
  if (overrides.orientation == null) {
    quatFromUnitPoint(orientation, position[0], position[1], position[2])
  }
  const derivedPosition = vec3Zero()
  quatToUnitPoint(derivedPosition, orientation)
  return {
    ...defaultShipState,
    id: overrides.id ?? 'ship-1',
    playerId: overrides.playerId ?? 'player-1',
    orientation,
    position: derivedPosition,
    angularVelocity: overrides.angularVelocity ?? vec3Zero(),
    yaw: overrides.yaw ?? 0,
    alive: overrides.alive ?? true,
    firedAt: overrides.firedAt ?? null,
  }
}

/**
 * Create a RockState for testing.
 */
export function makeRock(
  overrides: Partial<
    Omit<RockState, 'orientation' | 'position' | 'angularVelocity'>
  > & {
    position?: Vec3
    angularVelocity?: Vec3
    orientation?: Quat
  } = {}
): RockState {
  const position = overrides.position ?? vec3(0, 1, 0)
  const orientation = overrides.orientation ?? (new Float64Array(4) as Quat)
  if (overrides.orientation == null) {
    quatFromUnitPoint(orientation, position[0], position[1], position[2])
  }
  const derivedPosition = vec3Zero()
  quatToUnitPoint(derivedPosition, orientation)
  return {
    ...defaultRockState,
    id: overrides.id ?? 'rock-1',
    orientation,
    position: derivedPosition,
    angularVelocity: overrides.angularVelocity ?? vec3Zero(),
    size: overrides.size ?? 2,
    value: overrides.value ?? 50,
  }
}

/**
 * Create a BulletState for testing.
 */
export function makeBullet(
  overrides: Partial<
    Omit<BulletState, 'orientation' | 'position' | 'angularVelocity'>
  > & {
    position?: Vec3
    angularVelocity?: Vec3
    orientation?: Quat
  } = {}
): BulletState {
  const position = overrides.position ?? vec3(0, 1, 0)
  const orientation = overrides.orientation ?? (new Float64Array(4) as Quat)
  if (overrides.orientation == null) {
    quatFromUnitPoint(orientation, position[0], position[1], position[2])
  }
  const derivedPosition = vec3Zero()
  quatToUnitPoint(derivedPosition, orientation)
  return {
    ...defaultBulletState,
    id: overrides.id ?? 'bullet-1',
    ownerId: overrides.ownerId ?? 'ship-1',
    orientation,
    position: derivedPosition,
    angularVelocity: overrides.angularVelocity ?? vec3Zero(),
    firedAt: overrides.firedAt ?? null,
  }
}
