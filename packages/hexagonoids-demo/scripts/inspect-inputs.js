/**
 * Diagnostic script: inspect the new 34-input encoding system.
 *
 * Uses the production `encodeGameState` (orthographic projection, stateless
 * relative velocities, collision-adjusted proximity, bearing in half-turns)
 * to analyze input distributions across scenario gauntlet runs.
 *
 * Layout (34 inputs):
 *   [0]      ship.velocityX  — tangent-plane right / MAX_SPEED  [-1,1]
 *   [1]      ship.velocityY  — tangent-plane forward / MAX_SPEED [-1,1]
 *   [2..33]  8 cones × 4:
 *     [base+0] proximity   — collision-adjusted [-1,1] (1=touching, 0=bullet range, -1=hemisphere edge)
 *     [base+1] bearing     — half-turns from nose [-1,1] (0=ahead, ±1=behind)
 *     [base+2] velocityX   — relative velocity right / MAX_CLOSING_SPEED [-1,1]
 *     [base+3] velocityY   — relative velocity forward / MAX_CLOSING_SPEED [-1,1]
 *
 * Usage:
 *   node packages/hexagonoids-demo/scripts/inspect-inputs.js [options]
 *
 * Options:
 *   --scenariosPerRun <n>     default: 100
 *   --scenarioMaxTicks <n>    default: 60
 *   --seed <seed>             default: 'inspect-inputs-002'
 *   --agent <random|doNothing>  default: 'random'
 *   --dtMs <n>                default: 33
 *   --verbose                 print per-cone details and sample frames
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '..')

function readScenarioBank(pathname) {
  const text = readFileSync(pathname, 'utf-8')
  if (pathname.endsWith('.js')) {
    const match = text.match(/export default "([^"]+)"/)
    if (match?.[1])
      return JSON.parse(gunzipSync(Buffer.from(match[1], 'base64')).toString())
  }
  return JSON.parse(text)
}

// ── CLI argument parsing ────────────────────────────────────────────────────

function parseArgs(argv) {
  const options = {
    scenariosPerRun: 100,
    scenarioMaxTicks: 60,
    seed: 'inspect-inputs-002',
    agent: 'random',
    dtMs: 33,
    verbose: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--scenariosPerRun' && argv[i + 1])
      options.scenariosPerRun = Number(argv[++i])
    else if (arg === '--scenarioMaxTicks' && argv[i + 1])
      options.scenarioMaxTicks = Number(argv[++i])
    else if (arg === '--seed' && argv[i + 1]) options.seed = argv[++i]
    else if (arg === '--agent' && argv[i + 1]) options.agent = argv[++i]
    else if (arg === '--dtMs' && argv[i + 1]) options.dtMs = Number(argv[++i])
    else if (arg === '--verbose') options.verbose = true
  }
  return options
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const options = parseArgs(process.argv.slice(2))

  // Import dependencies
  const engine = await import('@heygrady/hexagonoids-engine')
  const env = await import('@heygrady/hexagonoids-environment')
  const { createRNG } = await import('@neat-evolution/utils')

  const {
    decodeScenarioBankDocument,
    restoreSnapshot,
    doNothingAgent,
    randomAgent,
    encodeGameState,
    INPUT_COUNT,
    GLOBAL_FEATURES,
    FEATURES_PER_CONE,
    CONE_COUNT,
  } = env

  const PLAYER_ID = 'player-1'

  // ── Load scenarios ──────────────────────────────────────────────────

  const scenariosPath = resolve(packageRoot, 'src/data/scenarioBank.js')
  const scenarioBank = decodeScenarioBankDocument(
    readScenarioBank(scenariosPath)
  )

  const selectionRng = createRNG(options.seed)
  const count = Math.min(options.scenariosPerRun, scenarioBank.length)
  const selected = []
  if (count >= scenarioBank.length) {
    selected.push(...scenarioBank)
  } else {
    const indices = Array.from({ length: scenarioBank.length }, (_, i) => i)
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(selectionRng.gen() * (scenarioBank.length - i))
      const temp = indices[i]
      indices[i] = indices[j]
      indices[j] = temp
      selected.push(scenarioBank[indices[i]])
    }
  }

  console.log(
    `\n=== Input Inspection (v2 — 34-input encoding) ===\n` +
      `seed="${options.seed}" agent=${options.agent} ` +
      `scenarios=${selected.length}/${scenarioBank.length} ` +
      `maxTicks=${options.scenarioMaxTicks} dtMs=${options.dtMs}\n` +
      `INPUT_COUNT=${INPUT_COUNT} GLOBAL_FEATURES=${GLOBAL_FEATURES} ` +
      `CONE_COUNT=${CONE_COUNT} FEATURES_PER_CONE=${FEATURES_PER_CONE}\n`
  )

  // Select agent
  const baseAgent = options.agent === 'doNothing' ? doNothingAgent : randomAgent

  // ── Run scenario gauntlet ─────────────────────────────────────────

  const allInputs = [] // all frames across all scenarios
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

    const seenRocks = new Set()

    for (let tick = 0; tick < options.scenarioMaxTicks; tick++) {
      if (state.endedAt != null) break

      // Encode with production encoder (pass seenRocks for memory rock tracking)
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

      // Get agent action and step
      const action = baseAgent(state, PLAYER_ID, context)
      gameEngine.tick({ [PLAYER_ID]: action }, options.dtMs)
    }
  }

  // ── Per-channel statistics ────────────────────────────────────────

  const stats = new Array(INPUT_COUNT)
  for (let c = 0; c < INPUT_COUNT; c++) {
    let min = Infinity
    let max = -Infinity
    let sum = 0
    let sumSq = 0
    let nonzero = 0
    for (let f = 0; f < totalFrames; f++) {
      const v = allInputs[f][c]
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

  // ── Ship global feature analysis ─────────────────────────────────

  const shipFeatureNames = ['velocityX', 'velocityY']

  console.log('── Ship Features ──')
  console.log(
    'Feature'.padEnd(16) +
      'Min'.padStart(10) +
      'Max'.padStart(10) +
      'Mean'.padStart(10) +
      'StdDev'.padStart(10) +
      'Nonzero%'.padStart(10)
  )
  for (let i = 0; i < GLOBAL_FEATURES; i++) {
    const s = stats[i]
    const pct = ((s.nonzero / totalFrames) * 100).toFixed(1)
    console.log(
      shipFeatureNames[i].padEnd(16) +
        s.min.toFixed(4).padStart(10) +
        s.max.toFixed(4).padStart(10) +
        s.mean.toFixed(4).padStart(10) +
        s.stddev.toFixed(4).padStart(10) +
        `${pct}%`.padStart(10)
    )
  }

  // ── LIDAR aggregate by feature type ──────────────────────────────

  const lidarFeatureNames = ['proximity', 'bearing', 'velocityX', 'velocityY']
  const lidarAgg = []
  for (let feat = 0; feat < FEATURES_PER_CONE; feat++) {
    let gMin = Infinity
    let gMax = -Infinity
    let gSum = 0
    let gSumSq = 0
    let gNonzero = 0
    let totalSamples = 0
    for (let cone = 0; cone < CONE_COUNT; cone++) {
      const idx = GLOBAL_FEATURES + cone * FEATURES_PER_CONE + feat
      const s = stats[idx]
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
    lidarAgg.push({
      name: lidarFeatureNames[feat],
      min: gMin,
      max: gMax,
      mean,
      stddev,
      nonzeroPct: (gNonzero / totalSamples) * 100,
    })
  }

  console.log('\n── LIDAR Aggregate (across all cones) ──')
  console.log(
    'Feature'.padEnd(16) +
      'Min'.padStart(10) +
      'Max'.padStart(10) +
      'Mean'.padStart(10) +
      'StdDev'.padStart(10) +
      'Nonzero%'.padStart(10)
  )
  for (const agg of lidarAgg) {
    console.log(
      agg.name.padEnd(16) +
        agg.min.toFixed(4).padStart(10) +
        agg.max.toFixed(4).padStart(10) +
        agg.mean.toFixed(4).padStart(10) +
        agg.stddev.toFixed(4).padStart(10) +
        `${agg.nonzeroPct.toFixed(1)}%`.padStart(10)
    )
  }

  // ── Zero-frame and cone activation analysis ──────────────────────

  let allZeroLidarFrames = 0
  let allZeroStreakMax = 0
  let currentStreak = 0
  const coneActivations = new Array(CONE_COUNT).fill(0)

  for (let f = 0; f < totalFrames; f++) {
    const inputs = allInputs[f]
    let allZero = true
    for (let cone = 0; cone < CONE_COUNT; cone++) {
      const base = GLOBAL_FEATURES + cone * FEATURES_PER_CONE
      if (Math.abs(inputs[base]) > 1e-9) {
        // non-zero proximity means this cone detected something
        allZero = false
        coneActivations[cone]++
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

  // ── Per-cone activation bar chart ────────────────────────────────

  if (options.verbose) {
    console.log('\n── Per-Cone Activation ──')
    for (let cone = 0; cone < CONE_COUNT; cone++) {
      const pct = (coneActivations[cone] / totalFrames) * 100
      const bar = '#'.repeat(Math.round(pct / 2))
      const angleDeg = ((cone / CONE_COUNT) * 360 - 180).toFixed(0)
      console.log(
        `  cone${String(cone).padStart(2)} (${angleDeg.padStart(4)}°): ${pct.toFixed(1).padStart(5)}% ${bar}`
      )
    }

    // ── Per-cone per-feature stats ──────────────────────────────────

    console.log('\n── Per-Cone Feature Stats ──')
    for (let cone = 0; cone < CONE_COUNT; cone++) {
      const angleDeg = ((cone / CONE_COUNT) * 360 - 180).toFixed(0)
      console.log(`  cone${cone} (${angleDeg}°):`)
      for (let feat = 0; feat < FEATURES_PER_CONE; feat++) {
        const idx = GLOBAL_FEATURES + cone * FEATURES_PER_CONE + feat
        const s = stats[idx]
        const pct = ((s.nonzero / totalFrames) * 100).toFixed(1)
        console.log(
          `    ${lidarFeatureNames[feat].padEnd(14)}` +
            `min=${s.min.toFixed(4).padStart(8)} ` +
            `max=${s.max.toFixed(4).padStart(8)} ` +
            `mean=${s.mean.toFixed(4).padStart(8)} ` +
            `std=${s.stddev.toFixed(4).padStart(8)} ` +
            `nz=${pct}%`
        )
      }
    }

    // ── Sample frames with LIDAR activity ───────────────────────────

    console.log('\n── Sample Frames (first 5 with LIDAR activity) ──')
    let shown = 0
    for (let f = 0; f < totalFrames && shown < 5; f++) {
      const inputs = allInputs[f]
      let hasActivity = false
      for (let cone = 0; cone < CONE_COUNT; cone++) {
        const base = GLOBAL_FEATURES + cone * FEATURES_PER_CONE
        if (Math.abs(inputs[base]) > 1e-9) {
          hasActivity = true
          break
        }
      }
      if (!hasActivity) continue
      shown++

      console.log(`  Frame ${f}:`)
      console.log(
        `    ship: velocityX=${inputs[0].toFixed(4)} velocityY=${inputs[1].toFixed(4)}`
      )
      const activeCones = []
      for (let cone = 0; cone < CONE_COUNT; cone++) {
        const base = GLOBAL_FEATURES + cone * FEATURES_PER_CONE
        if (Math.abs(inputs[base]) > 1e-9) {
          activeCones.push({
            cone,
            proximity: inputs[base].toFixed(4),
            bearing: inputs[base + 1].toFixed(4),
            velocityX: inputs[base + 2].toFixed(4),
            velocityY: inputs[base + 3].toFixed(4),
          })
        }
      }
      console.log(`    active cones (${activeCones.length}/${CONE_COUNT}):`)
      for (const ac of activeCones) {
        console.log(
          `      cone${ac.cone}: prox=${ac.proximity} bear=${ac.bearing} velX=${ac.velocityX} velY=${ac.velocityY}`
        )
      }
    }
  }

  // ── Distribution histogram for proximity ─────────────────────────

  console.log('\n── Proximity Distribution [-1, 1] ──')
  const buckets = 20
  const histogram = new Array(buckets).fill(0)
  let totalProxSamples = 0
  for (let f = 0; f < totalFrames; f++) {
    for (let cone = 0; cone < CONE_COUNT; cone++) {
      const base = GLOBAL_FEATURES + cone * FEATURES_PER_CONE
      const prox = allInputs[f][base]
      if (Math.abs(prox) > 1e-9) {
        // Map [-1, 1] → [0, buckets)
        const bucket = Math.min(
          buckets - 1,
          Math.max(0, Math.floor(((prox + 1) / 2) * buckets))
        )
        histogram[bucket]++
        totalProxSamples++
      }
    }
  }
  for (let b = 0; b < buckets; b++) {
    const lo = ((b / buckets) * 2 - 1).toFixed(1)
    const hi = (((b + 1) / buckets) * 2 - 1).toFixed(1)
    const pct =
      totalProxSamples > 0
        ? ((histogram[b] / totalProxSamples) * 100).toFixed(1)
        : '0.0'
    const bar = '#'.repeat(
      Math.round(
        totalProxSamples > 0 ? (histogram[b] / totalProxSamples) * 50 : 0
      )
    )
    console.log(`  [${lo},${hi}): ${pct.padStart(5)}% ${bar}`)
  }

  // ── Bearing distribution ─────────────────────────────────────────

  console.log('\n── Bearing Distribution (detections only) ──')
  const bearingBuckets = 8
  const bearingHist = new Array(bearingBuckets).fill(0)
  let totalBearSamples = 0
  for (let f = 0; f < totalFrames; f++) {
    for (let cone = 0; cone < CONE_COUNT; cone++) {
      const base = GLOBAL_FEATURES + cone * FEATURES_PER_CONE
      const prox = allInputs[f][base]
      if (Math.abs(prox) > 1e-9) {
        const bearing = allInputs[f][base + 1] // [-1, 1]
        const bucket = Math.min(
          bearingBuckets - 1,
          Math.floor(((bearing + 1) / 2) * bearingBuckets)
        )
        bearingHist[bucket]++
        totalBearSamples++
      }
    }
  }
  for (let b = 0; b < bearingBuckets; b++) {
    const lo = ((b / bearingBuckets) * 2 - 1).toFixed(2)
    const hi = (((b + 1) / bearingBuckets) * 2 - 1).toFixed(2)
    const pct =
      totalBearSamples > 0
        ? ((bearingHist[b] / totalBearSamples) * 100).toFixed(1)
        : '0.0'
    const bar = '#'.repeat(
      Math.round(
        totalBearSamples > 0 ? (bearingHist[b] / totalBearSamples) * 50 : 0
      )
    )
    console.log(`  [${lo},${hi}): ${pct.padStart(5)}% ${bar}`)
  }

  console.log('\n=== Done ===\n')
}

main().catch((error) => {
  console.error('inspect-inputs failed:', error)
  process.exit(1)
})
