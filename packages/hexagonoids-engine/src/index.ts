// Collision detection & handling

// Bullet — actions & setters
export {
  destroyBullet,
  expireBullets,
  spawnBullet,
} from './features/engine/bullet/bulletActions.js'
export {
  setAngularVelocity as setBulletAngularVelocity,
  setLat as setBulletLat,
  setLng as setBulletLng,
  setLocation as setBulletLocation,
} from './features/engine/bullet/bulletSetters.js'
export type { CollisionPair } from './features/engine/collision/index.js'
export {
  detectCollisions,
  greatCircleDistance,
  handleCollisions,
} from './features/engine/collision/index.js'
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
  ROCK_ENCOUNTER_DISTANCE,
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
  ROCK_SPAWN_MAX_DISTANCE,
  ROCK_SPAWN_MIN_DISTANCE,
  ROCK_TOTAL_VALUE,
  ROCK_WAVE_GRACE_PERIOD,
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
  defaultPlayerState,
  defaultRockState,
  defaultShipState,
} from './features/engine/defaults.js'
// Game time
export { advanceGameTime, elapsed } from './features/engine/gameTime.js'
// ID generation
export { generateId, resetIdCounter } from './features/engine/generateId.js'
export type { EngineHooks } from './features/engine/hooks.js'
// Physics — quaternion spherical movement
export { accelerateShip } from './features/engine/physics/accelerateShip.js'
export {
  latLngToQuaternion,
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
export {
  easeCircleOut,
  turnShip,
} from './features/engine/physics/turnShip.js'
// Player — actions & setters
export {
  canRegenerate,
  checkWaveSpawn,
  hasNearbyRocks,
  killPlayer,
  regeneratePlayer,
  restartGame,
  scorePlayer,
  startPlayer,
} from './features/engine/player/playerActions.js'
export {
  decrementLives,
  incrementScore,
  setLives,
  setScore,
} from './features/engine/player/playerSetters.js'
export { reseedGame } from './features/engine/player/reseedGame.js'
// Rock — actions & setters
export {
  destroyRock,
  spawnRock,
  spawnWave,
  splitRock,
} from './features/engine/rock/rockActions.js'
export {
  setAngularVelocity as setRockAngularVelocity,
  setLat as setRockLat,
  setLng as setRockLng,
  setLocation as setRockLocation,
  setSize as setRockSize,
} from './features/engine/rock/rockSetters.js'
// Ship — actions & setters
export {
  destroyShip,
  fireBullet,
  spawnShip,
} from './features/engine/ship/shipActions.js'
export {
  setAngularVelocity as setShipAngularVelocity,
  setFiredAt as setShipFiredAt,
  setLat as setShipLat,
  setLng as setShipLng,
  setLocation as setShipLocation,
  setYaw as setShipYaw,
} from './features/engine/ship/shipSetters.js'
// Step function — core game loop
export { step } from './features/engine/step.js'
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
