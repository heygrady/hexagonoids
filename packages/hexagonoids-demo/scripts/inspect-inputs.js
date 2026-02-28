/**
 * Diagnostic script: inspect NEAT agent inputs during a deterministic game.
 *
 * Runs simulateGame with a wrapped agent that captures every frame's
 * 133-float input vector, then prints per-channel statistics and
 * identifies frames with all-zero LIDAR.
 *
 * Usage:
 *   node packages/hexagonoids-demo/scripts/inspect-inputs.js [--seed <seed>] [--maxTicks <n>] [--agent <random|doNothing>]
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '..')

function parseArgs(argv) {
  const options = {
    seed: 'inspect-001',
    maxTicks: 1500,
    dtMs: 33,
    agent: 'random', // 'random' or 'doNothing'
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--seed' && argv[i + 1]) options.seed = argv[++i]
    else if (arg === '--maxTicks' && argv[i + 1])
      options.maxTicks = Number(argv[++i])
    else if (arg === '--dtMs' && argv[i + 1]) options.dtMs = Number(argv[++i])
    else if (arg === '--agent' && argv[i + 1]) options.agent = argv[++i]
  }
  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  // Import from environment package (built dist)
  const env = await import('@heygrady/hexagonoids-environment')
  const {
    encodeGameState,
    INPUT_COUNT,
    LIDAR_RAY_COUNT,
    doNothingAgent,
    randomAgent,
  } = env

  // Engine for createGame/step
  const engine = await import('@heygrady/hexagonoids-engine')
  const { createGame, startPlayer, step } = engine

  const PLAYER_ID = 'player-1'
  const GLOBAL_FEATURES = 5
  const FEATURES_PER_RAY = 4

  const { maxTicks, dtMs, seed } = options
  const simulation = { maxTicks, dtMs, useFastThrust: true }

  console.log(
    `\n=== Input Inspection: seed="${seed}" maxTicks=${maxTicks} dtMs=${dtMs} agent=${options.agent} ===\n`
  )

  // ── Phase 1: Run game and capture all input vectors ──────────────

  const { state, rng } = createGame({ seed, useFastThrust: true })
  startPlayer(state, PLAYER_ID, rng)

  // Select agent
  const baseAgent = options.agent === 'doNothing' ? doNothingAgent : randomAgent

  // Agent context
  const context = { rng, memory: {}, executor: undefined }

  const prevDistances = new Map()
  const allInputs = [] // array of 133-float arrays
  const allOutputs = [] // what actions the agent took
  let lastDtMs = dtMs

  const stepInputs = {
    [PLAYER_ID]: { left: false, right: false, thrust: false, fire: false },
  }

  for (let tick = 0; tick < maxTicks; tick++) {
    if (state.endedAt != null) break

    const player = state.players.get(PLAYER_ID)
    const ship =
      player?.shipId != null ? state.ships.get(player.shipId) : undefined

    // Encode inputs (reads prevDistances from previous tick)
    const inputs = encodeGameState(state, PLAYER_ID, prevDistances, lastDtMs)
    allInputs.push([...inputs]) // copy

    // Get agent action
    const action = baseAgent(state, PLAYER_ID, context)
    allOutputs.push({ ...action })

    // Update prevDistances BEFORE step (same fix as simulateGame)
    if (ship?.alive) {
      for (const rock of state.rocks.values()) {
        const key = `rock:${rock.id}`
        const dist = engine.greatCircleDistance(
          ship.lat,
          ship.lng,
          rock.lat,
          rock.lng,
          engine.RADIUS
        )
        prevDistances.set(key, dist)
      }
      for (const bullet of state.bullets.values()) {
        const key = `bullet:${bullet.id}`
        const dist = engine.greatCircleDistance(
          ship.lat,
          ship.lng,
          bullet.lat,
          bullet.lng,
          engine.RADIUS
        )
        prevDistances.set(key, dist)
      }
    }
    lastDtMs = dtMs

    // Step
    stepInputs[PLAYER_ID] = action
    step(state, stepInputs, dtMs, rng)
  }

  const totalFrames = allInputs.length
  console.log(`Total frames captured: ${totalFrames}`)
  console.log(
    `Game ended at tick: ${state.endedAt != null ? 'yes' : `ran full ${maxTicks}`}`
  )
  console.log(`Final score: ${state.players.get(PLAYER_ID)?.score ?? 0}`)
  console.log()

  // ── Phase 2: Per-channel statistics ──────────────────────────────

  const channelNames = [
    'speedNorm',
    'headingForwardDrift',
    'headingLateralDrift',
    'angularVelocityNorm',
    'cooldownNorm',
  ]
  for (let r = 0; r < LIDAR_RAY_COUNT; r++) {
    channelNames.push(`ray${r}_proximity`)
    channelNames.push(`ray${r}_closingSpeed`)
    channelNames.push(`ray${r}_isRock`)
    channelNames.push(`ray${r}_isBullet`)
  }

  // Compute per-channel: min, max, mean, nonzero count
  const stats = new Array(INPUT_COUNT)
  for (let c = 0; c < INPUT_COUNT; c++) {
    let min = Infinity
    let max = -Infinity
    let sum = 0
    let nonzero = 0
    for (let f = 0; f < totalFrames; f++) {
      const v = allInputs[f][c]
      if (v < min) min = v
      if (v > max) max = v
      sum += v
      if (Math.abs(v) > 1e-9) nonzero++
    }
    stats[c] = {
      name: channelNames[c],
      min,
      max,
      mean: sum / totalFrames,
      nonzero,
      nonzeroPct: ((nonzero / totalFrames) * 100).toFixed(1),
    }
  }

  // Print global features
  console.log('── Global Features ──')
  console.log(
    'Channel'.padEnd(30) +
      'Min'.padStart(10) +
      'Max'.padStart(10) +
      'Mean'.padStart(10) +
      'NonZero%'.padStart(10)
  )
  for (let c = 0; c < GLOBAL_FEATURES; c++) {
    const s = stats[c]
    console.log(
      s.name.padEnd(30) +
        s.min.toFixed(4).padStart(10) +
        s.max.toFixed(4).padStart(10) +
        s.mean.toFixed(4).padStart(10) +
        `${s.nonzeroPct}%`.padStart(10)
    )
  }

  // Aggregate LIDAR stats by feature type
  console.log('\n── LIDAR Aggregate (across all 32 rays) ──')
  const lidarFeatureNames = ['proximity', 'closingSpeed', 'isRock', 'isBullet']
  for (let feat = 0; feat < FEATURES_PER_RAY; feat++) {
    let globalMin = Infinity
    let globalMax = -Infinity
    let globalSum = 0
    let globalNonzero = 0
    let totalSamples = 0
    for (let r = 0; r < LIDAR_RAY_COUNT; r++) {
      const idx = GLOBAL_FEATURES + r * FEATURES_PER_RAY + feat
      const s = stats[idx]
      if (s.min < globalMin) globalMin = s.min
      if (s.max > globalMax) globalMax = s.max
      globalSum += s.mean * totalFrames
      globalNonzero += s.nonzero
      totalSamples += totalFrames
    }
    const pct = ((globalNonzero / totalSamples) * 100).toFixed(1)
    console.log(
      `  ${lidarFeatureNames[feat].padEnd(20)}` +
        `min=${globalMin.toFixed(4).padStart(8)} ` +
        `max=${globalMax.toFixed(4).padStart(8)} ` +
        `mean=${(globalSum / totalSamples).toFixed(4).padStart(8)} ` +
        `nonzero=${pct}%`
    )
  }

  // ── Phase 3: All-zero LIDAR frame analysis ───────────────────────

  let allZeroLidarFrames = 0
  let allZeroStreakMax = 0
  let currentStreak = 0
  const streaks = [] // [startTick, length]
  let streakStart = -1

  for (let f = 0; f < totalFrames; f++) {
    const inputs = allInputs[f]
    let allZero = true
    for (let c = GLOBAL_FEATURES; c < INPUT_COUNT; c++) {
      if (Math.abs(inputs[c]) > 1e-9) {
        allZero = false
        break
      }
    }
    if (allZero) {
      allZeroLidarFrames++
      if (currentStreak === 0) streakStart = f
      currentStreak++
    } else {
      if (currentStreak > 0) {
        streaks.push({ start: streakStart, length: currentStreak })
        if (currentStreak > allZeroStreakMax) allZeroStreakMax = currentStreak
        currentStreak = 0
      }
    }
  }
  if (currentStreak > 0) {
    streaks.push({ start: streakStart, length: currentStreak })
    if (currentStreak > allZeroStreakMax) allZeroStreakMax = currentStreak
  }

  const zeroPct = ((allZeroLidarFrames / totalFrames) * 100).toFixed(1)
  console.log(`\n── All-Zero LIDAR Analysis ──`)
  console.log(
    `Frames with ALL LIDAR zeros: ${allZeroLidarFrames}/${totalFrames} (${zeroPct}%)`
  )
  console.log(`Longest zero streak: ${allZeroStreakMax} frames`)
  if (streaks.length > 0) {
    console.log(`Number of zero streaks: ${streaks.length}`)
    const top5 = streaks.sort((a, b) => b.length - a.length).slice(0, 5)
    console.log('Top 5 longest streaks:')
    for (const s of top5) {
      const timeMs = s.length * dtMs
      console.log(
        `  tick ${s.start}-${s.start + s.length - 1} (${s.length} frames, ${(timeMs / 1000).toFixed(1)}s)`
      )
    }
  }

  // ── Phase 4: Per-ray activation frequency ────────────────────────

  console.log('\n── Per-Ray Activation (% of frames with any hit) ──')
  const rayActivations = []
  for (let r = 0; r < LIDAR_RAY_COUNT; r++) {
    let activated = 0
    for (let f = 0; f < totalFrames; f++) {
      const base = GLOBAL_FEATURES + r * FEATURES_PER_RAY
      const inputs = allInputs[f]
      // A ray is "activated" if proximity > 0 (i.e., something detected)
      if (inputs[base] > 1e-9) activated++
    }
    rayActivations.push(activated)
  }

  // Print as a compact bar chart
  for (let r = 0; r < LIDAR_RAY_COUNT; r++) {
    const pct = (rayActivations[r] / totalFrames) * 100
    const bar = '#'.repeat(Math.round(pct / 2))
    const angleDeg = ((r / LIDAR_RAY_COUNT) * 360 - 180).toFixed(0)
    console.log(
      `  ray${String(r).padStart(2)} (${angleDeg.padStart(4)}°): ${pct.toFixed(1).padStart(5)}% ${bar}`
    )
  }

  // ── Phase 5: Frame-by-frame sample (first 10 frames with activity) ──

  console.log('\n── Sample Frames (first 10 with LIDAR activity) ──')
  let shown = 0
  for (let f = 0; f < totalFrames && shown < 10; f++) {
    const inputs = allInputs[f]
    let hasActivity = false
    for (let c = GLOBAL_FEATURES; c < INPUT_COUNT; c++) {
      if (Math.abs(inputs[c]) > 1e-9) {
        hasActivity = true
        break
      }
    }
    if (!hasActivity) continue
    shown++

    console.log(`\n  Frame ${f}:`)
    console.log(
      `    globals: speed=${inputs[0].toFixed(3)} fwdDrift=${inputs[1].toFixed(3)} latDrift=${inputs[2].toFixed(3)} angVel=${inputs[3].toFixed(3)} cooldown=${inputs[4].toFixed(3)}`
    )
    const activeRays = []
    for (let r = 0; r < LIDAR_RAY_COUNT; r++) {
      const base = GLOBAL_FEATURES + r * FEATURES_PER_RAY
      if (inputs[base] > 1e-9) {
        activeRays.push({
          ray: r,
          proximity: inputs[base].toFixed(3),
          closingSpeed: inputs[base + 1].toFixed(3),
          isRock: inputs[base + 2],
          isBullet: inputs[base + 3],
        })
      }
    }
    console.log(`    active rays (${activeRays.length}/${LIDAR_RAY_COUNT}):`)
    for (const ar of activeRays) {
      console.log(
        `      ray${ar.ray}: prox=${ar.proximity} closing=${ar.closingSpeed} rock=${ar.isRock} bullet=${ar.isBullet}`
      )
    }
  }

  // ── Phase 6: Input variance analysis ─────────────────────────────

  console.log('\n── Input Variance Summary ──')
  let staticChannels = 0
  let lowVarianceChannels = 0
  for (let c = 0; c < INPUT_COUNT; c++) {
    const s = stats[c]
    if (s.min === s.max) {
      staticChannels++
    } else if (s.max - s.min < 0.01) {
      lowVarianceChannels++
    }
  }
  console.log(
    `Completely static channels (min===max): ${staticChannels}/${INPUT_COUNT}`
  )
  console.log(
    `Low variance channels (range < 0.01):   ${lowVarianceChannels}/${INPUT_COUNT}`
  )
  console.log(
    `Active channels (range >= 0.01):        ${INPUT_COUNT - staticChannels - lowVarianceChannels}/${INPUT_COUNT}`
  )

  console.log('\n=== Done ===\n')
}

main().catch((error) => {
  console.error('inspect-inputs failed:', error)
  process.exit(1)
})
