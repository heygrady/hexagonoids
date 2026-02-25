import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import type { Component } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'

import { useScene } from '../solid-babylon/hooks/useScene'

import {
  ROCK_LARGE_SCALE,
  ROCK_LARGE_SIZE,
  ROCK_MEDIUM_SCALE,
  ROCK_MEDIUM_SIZE,
  ROCK_SMALL_SCALE,
} from './constants'
import type { RockNodes } from './engine/nodeTypes'
import type { ObjectPool } from './pool/ObjectPool'

export interface RockProps {
  rockId: string
  pool: ObjectPool<RockNodes>
}

export const Rock: Component<RockProps> = (props) => {
  const engine = useGameState()
  const scene = useScene()

  let nodes: RockNodes
  let observer: ReturnType<typeof scene.onBeforeRenderObservable.add>

  onMount(() => {
    nodes = props.pool.acquire()

    // Set scale based on engine rock size
    const rock = engine.state.rocks.get(props.rockId)
    if (rock != null) {
      const scale =
        rock.size === ROCK_LARGE_SIZE
          ? ROCK_LARGE_SCALE
          : rock.size === ROCK_MEDIUM_SIZE
            ? ROCK_MEDIUM_SCALE
            : ROCK_SMALL_SCALE
      nodes.rockNode.scaling.setAll(scale)
    }

    nodes.rockNode.isVisible = true
    nodes.originNode.setEnabled(true)

    observer = scene.onBeforeRenderObservable.add(() => {
      const rock = engine.state.rocks.get(props.rockId)
      if (rock == null) return

      // Position on sphere (use copyFromFloats to avoid cross-package Quaternion type mismatch)
      const o = rock.orientation
      nodes.originNode.rotationQuaternion!.copyFromFloats(o.x, o.y, o.z, o.w)
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
