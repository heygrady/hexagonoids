import type { CellStore } from './CellStore'

export const setVisitedAt = ($cell: CellStore, now?: number) => {
  $cell.setKey('visitedAt', now ?? Date.now())
}

export const setImpactedAt = ($cell: CellStore, now?: number) => {
  $cell.setKey('impactedAt', now ?? Date.now())
}
