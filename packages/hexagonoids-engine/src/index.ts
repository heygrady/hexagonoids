// Constants
export {
  ACCELERATION_RATE,
  BULLET_LIFETIME,
  BULLET_RADIUS,
  BULLET_SPEED,
  FIRE_COOLDOWN,
  FRICTION_COEFFICIENT,
  GUN_DISTANCE,
  MAX_DELTA,
  MAX_DURATION,
  MAX_ROCKS,
  MAX_SPEED,
  PLAYER_STARTING_LIVES,
  RADIUS,
  ROCK_ENCOUNTER_COOLDOWN,
  ROCK_LARGE_RADIUS,
  ROCK_LARGE_SIZE,
  ROCK_LARGE_SPEED,
  ROCK_LARGE_VALUE,
  ROCK_MEDIUM_RADIUS,
  ROCK_MEDIUM_SIZE,
  ROCK_MEDIUM_SPEED,
  ROCK_MEDIUM_VALUE,
  ROCK_SMALL_RADIUS,
  ROCK_SMALL_SIZE,
  ROCK_SMALL_SPEED,
  ROCK_SMALL_VALUE,
  ROCK_TOTAL_VALUE,
  ROCK_WAVE_PERIOD,
  ROCK_WAVE_SIZES,
  SHIP_RADIUS,
  SHIP_REGENERATION_GRACE_PERIOD,
  SHIP_REGENERATION_WAIT_PERIOD,
  SHIP_VALUE,
  SPLIT_HEADING_OFFSET,
  SPLIT_ROLL_DISTANCE,
  TURN_RATE,
} from './features/engine/constants.js'
// Factory
export { createGame } from './features/engine/createGame.js'
// Defaults
export {
  defaultBulletState,
  defaultGameState,
  defaultPlayerState,
  defaultRockState,
  defaultShipState,
} from './features/engine/defaults.js'
// Game time
export { advanceGameTime, elapsed } from './features/engine/gameTime.js'
export type { EngineHooks } from './features/engine/hooks.js'
// Physics — quaternion spherical movement
export { accelerateShip } from './features/engine/physics/accelerateShip.js'
export {
  latLngToVector3,
  quaternionToLatLng,
  vector3ToLatLng,
} from './features/engine/physics/latLng.js'
export { moveBullet } from './features/engine/physics/moveBullet.js'
export { moveRock } from './features/engine/physics/moveRock.js'
export { moveShip } from './features/engine/physics/moveShip.js'
export {
  applyAngularFriction,
  clampAngularVelocity,
  getPositionFromQuaternion,
  headingToAngularVelocity,
  integrateAngularVelocity,
} from './features/engine/physics/quaternionPhysics.js'
export { turnShip } from './features/engine/physics/turnShip.js'
export type {
  BulletState,
  CollisionType,
  EngineOptions,
  EntityRef,
  EntityType,
  GameMode,
  GameState,
  PlayerInputState,
  PlayerInputs,
  PlayerState,
  RockState,
  ShipState,
} from './features/engine/types.js'
