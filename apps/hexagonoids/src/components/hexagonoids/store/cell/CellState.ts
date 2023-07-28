import type { AbstractMesh, TransformNode } from '@babylonjs/core'

export interface CellState {
  h: string

  visitedAt: number | null
  impactedAt: number | null

  originNode: TransformNode | null
  positionNode: TransformNode | null
  cellNode: AbstractMesh | null
}

export const defaultCellState: CellState = {
  h: '822d57fffffffff', // why?
  visitedAt: null,
  impactedAt: null,
  originNode: null,
  positionNode: null,
  cellNode: null,
}
