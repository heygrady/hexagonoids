import {
  createGame,
  type EngineHooks,
  type PlayerInputs,
  startPlayer,
} from '@heygrady/hexagonoids-engine'

import { randomAgent } from '../agents/randomAgent.js'
import type { AgentContext, AgentFn } from '../agents/types.js'
import type { SimulationConfig } from '../HexagonoidsEnvironmentConfig.js'
import { SOI_ANGULAR_RADIUS } from '../utils/constants.js'

import { captureSnapshot } from './captureSnapshot.js'
import type { ScenarioSnapshot } from './types.js'

export interface GenerateScenariosOptions {
  /** Number of scenarios to generate. @default 100 */
  count?: number
  /** Base seed for deterministic generation. @default "scenario-gen" */
  baseSeed?: string
  /** Number of frames to rewind before death. @default 60 */
  rewindFrames?: number
  /** Maximum number of games to play. @default 500 */
  maxGames?: number
  /** Simulation config overrides (maxTicks, dtMs). */
  simulation?: Partial<SimulationConfig>
  /** Agent function to use. @default randomAgent */
  agent?: AgentFn
  /** Which event types to capture. @default ['death'] */
  captureTypes?: Array<'death' | 'kill'>
  /** Fraction of `count` allocated to kill scenarios (0–1). @default 0 */
  killRatio?: number
}

/**
 * Capture a snapshot from the ring buffer at the oldest valid position,
 * compute difficulty, and tag with the given captureType.
 */
function captureFromRingBuffer(
  ringBuffer: (ScenarioSnapshot | undefined)[],
  ringIndex: number,
  rewindFrames: number,
  baseSeed: string,
  scenarioId: number,
  captureType: 'death' | 'kill'
): ScenarioSnapshot | null {
  const filledCount = Math.min(ringIndex, rewindFrames)
  if (filledCount === 0) return null

  const oldestIdx = (ringIndex - filledCount) % rewindFrames
  const snapshot = ringBuffer[(oldestIdx + rewindFrames) % rewindFrames]

  if (snapshot == null || !snapshot.ship.alive) return null

  // Compute difficulty: count rocks within SOI of ship position
  let rocksInSOI = 0
  for (const rock of snapshot.rocks) {
    const dot =
      snapshot.ship.x * rock.x +
      snapshot.ship.y * rock.y +
      snapshot.ship.z * rock.z
    const dist = Math.acos(Math.max(-1, Math.min(1, dot)))
    if (dist <= SOI_ANGULAR_RADIUS) {
      rocksInSOI++
    }
  }

  const difficulty = Math.min(rocksInSOI / 20, 1)
  const id = `${baseSeed}-${scenarioId}`

  snapshot.id = id
  snapshot.difficulty = difficulty
  if (captureType === 'kill') {
    snapshot.captureType = 'kill'
  }

  return snapshot
}

/**
 * Generate scenario snapshots by playing games with an agent and
 * capturing state before each player death and/or bullet-rock kill.
 *
 * By default uses `randomAgent`. Pass `agent` and `executor` to use
 * a trained neural-network agent for adversarial scenario generation.
 *
 * This is a Node-only function intended for offline generation.
 */
export function generateScenarios(
  options?: GenerateScenariosOptions
): ScenarioSnapshot[] {
  const count = options?.count ?? 100
  const baseSeed = options?.baseSeed ?? 'scenario-gen'
  const rewindFrames = options?.rewindFrames ?? 60
  const maxGames = options?.maxGames ?? 500
  const maxTicks = options?.simulation?.maxTicks ?? 3000
  const dtMs = options?.simulation?.dtMs ?? 33
  const agent = options?.agent ?? randomAgent
  const captureTypes = options?.captureTypes ?? ['death']
  const killRatio = options?.killRatio ?? 0

  const captureDeaths = captureTypes.includes('death')
  const captureKills = captureTypes.includes('kill')

  // Compute per-type quotas so kills don't starve deaths
  const killQuota = captureKills ? Math.round(count * killRatio) : 0
  const deathQuota = captureDeaths ? count - killQuota : 0

  const PLAYER_ID = 'player-1'
  const results: ScenarioSnapshot[] = []
  let killCount = 0
  let deathCount = 0
  let scenarioId = 0

  for (let gameIdx = 0; gameIdx < maxGames; gameIdx++) {
    if (killCount >= killQuota && deathCount >= deathQuota) break

    const gameSeed = `${baseSeed}-game-${gameIdx}`
    const engine = createGame({ seed: gameSeed, useFastThrust: true })
    const { state, rng } = engine
    startPlayer(state, PLAYER_ID, rng)

    const context: AgentContext = {
      rng,
      memory: {},
      spatialQueries: engine,
    }
    const stepInputs: PlayerInputs = {
      [PLAYER_ID]: { left: false, right: false, thrust: false, fire: false },
    }

    // Ring buffer for rewinding
    const ringBuffer: (ScenarioSnapshot | undefined)[] = new Array(
      rewindFrames
    ).fill(undefined)
    let ringIndex = 0
    let wasAlive = true
    let killDetectedThisTick = false

    // Build hooks for kill detection
    const hooks: EngineHooks | undefined = captureKills
      ? {
          onCollision(_a, _b, type) {
            if (type === 'bullet-rock') {
              killDetectedThisTick = true
            }
          },
        }
      : undefined

    for (let tick = 0; tick < maxTicks; tick++) {
      if (state.endedAt != null) break

      const player = state.players.get(PLAYER_ID)
      const ship =
        player?.shipId != null ? state.ships.get(player.shipId) : undefined

      // Capture snapshot into ring buffer (only when ship is alive)
      if (ship?.alive === true) {
        ringBuffer[ringIndex % rewindFrames] = captureSnapshot(state, PLAYER_ID)
        ringIndex++
      }

      // Get agent inputs and step
      killDetectedThisTick = false
      const inputs = agent(state, PLAYER_ID, context)
      stepInputs[PLAYER_ID] = inputs
      engine.tick(stepInputs, dtMs, hooks)

      // Kill capture: grab snapshot from ring buffer but do NOT clear it
      if (
        captureKills &&
        killDetectedThisTick &&
        killCount < killQuota &&
        ringIndex > 0
      ) {
        const snapshot = captureFromRingBuffer(
          ringBuffer,
          ringIndex,
          rewindFrames,
          baseSeed,
          scenarioId,
          'kill'
        )
        if (snapshot != null) {
          scenarioId++
          killCount++
          results.push(snapshot)
        }
      }

      // Death detection: check if player just died
      const playerAfter = state.players.get(PLAYER_ID)
      const isAlive = playerAfter?.alive === true
      const shipAfter =
        playerAfter?.shipId != null
          ? state.ships.get(playerAfter.shipId)
          : undefined
      const shipAlive = shipAfter?.alive === true

      if (captureDeaths && wasAlive && !shipAlive && deathCount < deathQuota) {
        const snapshot = captureFromRingBuffer(
          ringBuffer,
          ringIndex,
          rewindFrames,
          baseSeed,
          scenarioId,
          'death'
        )
        if (snapshot != null) {
          scenarioId++
          deathCount++
          results.push(snapshot)

          // Clear ring buffer for next death
          ringBuffer.fill(undefined)
          ringIndex = 0
        }
      }

      wasAlive = shipAlive || (isAlive && ship == null)

      if (killCount >= killQuota && deathCount >= deathQuota) break
    }
  }

  return results
}
