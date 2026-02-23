import type { Accessor } from 'solid-js'

import type { ReactiveEngine } from '../createReactiveEngine.js'

export function useShipIds(engine: ReactiveEngine): Accessor<string[]> {
  return engine.shipIds
}

export function useRockIds(engine: ReactiveEngine): Accessor<string[]> {
  return engine.rockIds
}

export function useBulletIds(engine: ReactiveEngine): Accessor<string[]> {
  return engine.bulletIds
}

export function usePlayerIds(engine: ReactiveEngine): Accessor<string[]> {
  return engine.playerIds
}
