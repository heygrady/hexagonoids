import { type Accessor, createMemo } from 'solid-js'

import type { BulletState } from '../../engine/types.js'
import type { ReactiveEngine } from '../createReactiveEngine.js'

export function useBullet(
  engine: ReactiveEngine,
  bulletId: string
): Accessor<BulletState | undefined> {
  return createMemo(() => engine.state.bullets.get(bulletId))
}
