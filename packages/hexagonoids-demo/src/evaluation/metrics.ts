import type { RawMetrics } from '@heygrady/hexagonoids-environment'

export const mean = (values: readonly number[]): number => {
  if (values.length === 0) {
    throw new Error('Cannot calculate mean of empty values')
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export const median = (values: readonly number[]): number => {
  if (values.length === 0) {
    throw new Error('Cannot calculate median of empty values')
  }
  const sorted = [...values].sort((a, b) => a - b)
  const center = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    const left = sorted[center - 1]
    const right = sorted[center]
    if (left == null || right == null) {
      throw new Error('Unexpected median state for even-sized values')
    }
    return (left + right) / 2
  }
  const value = sorted[center]
  if (value == null) {
    throw new Error('Unexpected median state for odd-sized values')
  }
  return value
}

export const aggregateRawMetrics = (runs: RawMetrics[]): RawMetrics => {
  const [firstRun] = runs
  if (firstRun == null) {
    throw new Error('Cannot aggregate empty RawMetrics runs')
  }
  return {
    ...firstRun,
    score: mean(runs.map((run) => run.score)),
    rocksDestroyed: mean(runs.map((run) => run.rocksDestroyed)),
    accuracy: mean(runs.map((run) => run.accuracy)),
    distanceTraveled: mean(runs.map((run) => run.distanceTraveled)),
    livesRemaining: mean(runs.map((run) => run.livesRemaining)),
    deaths: mean(runs.map((run) => run.deaths)),
    shotsFired: mean(runs.map((run) => run.shotsFired)),
    shotsHit: mean(runs.map((run) => run.shotsHit)),
    timeAlive: mean(runs.map((run) => run.timeAlive)),
    wavesSpawned: mean(runs.map((run) => run.wavesSpawned)),
  }
}
