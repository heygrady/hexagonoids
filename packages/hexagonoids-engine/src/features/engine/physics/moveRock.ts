import { RADIUS } from '../constants.js'
import type { RockState } from '../types.js'

import { quaternionToUnitPointFastInPlace } from './latLng.js'
import {
  integrateAngularVelocity,
  integrateAngularVelocityFastInPlace,
} from './quaternionPhysics.js'

/**
 * Move a rock by integrating its constant angular velocity.
 * Rocks have no thrust, friction, or turning — just constant drift.
 * Mutates `rock.orientation`, `rock.x`, `rock.y`, `rock.z`.
 *
 * @param rock - The rock state to mutate
 * @param dtMs - Time delta in milliseconds
 * @param radius - Sphere radius
 */
export const moveRock = (
  rock: RockState,
  dtMs: number,
  radius: number = RADIUS,
  useFastMath: boolean = true
): void => {
  const omega = rock.angularVelocity
  if (omega.lengthSquared() < 1e-10) {
    return
  }

  const dtSeconds = dtMs / 1000
  if (useFastMath) {
    integrateAngularVelocityFastInPlace(rock.orientation, omega, dtSeconds)
    quaternionToUnitPointFastInPlace(rock.orientation, rock, radius)
  } else {
    rock.orientation = integrateAngularVelocity(
      rock.orientation,
      omega,
      dtSeconds
    )
    quaternionToUnitPointFastInPlace(rock.orientation, rock, radius)
  }
}
