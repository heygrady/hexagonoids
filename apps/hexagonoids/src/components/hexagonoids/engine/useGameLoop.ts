import type { PlayerInputState } from '@heygrady/hexagonoids-engine'
import { MAX_DELTA } from '@heygrady/hexagonoids-engine'
import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import { onCleanup } from 'solid-js'

import { useScene } from '../../solid-babylon/hooks/useScene'

/**
 * Registers a single Babylon beforeRender callback that calls engine.tick()
 * with the real frame delta. This replaces all per-entity onBeforeRender
 * physics hooks — the engine's step() handles everything.
 *
 * Must be called inside a component that is within both SceneContext and
 * GameStateContext providers. Register before entity rendering components
 * so the tick runs first (Babylon fires callbacks in registration order).
 */
export function useGameLoop(inputs: PlayerInputState, playerId: string): void {
  const engine = useGameState()
  const scene = useScene()

  const observer = scene.onBeforeRenderObservable.add(() => {
    const dtMs = Math.min(scene.getEngine().getDeltaTime(), MAX_DELTA)
    engine.tick({ [playerId]: inputs }, dtMs)
  })

  onCleanup(() => {
    scene.onBeforeRenderObservable.remove(observer)
  })
}
