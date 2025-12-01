import type { Component } from 'solid-js'

import { onBeforeRender } from '../solid-babylon/hooks/onBeforeRender'

import { useGame } from './hooks/useGame'
import { useCamera } from './ShipCamera'

export const Culling: Component = (_props) => {
  const cameraContext = useCamera()
  const [$game] = useGame()

  onBeforeRender(() => {
    const { $rocks, $ships, $cells } = $game.get()

    const boundingBox = cameraContext.boxNode.getBoundingInfo().boundingBox

    // rocks
    for (const $rock of Object.values($rocks.get())) {
      if ($rock == null) {
        continue
      }
      const { originNode, rockNode } = $rock.get()
      if (originNode == null || rockNode == null) {
        continue
      }
      const intersects = boundingBox.intersectsPoint(rockNode.absolutePosition)
      if (intersects && !originNode.isEnabled()) {
        rockNode.isVisible = true
        originNode.setEnabled(true)
      } else if (!intersects && originNode.isEnabled()) {
        rockNode.isVisible = false
        originNode.setEnabled(false)
      }
    }

    // ships
    for (const $ship of Object.values($ships.get())) {
      if ($ship == null) {
        continue
      }
      const { originNode, shipNode } = $ship.get()
      if (originNode == null || shipNode == null) {
        continue
      }
      const intersects = boundingBox.intersectsPoint(shipNode.absolutePosition)
      if (intersects && !originNode.isEnabled()) {
        shipNode.isVisible = true
        originNode.setEnabled(true)
      } else if (!intersects && shipNode.isEnabled()) {
        shipNode.isVisible = false
        originNode.setEnabled(false)
      }
    }

    // cells
    for (const $cell of Object.values($cells.get())) {
      if ($cell == null) {
        continue
      }
      const { originNode, cellNode } = $cell.get()
      if (originNode == null || cellNode == null) {
        continue
      }
      const intersects = boundingBox.intersectsPoint(cellNode.absolutePosition)
      if (intersects && !cellNode.isEnabled()) {
        cellNode.isVisible = true
        originNode.setEnabled(true)
      } else if (!intersects && cellNode.isEnabled()) {
        cellNode.isVisible = false
        originNode.setEnabled(false)
      }
    }
  })

  // onCleanup(() => {
  //   Object.values(spotlightContext).forEach((n) => {
  //     n.dispose()
  //   })
  // })
  return null
}
