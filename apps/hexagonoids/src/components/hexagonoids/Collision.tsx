import { Vector3, type TransformNode, BoundingSphere } from '@babylonjs/core'
import { cancelIdleCallback } from 'idle-callback'
import QuickLRU from 'quick-lru'
import type { Component } from 'solid-js'
import { unwrap } from 'solid-js/store'

import { onBeforeRender } from '../solid-babylon/hooks/onBeforeRender'
import { useScene } from '../solid-babylon/hooks/useScene'

import { storeToCells } from './colission/storeToCells'
import { isRockState, isShipState } from './colission/typeCheck'
import { useCellPool } from './hooks/useCellPool'
import { useCamera } from './ShipCamera'
import type { BulletStore } from './store/bullet/BulletStore'
import { deferIdleCallback } from './store/cellPool/CellPoolSetters'
import type { RockStore } from './store/rock/RockStore'
import type { ShipStore } from './store/ship/ShipStore'

type CollisionStore = RockStore | BulletStore | ShipStore

export interface CollisionProps {
  id?: string
  resolution: number
  store: CollisionStore
}

const hexagonCache = new QuickLRU<number, Vector3[]>({ maxSize: 3 })

// FIXME: move this elsewhere
export const createHexagon = (radius: number): Vector3[] => {
  let vertices = hexagonCache.get(radius)
  if (vertices != null) {
    return vertices
  }
  vertices = []

  for (let i = 0; i < 6; i++) {
    const angle = i * (Math.PI / 3)
    const x = radius * Math.cos(angle)
    const z = radius * Math.sin(angle)
    vertices.push(new Vector3(x, 0, z))
  }
  hexagonCache.set(radius, vertices)
  return vertices
}

export const localToWorld = (
  localVector: Vector3,
  node: TransformNode
): Vector3 => {
  const worldMatrix = node.computeWorldMatrix(true)
  const worldVector = Vector3.TransformCoordinates(localVector, worldMatrix)
  return worldVector
}

const deferredVisits = new Map<string, number>()

export const Collision: Component<CollisionProps> = (props) => {
  const $store = unwrap(props.store)
  const scene = useScene()
  const cameraContext = useCamera()

  const [, { visit }] = useCellPool()

  const visitCell = () => {
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

      // visit each cell in the polygon
      for (const h of cells) {
        if (deferredVisits.has(h)) {
          // cancel previously deferred visits
          const callbackId = deferredVisits.get(h)
          if (callbackId != null) {
            cancelIdleCallback(callbackId)
          }
        }

        const deferVisitCell = () => {
          visit(h, scene, now)
          deferredVisits.delete(h)
        }

        // defer to visit in the background
        const callbackId = deferIdleCallback(deferVisitCell)
        deferredVisits.set(h, callbackId)
      }
    }
  }
  onBeforeRender(visitCell)

  return null
}
