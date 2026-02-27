import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import type { Component } from 'solid-js'
import { onCleanup } from 'solid-js'

import { onBeforeRender } from '../solid-babylon/hooks/onBeforeRender'
import { useScene } from '../solid-babylon/hooks/useScene'

import { CellManager } from './cell/CellManager'
import { entityToCell } from './cell/entityToCells'
import { useNodeRegistry } from './NodeRegistry'

export const Cells: Component = () => {
  const scene = useScene()
  const engine = useGameState()
  const registry = useNodeRegistry()

  const globe = scene.getMeshByName('globe')
  if (globe == null) {
    console.warn('Cells: globe mesh not found')
    return null
  }

  const manager = new CellManager(scene, globe, registry)
  let prevNow = 0

  // Per-frame: visit cells under all entities, then update fade
  onBeforeRender(() => {
    const state = engine.state
    const now = state.now

    // Engine reseed resets game time to 0. Reset active cells so stale
    // highlights from removed entities don't remain in an undefined state.
    if (now < prevNow) {
      manager.reset()
    }
    prevNow = now

    // Ships
    for (const ship of state.ships.values()) {
      if (!ship.alive) continue
      manager.visitCell(entityToCell(ship.lat, ship.lng), now)
    }

    // Rocks
    for (const rock of state.rocks.values()) {
      manager.visitCell(entityToCell(rock.lat, rock.lng), now)
    }

    // Bullets
    for (const bullet of state.bullets.values()) {
      manager.visitCell(entityToCell(bullet.lat, bullet.lng), now)
    }

    // Fade and cleanup
    manager.update(now)
  })

  onCleanup(() => {
    manager.dispose()
  })

  return null
}
