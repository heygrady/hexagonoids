import type { Accessor } from 'solid-js'

import type { EntityType } from '../../engine/types.js'
import type { ReactiveEngine } from '../createReactiveEngine.js'

const poolAccessors: Record<
  EntityType,
  (engine: ReactiveEngine) => Accessor<string[]>
> = {
  ship: (engine) => engine.shipIds,
  rock: (engine) => engine.rockIds,
  bullet: (engine) => engine.bulletIds,
}

export function useEntityPool(
  engine: ReactiveEngine,
  entityType: EntityType
): Accessor<string[]> {
  return poolAccessors[entityType](engine)
}
