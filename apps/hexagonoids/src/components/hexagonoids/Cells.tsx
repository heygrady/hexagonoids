import { TransformNode } from '@babylonjs/core'
import type { Component } from 'solid-js'
import { createRenderEffect, For } from 'solid-js'

import { useSceneStore } from '../solid-babylon/hooks/useScene'

import { Cell } from './Cell'
import { subscribeCellPool } from './hooks/useCellPool'

export const Cells: Component = () => {
  const [$scene] = useSceneStore()

  const cells = subscribeCellPool()

  createRenderEffect(() => {
    const scene = $scene.get().scene
    if (scene == null) {
      return
    }
    const originNode = new TransformNode('h3CellOrigin', scene)
    // FIXME: enable scaling here (scaling conflicts with the h3 cell to vector3 conversion)
    // originNode.scaling.setAll(0.5)
    const globe = scene.getMeshByName('globe')

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
