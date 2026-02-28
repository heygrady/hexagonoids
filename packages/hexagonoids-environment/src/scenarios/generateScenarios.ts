import {
  createGame,
  greatCircleDistance,
  type PlayerInputs,
  RADIUS,
  startPlayer,
  step,
} from '@heygrady/hexagonoids-engine'

import { randomAgent } from '../agents/randomAgent.js'
import type { AgentContext } from '../agents/types.js'
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
}

/**
 * Generate scenario snapshots by playing games with `randomAgent` and
 * capturing state before each player death.
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

  const PLAYER_ID = 'player-1'
  const results: ScenarioSnapshot[] = []
  let scenarioId = 0

  for (let gameIdx = 0; gameIdx < maxGames; gameIdx++) {
    if (results.length >= count) break

    const gameSeed = `${baseSeed}-game-${gameIdx}`
    const { state, rng } = createGame({ seed: gameSeed, useFastThrust: true })
    startPlayer(state, PLAYER_ID, rng)

    const context: AgentContext = { rng, memory: {}, executor: undefined }
    const stepInputs: PlayerInputs = {
      [PLAYER_ID]: { left: false, right: false, thrust: false, fire: false },
    }

    // Ring buffer for rewinding
    const ringBuffer: (ScenarioSnapshot | undefined)[] = new Array(
      rewindFrames
    ).fill(undefined)
    let ringIndex = 0
    let wasAlive = true

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
      const inputs = randomAgent(state, PLAYER_ID, context)
      stepInputs[PLAYER_ID] = inputs
      step(state, stepInputs, dtMs, rng)

      // Death detection: check if player just died
      const playerAfter = state.players.get(PLAYER_ID)
      const isAlive = playerAfter?.alive === true
      const shipAfter =
        playerAfter?.shipId != null
          ? state.ships.get(playerAfter.shipId)
          : undefined
      const shipAlive = shipAfter?.alive === true

      if (wasAlive && !shipAlive) {
        // Grab oldest valid snapshot from ring buffer
        const filledCount = Math.min(ringIndex, rewindFrames)
        if (filledCount > 0) {
          // Oldest snapshot is the one that was written `filledCount` entries ago
          const oldestIdx = (ringIndex - filledCount) % rewindFrames
          const snapshot = ringBuffer[(oldestIdx + rewindFrames) % rewindFrames]

          if (snapshot != null && snapshot.ship.alive) {
            // Compute difficulty: count rocks within SOI of ship position
            let rocksInSOI = 0
            for (const rock of snapshot.rocks) {
              const dist = greatCircleDistance(
                snapshot.ship.lat,
                snapshot.ship.lng,
                rock.lat,
                rock.lng,
                RADIUS
              )
              // SOI_ANGULAR_RADIUS is in radians, greatCircleDistance returns
              // arc length in world units. Compare using arc distance.
              if (dist <= SOI_ANGULAR_RADIUS * RADIUS) {
                rocksInSOI++
              }
            }

            // Normalize difficulty by 20 (clamped to [0, 1])
            const difficulty = Math.min(rocksInSOI / 20, 1)
            const id = `${baseSeed}-${scenarioId++}`

            snapshot.id = id
            snapshot.difficulty = difficulty
            results.push(snapshot)

            // Clear ring buffer for next death
            ringBuffer.fill(undefined)
            ringIndex = 0
          }
        }
      }

      wasAlive = shipAlive || (isAlive && ship == null)

      if (results.length >= count) break
    }
  }

  return results
}
