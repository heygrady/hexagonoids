import type { Component } from 'solid-js'

import { onBeforeRender } from '../solid-babylon/hooks/onBeforeRender'

import { useNodeRegistry } from './NodeRegistry'
import { useCamera } from './ShipCamera'

/**
 * Frustum culling for entity nodes.
 *
 * Iterates all registered nodes each frame and toggles visibility
 * based on whether they intersect the camera's bounding box.
 */
export const Culling: Component = () => {
  const cameraContext = useCamera()
  const registry = useNodeRegistry()

  onBeforeRender(() => {
    const boundingBox = cameraContext.boxNode.getBoundingInfo().boundingBox

    for (const { originNode, visualNode } of registry.values()) {
      const intersects = boundingBox.intersectsPoint(
        visualNode.absolutePosition
      )
      if (intersects && !originNode.isEnabled()) {
        visualNode.isVisible = true
        originNode.setEnabled(true)
      } else if (!intersects && originNode.isEnabled()) {
        visualNode.isVisible = false
        originNode.setEnabled(false)
      }
    }
  })

  return null
}
