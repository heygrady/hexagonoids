import type { Component } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'

import type { BulletNodes } from './engine/nodeTypes'
import { useNodeRegistry } from './NodeRegistry'
import type { ObjectPool } from './pool/ObjectPool'

export interface BulletProps {
  bulletId: string
  pool: ObjectPool<BulletNodes>
}

export const Bullet: Component<BulletProps> = (props) => {
  const registry = useNodeRegistry()

  let nodes: BulletNodes

  onMount(() => {
    nodes = props.pool.acquire()

    registry.register(`bullet:${props.bulletId}`, {
      originNode: nodes.originNode,
      visualNode: nodes.bulletNode,
      needsInit: true,
    })
  })

  onCleanup(() => {
    registry.unregister(`bullet:${props.bulletId}`)
    if (nodes != null) {
      props.pool.release(nodes)
    }
  })

  return null
}
