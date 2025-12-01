import { BoundingSphere } from '@babylonjs/core/Culling/boundingSphere'
import type { Component } from 'solid-js'
import { unwrap } from 'solid-js/store'

import { onBeforeRender } from '../solid-babylon/hooks/onBeforeRender'
import { useScene } from '../solid-babylon/hooks/useScene'

import { storeToCells } from './colission/storeToCells'
import { isRockState, isShipState } from './colission/typeCheck'
import { useCellPool } from './hooks/useCellPool'
import { useCamera } from './ShipCamera'
import type { BulletStore } from './store/bullet/BulletStore'
import type { RockStore } from './store/rock/RockStore'
import type { ShipStore } from './store/ship/ShipStore'
import { incrementFrameCount, timeFunction } from './utils/performanceMonitor'

type CollisionStore = RockStore | BulletStore | ShipStore

export interface CollisionProps {
  id?: string
  resolution: number
  store: CollisionStore
}

export const Collision: Component<CollisionProps> = (props) => {
  const $store = unwrap(props.store)
  const scene = useScene()
  const cameraContext = useCamera()

  const [, { visit }] = useCellPool()

  const visitCell = timeFunction(
    `Collision-${props.id ?? 'unknown'}`,
    () => {
      incrementFrameCount()

      const resolution = 1

      const state = $store.get()
      const originNode = state.originNode
      const meshNode = isRockState(state)
        ? state.rockNode
        : isShipState(state)
          ? state.shipNode
          : state.bulletNode
      if (originNode == null || meshNode == null) {
        return
      }

      const boundingSphere =
        cameraContext.boxNode.getBoundingInfo().boundingSphere
      const intersects = BoundingSphere.Intersects(
        boundingSphere,
        meshNode.getBoundingInfo().boundingSphere
      )
      if (!intersects) {
        return
      }

      // FIXME: cache these results for each item type based on the res 2 cell
      // find the cells this object intersects with
      const cells = storeToCells($store, resolution)

      if (cells.size > 0) {
        const now = Date.now()

        // Diagnostic: log if we're visiting an unusual number of cells
        if (cells.size > 20) {
          console.warn(
            `[Collision] ${props.id} visiting ${cells.size} cells (unusually high)`
          )
        }

        // Visit cells synchronously during render loop
        // Previously used requestIdleCallback, but this caused freezes when
        // idle callbacks accumulated and executed all at once (creating mesh bursts)
        for (const h of cells) {
          visit(h, scene, now)
        }
      }
    },
    16 // Warn if collision detection takes >16ms (one frame at 60fps)
  )
  onBeforeRender(visitCell)

  return null
}
