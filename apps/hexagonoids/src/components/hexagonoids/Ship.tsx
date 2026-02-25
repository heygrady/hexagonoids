import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import type { Component } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'

import { useScene } from '../solid-babylon/hooks/useScene'

import {
  SHIP_REGENERATION_GRACE_PERIOD,
  TAIL_BLINK_DURATION,
} from './constants'
import type { ShipNodes } from './engine/nodeTypes'
import type { ObjectPool } from './pool/ObjectPool'

export interface ShipProps {
  shipId: string
  pool: ObjectPool<ShipNodes>
}

export const Ship: Component<ShipProps> = (props) => {
  const engine = useGameState()
  const scene = useScene()

  let nodes: ShipNodes
  let observer: ReturnType<typeof scene.onBeforeRenderObservable.add>

  onMount(() => {
    nodes = props.pool.acquire()
    nodes.shipNode.isVisible = true
    nodes.originNode.setEnabled(true)

    observer = scene.onBeforeRenderObservable.add(() => {
      const ship = engine.state.ships.get(props.shipId)
      if (ship == null) return

      // Position on sphere (use copyFromFloats to avoid cross-package Quaternion type mismatch)
      const o = ship.orientation
      nodes.originNode.rotationQuaternion!.copyFromFloats(o.x, o.y, o.z, o.w)

      // Heading (yaw)
      nodes.orientationNode.rotation.y = ship.yaw

      // Regeneration grace period blink
      const player = engine.state.players.get(ship.playerId)
      let regenGraceBlink: boolean | null = null
      if (player?.regeneratedAt != null) {
        const elapsed = engine.state.now - player.regeneratedAt
        if (elapsed < SHIP_REGENERATION_GRACE_PERIOD) {
          const maxDuration = SHIP_REGENERATION_GRACE_PERIOD / 5
          const blinkDuration = (elapsed % maxDuration) * 2
          nodes.shipNode.isVisible = blinkDuration < maxDuration
          regenGraceBlink = nodes.shipNode.isVisible
        } else {
          nodes.shipNode.isVisible = true
          regenGraceBlink = null
        }
      } else {
        nodes.shipNode.isVisible = true
      }

      // Tail flame visibility based on thrust input
      const isThrusting = player?.thrustPressedAt != null
      if (isThrusting) {
        const thrustElapsed = engine.state.now - (player!.thrustPressedAt ?? 0)
        const blinkDuration = (thrustElapsed % TAIL_BLINK_DURATION) * 2
        nodes.shipTailNode.isVisible =
          regenGraceBlink === false
            ? false
            : blinkDuration < TAIL_BLINK_DURATION
      } else {
        nodes.shipTailNode.isVisible = false
      }
    })
  })

  onCleanup(() => {
    scene.onBeforeRenderObservable.remove(observer)
    if (nodes != null) {
      props.pool.release(nodes)
    }
  })

  return null
}
