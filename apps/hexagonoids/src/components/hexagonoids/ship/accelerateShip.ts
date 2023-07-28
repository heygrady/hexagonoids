import { easeQuadOut } from 'd3-ease'

import {
  ACCELERATION_RATE,
  FRICTION_COEFFICIENT,
  MAX_DURATION,
} from '../constants'
import { bindShipSetters } from '../store/ship/ShipSetters'
import type { ShipStore } from '../store/ship/ShipStore'

import { getOrientation, turnNodeBy } from './orientation'
import { accelerateHeadingSpeed, applyFrictionHeadingSpeed } from './velocity'

/**
 * Force a value to zero when it is less than roughly 1/2 degree from zero radians.
 * @param num
 * @returns
 */
const smallFloor = (num: number) => (num < 1 / 200 ? 0 : num)

export const accelerateShip = (
  $ship: ShipStore,
  delta: number,
  duration: number = MAX_DURATION
) => {
  const shipState = $ship.get()
  const { $control, originNode, orientationNode } = shipState

  if ($control == null) {
    throw new Error('ship control store is missing')
  }
  if (originNode == null || orientationNode == null) {
    throw new Error('ship nodes are missing')
  }

  const controlState = $control.get()
  const { setYaw, setHeadingSpeed } = bindShipSetters($ship)

  if (controlState.acceleratePressed) {
    // Apply Acceleration
    // ease the magnitude from 50% up to 100% over MAX_DURATION
    const t = Math.min(Math.max(duration / MAX_DURATION, 0), 1)
    const et = easeQuadOut(t)
    const halfRate = ACCELERATION_RATE / 1000 / 2
    const magnitude = (et * halfRate + halfRate) * delta

    // Update velocity
    if (magnitude !== 0) {
      // Get the real heading of the ship
      const [shipHeading] = getOrientation(originNode)
      const [shipYaw] = getOrientation(orientationNode)

      // Increase velocity
      const [heading, speed] = accelerateHeadingSpeed(
        shipHeading,
        shipState.speed,
        shipHeading + shipYaw,
        magnitude
      )

      if (heading !== shipState.heading || speed !== shipState.speed) {
        const yawDiff = heading - shipHeading

        // Rotate the ship's heading by yaw radians
        // NOTE: this is operation is inaccurate by a small amount
        turnNodeBy(originNode, yawDiff)

        // Get the new real heading of the ship
        const [nextShipHeading] = getOrientation(originNode)

        setHeadingSpeed(nextShipHeading, smallFloor(speed))

        // Rotate the ship by -yaw radians
        turnNodeBy(orientationNode, -yawDiff)
        const [shipYaw] = getOrientation(orientationNode)
        setYaw(shipYaw)
      }
    }
  } else if (shipState.speed > 0) {
    // Apply Friction (when not accelerating)
    const [heading, speed] = applyFrictionHeadingSpeed(
      shipState.heading,
      shipState.speed,
      FRICTION_COEFFICIENT
    )

    if (heading !== shipState.heading || speed !== shipState.speed) {
      if (heading !== shipState.heading) {
        console.warn('friction changed heading!')
      }
      setHeadingSpeed(heading, smallFloor(speed))
    }
  }
}
