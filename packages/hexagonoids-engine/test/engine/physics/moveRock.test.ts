import { describe, expect, it } from 'vitest'
import { vec3 } from '../../../src/features/engine/math/create.js'
import { moveRock } from '../../../src/index.js'
import { makeRock } from '../../helpers/entities.js'

describe('moveRock', () => {
  it('does not move a rock at rest', () => {
    const rock = makeRock()
    const x0 = rock.position[0]
    const y0 = rock.position[1]
    const z0 = rock.position[2]
    moveRock(rock, 16)
    expect(rock.position[0]).toBe(x0)
    expect(rock.position[1]).toBe(y0)
    expect(rock.position[2]).toBe(z0)
  })

  it('updates position when rock has angular velocity', () => {
    const rock = makeRock({ angularVelocity: vec3(0.5, 0, 0) })
    const x0 = rock.position[0]
    const y0 = rock.position[1]
    const z0 = rock.position[2]
    moveRock(rock, 100)
    const moved =
      Math.abs(rock.position[0] - x0) > 0.001 ||
      Math.abs(rock.position[1] - y0) > 0.001 ||
      Math.abs(rock.position[2] - z0) > 0.001
    expect(moved).toBe(true)
  })
})
