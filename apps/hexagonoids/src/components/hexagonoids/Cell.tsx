import { easeCubicIn } from 'd3-ease'
import { cancelIdleCallback } from 'idle-callback'
import type { Component, JSX } from 'solid-js'
import { unwrap } from 'solid-js/store'

import { onBeforeRender } from '../solid-babylon/hooks/onBeforeRender'

import {
  CELL_IMPACTED_DURATION,
  CELL_IMPACTED_OPACITY,
  CELL_VISITED_DURATION,
  CELL_VISITED_OPACITY,
} from './constants'
import { useCellPool } from './hooks/useCellPool'
import type { CellStore } from './store/cell/CellStore'
import { deferIdleCallback, removeCell } from './store/cellPool/CellPoolSetters'

export interface CellProps {
  children?: JSX.Element
  h: string
  store: CellStore
}

const deferredCellRemoves = new Map<string, number>()

export const Cell: Component<CellProps> = (props) => {
  const $cell = unwrap(props.store)
  const [$cells] = useCellPool()

  const fadeOutCell = () => {
    // fade out slowly
    const { visitedAt, impactedAt } = $cell.get()

    const now = Date.now()

    const impactedDuration = now - (impactedAt ?? 0)
    const visitedDuration = now - (visitedAt ?? 0)

    const isImpacted =
      impactedAt != null && impactedDuration < CELL_IMPACTED_DURATION

    const isVisited =
      visitedAt != null && visitedDuration < CELL_VISITED_DURATION

    let opacity = 0

    if (isVisited) {
      const duration = now - (visitedAt ?? 0)

      const t = easeCubicIn(duration / CELL_VISITED_DURATION)
      opacity = opacity + (1 - t) * CELL_VISITED_OPACITY
    }

    if (isImpacted) {
      const duration = now - (impactedAt ?? 0)

      const t = easeCubicIn(duration / CELL_IMPACTED_DURATION)
      opacity = opacity + (1 - t) * CELL_IMPACTED_OPACITY
      // FIXME: turn this cell red and then fade it out
    }

    const cellNode = $cell.get().cellNode
    if (cellNode?.material != null) {
      cellNode.material.alpha = opacity
    }
    if (opacity <= 0 && !deferredCellRemoves.has(props.h)) {
      $cell.setKey('visitedAt', null)
      const deferRemoveCell = () => {
        deferredCellRemoves.delete(props.h)
        removeCell($cells, $cell)
      }
      const callbackId = deferIdleCallback(deferRemoveCell)
      deferredCellRemoves.set(props.h, callbackId)
    } else if (deferredCellRemoves.has(props.h)) {
      const callbackId = deferredCellRemoves.get(props.h)
      deferredCellRemoves.delete(props.h)
      if (callbackId != null) {
        cancelIdleCallback(callbackId)
      }
    }
  }
  onBeforeRender(fadeOutCell)

  return <>{props.children}</>
}
