import type { Component } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'

import type { ShipNodes } from './engine/nodeTypes'
import { useNodeRegistry } from './NodeRegistry'
import type { ObjectPool } from './pool/ObjectPool'

export interface ShipProps {
  shipId: string
  pool: ObjectPool<ShipNodes>
}

export const Ship: Component<ShipProps> = (props) => {
  const registry = useNodeRegistry()

  let nodes: ShipNodes

  onMount(() => {
    nodes = props.pool.acquire()
    nodes.shipNode.isVisible = true
    nodes.originNode.setEnabled(true)

    registry.register(`ship:${props.shipId}`, {
      originNode: nodes.originNode,
      visualNode: nodes.shipNode,
      positionNode: nodes.positionNode,
      orientationNode: nodes.orientationNode,
      shipTailNode: nodes.shipTailNode,
    })
  })

  onCleanup(() => {
    registry.unregister(`ship:${props.shipId}`)
    if (nodes != null) {
      props.pool.release(nodes)
    }
  })

  return null
}
