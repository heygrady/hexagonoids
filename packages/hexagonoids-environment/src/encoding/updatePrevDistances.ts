import type { GameState } from '@heygrady/hexagonoids-engine'

import type {
  PreviousRockProjectionMap,
  RockPerceptionPrecompute,
} from './collectObservations.js'

const PREV_DISTANCE_CLEANUP_INTERVAL = 8

/**
 * Snapshot current rock distances into prevDistances and prevProjections,
 * then periodically prune entries for destroyed rocks.
 *
 * Call this each tick BEFORE engine.step() so that the next tick's
 * encodeGameState sees accurate closing-speed deltas.
 */
export function updatePrevDistances(
  state: GameState,
  tick: number,
  rockPerception: RockPerceptionPrecompute | undefined,
  prevDistances: Map<string, number>,
  prevProjections: PreviousRockProjectionMap | undefined
): void {
  // Reuse distances already computed by buildRockPerceptionPrecompute
  if (rockPerception != null) {
    for (const rock of rockPerception.rocks) {
      prevDistances.set(rock.id, rock.distance)
      if (prevProjections != null) {
        const existing = prevProjections.get(rock.id)
        if (existing != null) {
          existing[0] = rock.localX
          existing[1] = rock.localY
        } else {
          prevProjections.set(rock.id, [rock.localX, rock.localY])
        }
      }
    }
  }

  // Prune destroyed entities periodically to keep map growth bounded.
  if (tick % PREV_DISTANCE_CLEANUP_INTERVAL === 0) {
    for (const id of prevDistances.keys()) {
      if (!state.rocks.has(id)) {
        prevDistances.delete(id)
        prevProjections?.delete(id)
      }
    }
  }
}
