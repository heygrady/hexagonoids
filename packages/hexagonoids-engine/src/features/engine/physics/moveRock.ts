import { quatToUnitPoint } from '../math/quat.js'
import { vec3LengthSq } from '../math/vec3.js'
import type { RockState } from '../types.js'

import { integrateAngularVelocity } from './quaternionPhysics.js'

/**
 * Move a rock by integrating its constant angular velocity.
 * Mutates `rock.orientation` and `rock.position`.
 */
export const moveRock = (rock: RockState, dtMs: number): void => {
  if (vec3LengthSq(rock.angularVelocity) < 1e-10) {
    return
  }
  integrateAngularVelocity(rock.orientation, rock.angularVelocity, dtMs / 1000)
  quatToUnitPoint(rock.position, rock.orientation)
}
