import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import type { Component } from 'solid-js'
import { onBeforeRender } from '../solid-babylon/hooks/onBeforeRender'
import {
  SHIP_REGENERATION_GRACE_PERIOD,
  TAIL_BLINK_DURATION,
} from './constants'
import { useNodeRegistry } from './NodeRegistry'

/**
 * Single-pass visual sync for all active entity nodes.
 * Replaces per-entity beforeRender observers.
 */
export const EntityVisualSync: Component = () => {
  const engine = useGameState()
  const registry = useNodeRegistry()

  onBeforeRender(() => {
    const state = engine.state
    const now = state.now

    for (const ship of state.ships.values()) {
      const entry = registry.get(`ship:${ship.id}`)
      if (entry == null) continue

      const o = ship.orientation
      entry.originNode.rotationQuaternion?.copyFromFloats(
        o[0],
        o[1],
        o[2],
        o[3]
      )

      if (entry.orientationNode?.rotationQuaternion != null) {
        const halfYaw = ship.yaw * 0.5
        entry.orientationNode.rotationQuaternion.copyFromFloats(
          0,
          Math.sin(halfYaw),
          0,
          Math.cos(halfYaw)
        )
      }

      // First frame after spawn: enable and show now that orientation is set
      if (entry.needsInit) {
        entry.originNode.setEnabled(true)
        entry.needsInit = false
      }

      let shipVisible = true
      const player = state.players.get(ship.playerId)
      if (player?.regeneratedAt != null) {
        const elapsed = now - player.regeneratedAt
        if (elapsed < SHIP_REGENERATION_GRACE_PERIOD) {
          const maxDuration = SHIP_REGENERATION_GRACE_PERIOD / 5
          const blinkDuration = (elapsed % maxDuration) * 2
          shipVisible = blinkDuration < maxDuration
        }
      }
      entry.visualNode.isVisible = shipVisible

      if (entry.shipTailNode != null) {
        if (player?.thrustPressedAt != null && shipVisible) {
          const thrustElapsed = now - player.thrustPressedAt
          const blinkDuration = (thrustElapsed % TAIL_BLINK_DURATION) * 2
          entry.shipTailNode.isVisible = blinkDuration < TAIL_BLINK_DURATION
        } else {
          entry.shipTailNode.isVisible = false
        }
      }
    }

    for (const rock of state.rocks.values()) {
      const entry = registry.get(`rock:${rock.id}`)
      if (entry == null) continue
      const o = rock.orientation
      entry.originNode.rotationQuaternion?.copyFromFloats(
        o[0],
        o[1],
        o[2],
        o[3]
      )

      if (entry.needsInit) {
        entry.originNode.setEnabled(true)
        entry.visualNode.isVisible = true
        entry.needsInit = false
      }
    }

    for (const bullet of state.bullets.values()) {
      const entry = registry.get(`bullet:${bullet.id}`)
      if (entry == null) continue
      const o = bullet.orientation
      entry.originNode.rotationQuaternion?.copyFromFloats(
        o[0],
        o[1],
        o[2],
        o[3]
      )

      if (entry.needsInit) {
        entry.originNode.setEnabled(true)
        entry.visualNode.isVisible = true
        entry.needsInit = false
      }
    }
  })

  return null
}
