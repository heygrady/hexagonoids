import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Component } from 'solid-js'
import { createRenderEffect, For } from 'solid-js'

import { useSceneStore } from '../solid-babylon/hooks/useScene'

import { Cell } from './Cell'
import { subscribeCellPool } from './hooks/useCellPool'

export const Cells: Component = () => {
  const [$scene] = useSceneStore()

  const cells = subscribeCellPool()

  createRenderEffect(() => {
    const sceneState = $scene.get()
    if (sceneState.scene == null) {
      return
    }
    const originNode = new TransformNode('h3CellOrigin', sceneState.scene)
    // NOTE: Scaling is disabled by design. H3 geographic coordinates convert to absolute
    // world 3D vectors, so scaling would break the coordinate system conversion.
    // This is a known limitation of the H3 geospatial coordinate system.
    // originNode.scaling.setAll(0.5)
    const globe = sceneState.globe

    if (globe != null) {
      originNode.parent = globe
    }
  })

  return (
    <For each={Object.keys(cells())}>
      {(h) => {
        const $cell = cells()[h]
        if ($cell == null) {
          return
        }
        return <Cell h={h} store={$cell} />
      }}
    </For>
  )
}
