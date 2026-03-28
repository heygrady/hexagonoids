import type { RawMetrics } from './RawMetrics.js'

export function aggregateMetrics(allMetrics: RawMetrics[]): RawMetrics {
  let score = 0
  let rocksDestroyed = 0
  let shotsFired = 0
  let shotsHit = 0
  let deaths = 0
  let distanceTraveled = 0
  let thrustFrames = 0
  let fireFrames = 0
  let turnFrames = 0
  let leftFrames = 0
  let rightFrames = 0
  let turnConflictFrames = 0
  let turnAmbiguousFrames = 0
  let aliveFrames = 0
  let framesWithRocksInSOI = 0
  let largeRocksSpawned = 0
  let uniqueRocksSeen = 0
  let uniqueCellsVisited = 0
  let wavesSpawned = 0
  let timeAlive = 0
  let elapsedTicks = 0
  let livesRemaining = Infinity

  for (const m of allMetrics) {
    score += m.score
    rocksDestroyed += m.rocksDestroyed
    shotsFired += m.shotsFired
    shotsHit += m.shotsHit
    deaths += m.deaths
    distanceTraveled += m.distanceTraveled
    thrustFrames += m.thrustFrames
    fireFrames += m.fireFrames
    turnFrames += m.turnFrames
    leftFrames += m.leftFrames
    rightFrames += m.rightFrames
    turnConflictFrames += m.turnConflictFrames
    turnAmbiguousFrames += m.turnAmbiguousFrames
    aliveFrames += m.aliveFrames
    framesWithRocksInSOI += m.framesWithRocksInSOI
    largeRocksSpawned += m.largeRocksSpawned
    uniqueRocksSeen += m.uniqueRocksSeen
    uniqueCellsVisited += m.uniqueCellsVisited
    wavesSpawned += m.wavesSpawned
    timeAlive += m.timeAlive
    elapsedTicks += m.elapsedTicks
    if (m.livesRemaining < livesRemaining) {
      livesRemaining = m.livesRemaining
    }
  }

  // Handle empty case
  if (allMetrics.length === 0) {
    livesRemaining = 0
  }

  return {
    score,
    livesRemaining,
    timeAlive,
    accuracy: shotsFired > 0 ? shotsHit / shotsFired : 0,
    distanceTraveled,
    rocksDestroyed,
    shotsFired,
    shotsHit,
    deaths,
    wavesSpawned,
    thrustFrames,
    fireFrames,
    turnFrames,
    leftFrames,
    rightFrames,
    turnConflictFrames,
    turnAmbiguousFrames,
    aliveFrames,
    largeRocksSpawned,
    uniqueRocksSeen,
    framesWithRocksInSOI,
    uniqueCellsVisited,
    elapsedTicks,
  }
}
