import type { RawMetrics } from './RawMetrics.js'

export function aggregateMetrics(allMetrics: RawMetrics[]): RawMetrics {
  let episodeReward = 0
  let score = 0
  let rocksDestroyed = 0
  let shotsFired = 0
  let shotsHit = 0
  let deaths = 0
  let distanceTraveled = 0
  let thrustFrames = 0
  let fireFrames = 0
  let leftFrames = 0
  let rightFrames = 0
  let aliveFrames = 0
  let framesWithRocksInSOI = 0
  let largeRocksSpawned = 0
  let uniqueRocksSeen = 0
  let uniqueCellsVisited = 0
  let wavesSpawned = 0
  let timeAlive = 0
  let livesRemaining = Infinity

  for (const m of allMetrics) {
    episodeReward += m.episodeReward
    score += m.score
    rocksDestroyed += m.rocksDestroyed
    shotsFired += m.shotsFired
    shotsHit += m.shotsHit
    deaths += m.deaths
    distanceTraveled += m.distanceTraveled
    thrustFrames += m.thrustFrames
    fireFrames += m.fireFrames
    leftFrames += m.leftFrames
    rightFrames += m.rightFrames
    aliveFrames += m.aliveFrames
    framesWithRocksInSOI += m.framesWithRocksInSOI
    largeRocksSpawned += m.largeRocksSpawned
    uniqueRocksSeen += m.uniqueRocksSeen
    uniqueCellsVisited += m.uniqueCellsVisited
    wavesSpawned += m.wavesSpawned
    timeAlive += m.timeAlive
    if (m.livesRemaining < livesRemaining) {
      livesRemaining = m.livesRemaining
    }
  }

  // Handle empty case
  if (allMetrics.length === 0) {
    livesRemaining = 0
  }

  return {
    episodeReward,
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
    leftFrames,
    rightFrames,
    aliveFrames,
    largeRocksSpawned,
    uniqueRocksSeen,
    framesWithRocksInSOI,
    uniqueCellsVisited,
  }
}
