/**
 * Diagnostic: inspect the input encoding system.
 *
 * Uses the production `encodeGameState` to analyze input distributions
 * across scenario gauntlet runs.
 *
 * Layout (90 inputs):
 *   [0]      ship.velocityX  [-1,1]
 *   [1]      ship.velocityY  [-1,1]
 *   [2..65]  8 cones x 2 rocks x 4: proximity, bearing, velocityX, velocityY
 *   [66..89] 6 bullet slots x 4: proximity, bearing, velocityX, velocityY
 */
import {
  BULLET_SLOTS,
  CONE_COUNT,
  doNothingAgent,
  encodeGameState,
  FEATURES_PER_BULLET,
  FEATURES_PER_CONE,
  FEATURES_PER_ROCK,
  GLOBAL_FEATURES,
  INPUT_COUNT,
  ROCKS_PER_CONE,
  randomAgent,
  restoreSnapshot,
  type ScenarioSnapshot,
} from '@heygrady/hexagonoids-environment'
import { createRNG } from '@neat-evolution/utils'

import { loadScenarioBank } from '../../data/scenarios.js'

export interface InspectInputsOptions {
  scenariosPerRun: number
  scenarioMaxTicks: number
  seed: string
  agent: 'random' | 'doNothing'
  dtMs: number
  verbose: boolean
}

export const DEFAULT_INSPECT_INPUTS_OPTIONS: InspectInputsOptions = {
  scenariosPerRun: 100,
  scenarioMaxTicks: 60,
  seed: 'inspect-inputs-002',
  agent: 'random',
  dtMs: 33,
  verbose: false,
}

interface ChannelStats {
  min: number
  max: number
  mean: number
  stddev: number
  nonzero: number
}

const ROCK_FEATURE_NAMES = ['proximity', 'bearing', 'velocityX', 'velocityY']
const SHIP_FEATURE_NAMES = ['velocityX', 'velocityY']

function selectScenarios(
  scenarioBank: ScenarioSnapshot[],
  count: number,
  seed: string
): ScenarioSnapshot[] {
  if (count >= scenarioBank.length) return [...scenarioBank]
  const rng = createRNG(seed)
  const indices = Array.from({ length: scenarioBank.length }, (_, i) => i)
  const selected: ScenarioSnapshot[] = []
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng.gen() * (scenarioBank.length - i))
    const temp = indices[i] as number
    indices[i] = indices[j] as number
    indices[j] = temp
    selected.push(scenarioBank[indices[i] as number] as ScenarioSnapshot)
  }
  return selected
}

export async function runInspectInputs(
  options: InspectInputsOptions
): Promise<void> {
  const PLAYER_ID = 'player-1'

  // ── Load scenarios ──
  const scenarioBank = await loadScenarioBank()
  const count = Math.min(options.scenariosPerRun, scenarioBank.length)
  const selected = selectScenarios(scenarioBank, count, options.seed)

  console.log(
    `\n=== Input Inspection (${INPUT_COUNT}-input encoding) ===\n` +
      `seed="${options.seed}" agent=${options.agent} ` +
      `scenarios=${selected.length}/${scenarioBank.length} ` +
      `maxTicks=${options.scenarioMaxTicks} dtMs=${options.dtMs}\n` +
      `INPUT_COUNT=${INPUT_COUNT} GLOBAL_FEATURES=${GLOBAL_FEATURES} ` +
      `CONE_COUNT=${CONE_COUNT} ROCKS_PER_CONE=${ROCKS_PER_CONE} ` +
      `FEATURES_PER_ROCK=${FEATURES_PER_ROCK} FEATURES_PER_CONE=${FEATURES_PER_CONE}\n` +
      `BULLET_SLOTS=${BULLET_SLOTS} FEATURES_PER_BULLET=${FEATURES_PER_BULLET}\n`
  )

  const baseAgent = options.agent === 'doNothing' ? doNothingAgent : randomAgent

  // ── Run scenario gauntlet ──
  const allInputs: Array<ArrayLike<number>> = []
  let totalFrames = 0

  for (const scenario of selected) {
    const gameEngine = restoreSnapshot(scenario, options.seed)
    const { state, rng } = gameEngine
    const context = {
      rng,
      memory: {},
      executor: undefined,
      spatialQueries: gameEngine,
    }
    const seenRocks = new Set<string>()

    for (let tick = 0; tick < options.scenarioMaxTicks; tick++) {
      if (state.endedAt != null) break

      const inputs = encodeGameState(
        state,
        PLAYER_ID,
        undefined,
        undefined,
        undefined,
        gameEngine,
        seenRocks
      )
      allInputs.push(inputs)
      totalFrames++

      const action = baseAgent(state, PLAYER_ID, context)
      gameEngine.tick({ [PLAYER_ID]: action }, options.dtMs)
    }
  }

  // ── Per-channel statistics ──
  const stats: ChannelStats[] = new Array(INPUT_COUNT)
  for (let c = 0; c < INPUT_COUNT; c++) {
    let min = Infinity
    let max = -Infinity
    let sum = 0
    let sumSq = 0
    let nonzero = 0
    for (let f = 0; f < totalFrames; f++) {
      const v = allInputs[f]![c]!
      if (v < min) min = v
      if (v > max) max = v
      sum += v
      sumSq += v * v
      if (Math.abs(v) > 1e-9) nonzero++
    }
    const mean = sum / totalFrames
    const variance = sumSq / totalFrames - mean * mean
    const stddev = Math.sqrt(Math.max(0, variance))
    stats[c] = { min, max, mean, stddev, nonzero }
  }

  // ── Ship global features ──
  console.log('── Ship Features ──')
  printStatsHeader()
  for (let i = 0; i < GLOBAL_FEATURES; i++) {
    printStatRow(SHIP_FEATURE_NAMES[i] ?? `global${i}`, stats[i]!, totalFrames)
  }

  // ── Rock LIDAR aggregate by feature type ──
  const rockBase = GLOBAL_FEATURES
  const rockEnd = GLOBAL_FEATURES + CONE_COUNT * FEATURES_PER_CONE
  printFeatureAggregate(
    'Rock LIDAR',
    stats,
    rockBase,
    CONE_COUNT * ROCKS_PER_CONE,
    FEATURES_PER_ROCK,
    ROCK_FEATURE_NAMES,
    totalFrames
  )

  // ── Bullet aggregate by feature type ──
  const bulletBase = rockEnd
  printFeatureAggregate(
    'Bullet',
    stats,
    bulletBase,
    BULLET_SLOTS,
    FEATURES_PER_BULLET,
    ROCK_FEATURE_NAMES, // same feature names: proximity, bearing, velX, velY
    totalFrames
  )

  // ── Zero-frame and cone activation analysis ──
  let allZeroLidarFrames = 0
  let allZeroStreakMax = 0
  let currentStreak = 0
  const coneActivations = new Array<number>(CONE_COUNT).fill(0)

  for (let f = 0; f < totalFrames; f++) {
    const inputs = allInputs[f]!
    let allZero = true
    for (let cone = 0; cone < CONE_COUNT; cone++) {
      const base = GLOBAL_FEATURES + cone * FEATURES_PER_CONE
      // Check all rock slots in this cone
      for (let r = 0; r < ROCKS_PER_CONE; r++) {
        if (Math.abs(inputs[base + r * FEATURES_PER_ROCK]!) > 1e-9) {
          allZero = false
          coneActivations[cone]!++
          break
        }
      }
    }
    if (allZero) {
      allZeroLidarFrames++
      currentStreak++
    } else {
      if (currentStreak > allZeroStreakMax) allZeroStreakMax = currentStreak
      currentStreak = 0
    }
  }
  if (currentStreak > allZeroStreakMax) allZeroStreakMax = currentStreak

  const zeroLidarPct = (allZeroLidarFrames / totalFrames) * 100
  const meanActiveCones =
    coneActivations.reduce((s, v) => s + v, 0) / totalFrames
  const coveragePct = (meanActiveCones / CONE_COUNT) * 100
  const saturationPct = 100 - zeroLidarPct

  console.log('\n── LIDAR Coverage ──')
  console.log(
    `  Total frames:      ${totalFrames}\n` +
      `  Zero-LIDAR frames: ${allZeroLidarFrames} (${zeroLidarPct.toFixed(1)}%)\n` +
      `  Mean active cones: ${meanActiveCones.toFixed(2)} / ${CONE_COUNT}\n` +
      `  Coverage:          ${coveragePct.toFixed(1)}%\n` +
      `  Saturation:        ${saturationPct.toFixed(1)}%\n` +
      `  Max zero streak:   ${allZeroStreakMax}`
  )

  // ── Verbose sections ──
  if (options.verbose) {
    printPerConeActivation(coneActivations, totalFrames)
    printPerConeFeatureStats(stats, totalFrames)
    printSampleFrames(allInputs, totalFrames)
  }

  // ── Proximity distribution ──
  printHistogram(
    'Proximity Distribution [-1, 1]',
    allInputs,
    totalFrames,
    GLOBAL_FEATURES,
    CONE_COUNT * ROCKS_PER_CONE,
    FEATURES_PER_ROCK,
    0,
    20
  )

  // ── Bearing distribution ──
  printHistogram(
    'Bearing Distribution (detections only)',
    allInputs,
    totalFrames,
    GLOBAL_FEATURES,
    CONE_COUNT * ROCKS_PER_CONE,
    FEATURES_PER_ROCK,
    1,
    8
  )

  console.log('\n=== Done ===\n')
}

// ── Formatting helpers ──

function printStatsHeader(): void {
  console.log(
    'Feature'.padEnd(16) +
      'Min'.padStart(10) +
      'Max'.padStart(10) +
      'Mean'.padStart(10) +
      'StdDev'.padStart(10) +
      'Nonzero%'.padStart(10)
  )
}

function printStatRow(name: string, s: ChannelStats, total: number): void {
  const pct = ((s.nonzero / total) * 100).toFixed(1)
  console.log(
    name.padEnd(16) +
      s.min.toFixed(4).padStart(10) +
      s.max.toFixed(4).padStart(10) +
      s.mean.toFixed(4).padStart(10) +
      s.stddev.toFixed(4).padStart(10) +
      `${pct}%`.padStart(10)
  )
}

function printFeatureAggregate(
  label: string,
  stats: ChannelStats[],
  baseOffset: number,
  slotCount: number,
  featuresPerSlot: number,
  featureNames: string[],
  totalFrames: number
): void {
  console.log(`\n── ${label} Aggregate (across all slots) ──`)
  printStatsHeader()
  for (let feat = 0; feat < featuresPerSlot; feat++) {
    let gMin = Infinity
    let gMax = -Infinity
    let gSum = 0
    let gSumSq = 0
    let gNonzero = 0
    let totalSamples = 0
    for (let slot = 0; slot < slotCount; slot++) {
      const idx = baseOffset + slot * featuresPerSlot + feat
      const s = stats[idx]!
      if (s.min < gMin) gMin = s.min
      if (s.max > gMax) gMax = s.max
      gSum += s.mean * totalFrames
      gSumSq += (s.stddev * s.stddev + s.mean * s.mean) * totalFrames
      gNonzero += s.nonzero
      totalSamples += totalFrames
    }
    const mean = gSum / totalSamples
    const variance = gSumSq / totalSamples - mean * mean
    const stddev = Math.sqrt(Math.max(0, variance))
    const pct = ((gNonzero / totalSamples) * 100).toFixed(1)
    const name = featureNames[feat] ?? `feat${feat}`
    console.log(
      name.padEnd(16) +
        gMin.toFixed(4).padStart(10) +
        gMax.toFixed(4).padStart(10) +
        mean.toFixed(4).padStart(10) +
        stddev.toFixed(4).padStart(10) +
        `${pct}%`.padStart(10)
    )
  }
}

function printPerConeActivation(
  coneActivations: number[],
  totalFrames: number
): void {
  console.log('\n── Per-Cone Activation ──')
  for (let cone = 0; cone < CONE_COUNT; cone++) {
    const pct = ((coneActivations[cone]! / totalFrames) * 100).toFixed(1)
    const bar = '#'.repeat(
      Math.round((coneActivations[cone]! / totalFrames) * 50)
    )
    const angleDeg = ((cone / CONE_COUNT) * 360 - 180).toFixed(0)
    console.log(
      `  cone${String(cone).padStart(2)} (${angleDeg.padStart(4)}°): ${pct.padStart(5)}% ${bar}`
    )
  }
}

function printPerConeFeatureStats(
  stats: ChannelStats[],
  totalFrames: number
): void {
  console.log('\n── Per-Cone Feature Stats ──')
  for (let cone = 0; cone < CONE_COUNT; cone++) {
    const angleDeg = ((cone / CONE_COUNT) * 360 - 180).toFixed(0)
    console.log(`  cone${cone} (${angleDeg}°):`)
    for (let r = 0; r < ROCKS_PER_CONE; r++) {
      console.log(`    rock${r}:`)
      for (let feat = 0; feat < FEATURES_PER_ROCK; feat++) {
        const idx =
          GLOBAL_FEATURES +
          cone * FEATURES_PER_CONE +
          r * FEATURES_PER_ROCK +
          feat
        const s = stats[idx]!
        const pct = ((s.nonzero / totalFrames) * 100).toFixed(1)
        const name = ROCK_FEATURE_NAMES[feat] ?? `feat${feat}`
        console.log(
          `      ${name.padEnd(14)}` +
            `min=${s.min.toFixed(4).padStart(8)} ` +
            `max=${s.max.toFixed(4).padStart(8)} ` +
            `mean=${s.mean.toFixed(4).padStart(8)} ` +
            `std=${s.stddev.toFixed(4).padStart(8)} ` +
            `nz=${pct}%`
        )
      }
    }
  }
}

function printSampleFrames(allInputs: Array<ArrayLike<number>>, totalFrames: number): void {
  console.log('\n── Sample Frames (first 5 with LIDAR activity) ──')
  let shown = 0
  for (let f = 0; f < totalFrames && shown < 5; f++) {
    const inputs = allInputs[f]!
    let hasActivity = false
    for (let cone = 0; cone < CONE_COUNT && !hasActivity; cone++) {
      const base = GLOBAL_FEATURES + cone * FEATURES_PER_CONE
      for (let r = 0; r < ROCKS_PER_CONE; r++) {
        if (Math.abs(inputs[base + r * FEATURES_PER_ROCK]!) > 1e-9) {
          hasActivity = true
          break
        }
      }
    }
    if (!hasActivity) continue
    shown++

    console.log(`  Frame ${f}:`)
    console.log(
      `    ship: velocityX=${inputs[0]!.toFixed(4)} velocityY=${inputs[1]!.toFixed(4)}`
    )
    const activeCones: string[] = []
    for (let cone = 0; cone < CONE_COUNT; cone++) {
      const base = GLOBAL_FEATURES + cone * FEATURES_PER_CONE
      for (let r = 0; r < ROCKS_PER_CONE; r++) {
        const rb = base + r * FEATURES_PER_ROCK
        if (Math.abs(inputs[rb]!) > 1e-9) {
          activeCones.push(
            `      cone${cone}/rock${r}: prox=${inputs[rb]!.toFixed(4)} bear=${inputs[rb + 1]!.toFixed(4)} velX=${inputs[rb + 2]!.toFixed(4)} velY=${inputs[rb + 3]!.toFixed(4)}`
          )
        }
      }
    }
    console.log(`    active detections (${activeCones.length}):`)
    for (const line of activeCones) {
      console.log(line)
    }
  }
}

function printHistogram(
  title: string,
  allInputs: Array<ArrayLike<number>>,
  totalFrames: number,
  baseOffset: number,
  slotCount: number,
  featuresPerSlot: number,
  featureIndex: number,
  buckets: number
): void {
  console.log(`\n── ${title} ──`)
  const histogram = new Array<number>(buckets).fill(0)
  let totalSamples = 0
  for (let f = 0; f < totalFrames; f++) {
    const inputs = allInputs[f]!
    for (let slot = 0; slot < slotCount; slot++) {
      const proxIdx = baseOffset + slot * featuresPerSlot
      const prox = inputs[proxIdx]!
      if (Math.abs(prox) > 1e-9) {
        const val = inputs[proxIdx + featureIndex]!
        const bucket = Math.min(
          buckets - 1,
          Math.max(0, Math.floor(((val + 1) / 2) * buckets))
        )
        histogram[bucket]!++
        totalSamples++
      }
    }
  }
  for (let b = 0; b < buckets; b++) {
    const lo = ((b / buckets) * 2 - 1).toFixed(2)
    const hi = (((b + 1) / buckets) * 2 - 1).toFixed(2)
    const pct =
      totalSamples > 0
        ? ((histogram[b]! / totalSamples) * 100).toFixed(1)
        : '0.0'
    const bar = '#'.repeat(
      Math.round(totalSamples > 0 ? (histogram[b]! / totalSamples) * 50 : 0)
    )
    console.log(`  [${lo},${hi}): ${pct.padStart(5)}% ${bar}`)
  }
}
