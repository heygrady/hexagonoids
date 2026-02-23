import { RADIUS } from '../constants.js'
import type { RockState } from '../types.js'

import { quaternionToLatLng } from './latLng.js'
import { integrateAngularVelocity } from './quaternionPhysics.js'

/**
 * Move a rock by integrating its constant angular velocity.
 * Rocks have no thrust, friction, or turning — just constant drift.
 * Mutates `rock.orientation`, `rock.lat`, `rock.lng`.
 *
 * @param rock - The rock state to mutate
 * @param dt - Time delta in milliseconds
 * @param radius - Sphere radius
 */
export const moveRock = (
  rock: RockState,
  dt: number,
  radius: number = RADIUS
): void => {
  if (rock.angularVelocity.length() < 0.00001) {
    return
  }

  const dtSeconds = dt / 1000
  rock.orientation = integrateAngularVelocity(
    rock.orientation,
    rock.angularVelocity,
    dtSeconds
  )

  const [lat, lng] = quaternionToLatLng(rock.orientation, radius)
  rock.lat = lat
  rock.lng = lng
}
