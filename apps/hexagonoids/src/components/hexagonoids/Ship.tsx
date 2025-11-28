import type { Component } from 'solid-js'
import { unwrap } from 'solid-js/store'

import { onBeforeRender } from '../solid-babylon/hooks/onBeforeRender'
import { useScene } from '../solid-babylon/hooks/useScene'

import {
  EXPLOSION_SMALL_LIFETIME,
  FIRE_COOLDOWN,
  MAX_DELTA,
  SHIP_REGENERATION_GRACE_PERIOD,
  TAIL_BLINK_DURATION,
} from './constants'
import { useBulletPool } from './hooks/useBulletPool'
import { useShipPool } from './hooks/useShipPool'
import {
  accelerateAck,
  leftAck,
  rightAck,
} from './store/control/ControlActions'
import {
  type ShipActionsWithBulletPool,
  bindShipActions,
} from './store/ship/ShipActions'
import { resetShip, type ShipStore } from './store/ship/ShipStore'
import { releaseShipStore } from './store/shipPool/ShipPool'

export interface ShipProps {
  id?: string
  store: ShipStore
}

export const Ship: Component<ShipProps> = (props) => {
  const scene = useScene()
  const [$bullets] = useBulletPool()
  const [$ships] = useShipPool()

  const $ship = unwrap(props.store)

  // Ship material color is now handled globally by CameraLighting component
  // based on camera position, not individual ship positions

  // Handle controls (and other stuff)
  onBeforeRender(() => {
    const {
      $control,
      type,
      orientationNode,
      originNode,
      positionNode,
      shipNode,
      shipTailNode,
      generatedAt,
    } = $ship.get()

    // Manage lifetime
    if (type === 'segment') {
      // return
      const { id } = $ship.get()
      if (id == null) {
        throw new Error('segment ship has no id')
      }
      const now = Date.now()
      const duration = now - (generatedAt ?? now)
      const maxLifetime =
        EXPLOSION_SMALL_LIFETIME + Math.random() * EXPLOSION_SMALL_LIFETIME * 2
      if (duration > maxLifetime) {
        // remove the segment from the scene
        $ships.setKey(id, undefined)
        resetShip($ship)
        releaseShipStore($ship)
        return
      }
    }

    if ($control === null) {
      console.warn('trying to render a ship without a control store')
      return
    }

    if (
      orientationNode == null ||
      shipNode == null ||
      (type === 'ship' && shipTailNode == null) ||
      originNode == null ||
      positionNode == null
    ) {
      console.warn('trying to render a ship without all required nodes')
      return
    }

    const controlState = $control.get()
    const delta = Math.min(MAX_DELTA, scene.getEngine().getDeltaTime())
    const now = Date.now()

    let regenGraceBlink: boolean | null = null
    if (
      type === 'ship' &&
      generatedAt != null &&
      now - generatedAt < SHIP_REGENERATION_GRACE_PERIOD
    ) {
      // make the ship blink after generation
      const duration = now - (generatedAt ?? now)

      // FIXME: animate the alpha
      // Toggle the ship visibility
      const maxDuration = SHIP_REGENERATION_GRACE_PERIOD / 5
      const blinkDuration = (duration % maxDuration) * 2
      shipNode.isVisible = blinkDuration < maxDuration
      regenGraceBlink = shipNode.isVisible
    } else {
      shipNode.isVisible = true
      regenGraceBlink = null
    }
    const { turn, accelerate, move, fire } = bindShipActions(
      $ship,
      $bullets
    ) as ShipActionsWithBulletPool

    const shouldTurn =
      (controlState.leftPressed ||
        controlState.rightPressed ||
        !controlState.leftAcked ||
        !controlState.rightAcked) &&
      !(controlState.leftPressed && controlState.rightPressed)

    // Rotate the ship right and left
    if (shouldTurn) {
      const keyAt =
        controlState.leftPressed || !controlState.leftAcked
          ? controlState.leftPressedAt
          : controlState.rightPressedAt
      const duration = now - (keyAt ?? now)

      turn(delta, duration)
    }

    // Move the ship
    const shipState = $ship.get()
    const shouldAccelerate =
      controlState.acceleratePressed ||
      !controlState.accelerateAcked ||
      shipState.angularVelocity.length() > 0

    if (shouldAccelerate) {
      const keyAt = controlState.acceleratePressedAt
      const duration = now - (keyAt ?? now)

      // FIXME: separate out the apply friction logic
      accelerate(delta, duration) // also apply friction

      if (shipTailNode != null) {
        // Toggle the tail visibility
        const blinkDuration = (duration % TAIL_BLINK_DURATION) * 2

        shipTailNode.isVisible =
          regenGraceBlink === false
            ? false
            : blinkDuration < TAIL_BLINK_DURATION
      }
    }
    if (
      shipTailNode != null &&
      !controlState.acceleratePressed &&
      controlState.accelerateAcked
    ) {
      shipTailNode.isVisible = false
    }

    if (shipState.angularVelocity.length() > 0) {
      const keyAt = controlState.acceleratePressedAt
      const duration = now - (keyAt ?? now)
      move(delta, duration)
    }

    // Fire bullets
    const firedAt = shipState.firedAt
    const canFire = firedAt === null || now - firedAt > FIRE_COOLDOWN
    if ((controlState.firePressed || !controlState.fireAcked) && canFire) {
      fire()
    }

    leftAck($control)
    rightAck($control)
    accelerateAck($control)
  })
  // // Debug hexagon
  // onBeforeRender(() => {
  //   const shipState = $ship.get()
  //   if (shipState.type === 'segment') {
  //     return
  //   }
  //   // pick a fixed radius for each type of object
  //   const radius = SHIP_RADIUS

  //   const hexagon = createHexagon(radius)
  //   generateHexagonDebugNodes(
  //     scene,
  //     shipState.id ?? 'unknown',
  //     hexagon,
  //     geoToVector3(shipState.lat, shipState.lng, RADIUS)
  //   )
  // })
  return null
}
