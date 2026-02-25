import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import type { Component } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'

import { useScene } from '../solid-babylon/hooks/useScene'

import type { BulletNodes } from './engine/nodeTypes'
import type { ObjectPool } from './pool/ObjectPool'

export interface BulletProps {
  bulletId: string
  pool: ObjectPool<BulletNodes>
}

export const Bullet: Component<BulletProps> = (props) => {
  const engine = useGameState()
  const scene = useScene()

  let nodes: BulletNodes
  let observer: ReturnType<typeof scene.onBeforeRenderObservable.add>

  onMount(() => {
    nodes = props.pool.acquire()
    nodes.bulletNode.isVisible = true
    nodes.originNode.setEnabled(true)

    observer = scene.onBeforeRenderObservable.add(() => {
      const bullet = engine.state.bullets.get(props.bulletId)
      if (bullet == null) return

      // Position on sphere (use copyFromFloats to avoid cross-package Quaternion type mismatch)
      const o = bullet.orientation
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
