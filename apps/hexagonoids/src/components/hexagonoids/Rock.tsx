import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import type { Component } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'

import {
  ROCK_LARGE_SCALE,
  ROCK_LARGE_SIZE,
  ROCK_MEDIUM_SCALE,
  ROCK_MEDIUM_SIZE,
  ROCK_SMALL_SCALE,
} from './constants'
import type { RockNodes } from './engine/nodeTypes'
import { useNodeRegistry } from './NodeRegistry'
import type { ObjectPool } from './pool/ObjectPool'

export interface RockProps {
  rockId: string
  pool: ObjectPool<RockNodes>
}

export const Rock: Component<RockProps> = (props) => {
  const engine = useGameState()
  const registry = useNodeRegistry()

  let nodes: RockNodes

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

    registry.register(`rock:${props.rockId}`, {
      originNode: nodes.originNode,
      visualNode: nodes.rockNode,
      needsInit: true,
    })
  })

  onCleanup(() => {
    registry.unregister(`rock:${props.rockId}`)
    if (nodes != null) {
      props.pool.release(nodes)
    }
  })

  return null
}
