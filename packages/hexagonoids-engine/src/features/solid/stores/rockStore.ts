import { type Accessor, createMemo } from 'solid-js'

import type { RockState } from '../../engine/types.js'
import type { ReactiveEngine } from '../createReactiveEngine.js'

export function useRock(
  engine: ReactiveEngine,
  rockId: string
): Accessor<RockState | undefined> {
  return createMemo(() => engine.state.rocks.get(rockId))
}
