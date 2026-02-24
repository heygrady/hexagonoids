import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import type { GameState, ShipState } from '@heygrady/hexagonoids-engine'
import {
  elapsed,
  FIRE_COOLDOWN,
  greatCircleDistance,
  MAX_SPEED,
  PLAYER_STARTING_LIVES,
  RADIUS,
} from '@heygrady/hexagonoids-engine'

import { relativeBearing, sphericalBearing } from '../utils/sphericalBearing.js'
import {
  MAX_CLOSING_SPEED,
  SECTOR_COUNT,
  SOI_ARC_DISTANCE,
} from './constants.js'
import { bearingToSector } from './sectorUtils.js'

/** Total number of input floats produced by the encoding */
export const INPUT_COUNT = 30

/**
 * Compute heading-velocity components: [vx, vy] where
 * vy = cos(drift angle), vx = sin(drift angle).
 * When stationary, returns [0, 1] (aligned with heading).
 */
function headingVelocityComponents(ship: ShipState): [number, number] {
  const speed = ship.angularVelocity.length()
  if (speed < 0.00001) {
    return [0, 1]
  }

  // Build world-space heading from orientation + yaw
  const worldUp = Vector3.Up().applyRotationQuaternion(ship.orientation)
  const localHeadingRotation = Quaternion.RotationAxis(Vector3.Up(), ship.yaw)
  const localHeading3D =
    Vector3.Forward().applyRotationQuaternion(localHeadingRotation)
  const worldHeading = localHeading3D.applyRotationQuaternion(ship.orientation)

  // Thrust axis: worldUp × worldHeading (the direction ship accelerates toward)
  const thrustAxis = Vector3.Cross(worldUp, worldHeading)
  const axisLen = thrustAxis.length()
  if (axisLen < 0.00001) {
    return [0, 1]
  }
  thrustAxis.scaleInPlace(1 / axisLen)

  // Project angularVelocity onto thrust axis (forward component)
  // and onto worldHeading (lateral component)
  const forward = Vector3.Dot(ship.angularVelocity, thrustAxis) / speed
  const lateral = Vector3.Dot(ship.angularVelocity, worldHeading) / speed

  return [lateral, forward]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function rockSizeNormalized(size: 0 | 1 | 2): number {
  switch (size) {
    case 2:
      return 1.0 // large
    case 1:
      return 0.67 // medium
    case 0:
      return 0.33 // small
  }
}

/**
 * Encode game state into 30 normalized floats for NEAT input.
 *
 * Layout:
 * [0]     speed          [0, 1]
 * [1]     heading_vx     [-1, 1]
 * [2]     heading_vy     [-1, 1]
 * [3]     can_fire       {0, 1}
 * [4]     lives          [0, 1]
 * [5-28]  8 sectors × 3  (distance [0,1], approachSpeed [-1,1], size [0,1])
 * [29]    nearest_rock   [0, 1]
 */
export function encodeGameState(
  state: GameState,
  playerId: string,
  prevDistances: Map<string, number>,
  dtMs: number
): number[] {
  const inputs = new Array<number>(INPUT_COUNT).fill(0)

  const player = state.players.get(playerId)
  const ship =
    player?.shipId != null ? state.ships.get(player.shipId) : undefined

  if (ship == null || !ship.alive) {
    // Dead ship: all zeros except sector distances = 1.0
    for (let s = 0; s < SECTOR_COUNT; s++) {
      inputs[5 + s * 3] = 1.0 // distance
    }
    inputs[29] = 1.0 // nearest_rock
    return inputs
  }

  // Ship state
  const speed = ship.angularVelocity.length()
  inputs[0] = clamp(speed / MAX_SPEED, 0, 1)

  const [vx, vy] = headingVelocityComponents(ship)
  inputs[1] = clamp(vx, -1, 1)
  inputs[2] = clamp(vy, -1, 1)

  inputs[3] = elapsed(state, ship.firedAt) >= FIRE_COOLDOWN ? 1 : 0
  inputs[4] = clamp((player?.lives ?? 0) / PLAYER_STARTING_LIVES, 0, 1)

  // Sector encoding: nearest rock per sector within SOI
  const sectorDist = new Array<number>(SECTOR_COUNT).fill(SOI_ARC_DISTANCE)
  const sectorApproach = new Array<number>(SECTOR_COUNT).fill(0)
  const sectorSize = new Array<number>(SECTOR_COUNT).fill(0)

  let nearestArcDist = SOI_ARC_DISTANCE

  const dtSec = dtMs / 1000

  for (const rock of state.rocks.values()) {
    const arcDist = greatCircleDistance(
      ship.lat,
      ship.lng,
      rock.lat,
      rock.lng,
      RADIUS
    )

    if (arcDist >= SOI_ARC_DISTANCE) continue

    if (arcDist < nearestArcDist) {
      nearestArcDist = arcDist
    }

    const absBearing = sphericalBearing(ship.lat, ship.lng, rock.lat, rock.lng)
    const relBearing = relativeBearing(absBearing, ship.yaw)
    const sector = bearingToSector(relBearing, SECTOR_COUNT)

    // Keep only the nearest rock per sector
    if (arcDist < (sectorDist[sector] ?? SOI_ARC_DISTANCE)) {
      sectorDist[sector] = arcDist

      // Approach speed from previous tick distances
      const prevDist = prevDistances.get(rock.id)
      if (prevDist != null && dtSec > 0) {
        const approachSpeed = (prevDist - arcDist) / dtSec
        sectorApproach[sector] = clamp(approachSpeed / MAX_CLOSING_SPEED, -1, 1)
      } else {
        sectorApproach[sector] = 0
      }

      sectorSize[sector] = rockSizeNormalized(rock.size)
    }
  }

  // Write sector data
  for (let s = 0; s < SECTOR_COUNT; s++) {
    const base = 5 + s * 3
    inputs[base] = clamp(
      (sectorDist[s] ?? SOI_ARC_DISTANCE) / SOI_ARC_DISTANCE,
      0,
      1
    )
    inputs[base + 1] = sectorApproach[s] ?? 0
    inputs[base + 2] = sectorSize[s] ?? 0
  }

  // Nearest rock distance
  inputs[29] = clamp(nearestArcDist / SOI_ARC_DISTANCE, 0, 1)

  return inputs
}
