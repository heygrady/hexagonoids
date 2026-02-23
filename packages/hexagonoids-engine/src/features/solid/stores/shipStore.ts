import { type Accessor, createMemo } from 'solid-js'

import type { ShipState } from '../../engine/types.js'
import type { ReactiveEngine } from '../createReactiveEngine.js'

export function useShip(
  engine: ReactiveEngine,
  shipId: string
): Accessor<ShipState | undefined> {
  return createMemo(() => engine.state.ships.get(shipId))
}
