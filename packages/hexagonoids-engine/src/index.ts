// Collision detection & handling

// Bullet — actions & setters
export {
  destroyBullet,
  expireBullets,
  spawnBullet,
} from './features/engine/bullet/bulletActions.js'
export {
  setAngularVelocity as setBulletAngularVelocity,
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
  ROCK_FAR_CLEAR_DISTANCE,
  ROCK_LARGE_RADIUS,
  ROCK_LARGE_SIZE,
  ROCK_LARGE_SPEED,
  ROCK_LARGE_VALUE,
  ROCK_MEDIUM_RADIUS,
  ROCK_MEDIUM_SIZE,
  ROCK_MEDIUM_SPEED,
  ROCK_MEDIUM_VALUE,
  ROCK_NO_ENCOUNTER_REPLENISH_DELAY,
  ROCK_SMALL_RADIUS,
  ROCK_SMALL_SIZE,
  ROCK_SMALL_SPEED,
  ROCK_SMALL_VALUE,
  ROCK_SPAWN_BORDER_HALF_HEIGHT,
  ROCK_SPAWN_BORDER_HALF_WIDTH,
  ROCK_SPAWN_INWARD_SPREAD_DEGREES,
  ROCK_SPAWN_MAX_DISTANCE,
  ROCK_SPAWN_MIN_DISTANCE,
  ROCK_SPAWN_RELEASE_PADDING,
  ROCK_TOTAL_VALUE,
  ROCK_WAVE_GRACE_PERIOD,
  ROCK_WAVE_PERIOD,
  ROCK_WAVE_RETRY_DEFER_PERIOD,
  ROCK_WAVE_SIZES,
  ROCK_WORLD_CAP_WAVE_MULTIPLIER,
  SCORE_BAND_HIGH_MIN,
  SCORE_BAND_MID_MIN,
  SCORE_CLEAR_THRESHOLD_HIGH,
  SCORE_CLEAR_THRESHOLD_MID,
  SCORE_WAVE_DELAY_HIGH_FLOOR,
  SCORE_WAVE_DELAY_HIGH_START,
  SCORE_WAVE_DELAY_LOW,
  SCORE_WAVE_DELAY_MID_END,
  SCORE_WAVE_DELAY_MID_START,
  SCORE_WAVE_WORLD_CAP_BASE,
  SCORE_WAVE_WORLD_CAP_MAX,
  SCORE_WAVE_WORLD_CAP_STEP,
  SHIP_RADIUS,
  SHIP_REGENERATION_GRACE_PERIOD,
  SHIP_REGENERATION_WAIT_PERIOD,
  SHIP_VALUE,
  SPLIT_BASE_SPEED_WEIGHT,
  SPLIT_HEADING_OFFSET,
  SPLIT_PARENT_INHERITANCE,
  SPLIT_ROLL_DISTANCE,
  SPLIT_SPEED_JITTER,
  SPLIT_SPEED_MAX_FACTOR,
  SPLIT_SPEED_MIN_FACTOR,
  TURN_RATE,
} from './features/engine/constants.js'
export type { EngineInstance } from './features/engine/createGame.js'
// Factory
export { createGame } from './features/engine/createGame.js'
export type { ManagedSpatialQueries } from './features/engine/createManagedSpatialQueries.js'
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
export { unitPointToQuaternion } from './features/engine/physics/latLng.js'
export { moveBullet } from './features/engine/physics/moveBullet.js'
export { moveRock } from './features/engine/physics/moveRock.js'
export { moveShip } from './features/engine/physics/moveShip.js'
export {
  applyAngularFriction,
  clampAngularVelocity,
  getPositionFromQuaternion,
  headingToAngularVelocity,
  integrateAngularVelocity,
  integrateAngularVelocityFast,
} from './features/engine/physics/quaternionPhysics.js'
export {
  easeCircleOut,
  turnShip,
} from './features/engine/physics/turnShip.js'
// Player — actions & setters
export {
  canRegenerate,
  checkWaveSpawn,
  evaluateWaveSpawnGate,
  hasNearbyRocks,
  killPlayer,
  nextWaveDelayMs,
  regeneratePlayer,
  restartGame,
  scorePlayer,
  startPlayer,
  worldRockCapForScore,
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
  getSpawnBorderExtents,
  sampleSpawnBorderPoint,
  spawnRock,
  spawnWave,
  splitRock,
} from './features/engine/rock/rockActions.js'
export {
  setAngularVelocity as setRockAngularVelocity,
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
export type {
  QueryCellsOptions,
  QueryEntitiesOptions,
  SpatialBulletEntity,
  SpatialEntityRef,
  SpatialIndexEntity,
  SpatialIndexResolution,
  SpatialPoint,
  SpatialRockEntity,
  SpatialShipEntity,
} from './features/spatial-index/index.js'
// Spatial index
export {
  BUCKET_SYSTEM,
  buildSpatialIndex,
  findBucketXYZ,
  getSpatialBucketCount,
  getSpatialBucketCoveringAngle,
  SpatialIndex,
} from './features/spatial-index/index.js'
