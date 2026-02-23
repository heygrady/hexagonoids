import { type Accessor, createMemo } from 'solid-js'

import type { ReactiveEngine } from '../createReactiveEngine.js'

export function useGameTime(engine: ReactiveEngine): Accessor<number> {
  return createMemo(() => engine.state.now)
}

export function useWave(engine: ReactiveEngine): Accessor<number> {
  return createMemo(() => engine.state.wave)
}

export function useGameOver(engine: ReactiveEngine): Accessor<boolean> {
  return createMemo(() => engine.state.endedAt != null)
}
