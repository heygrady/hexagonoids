import { createContext } from 'solid-js'

import type { SceneSetters } from '../hexagonoids/store/scene/SceneSetters'
import type { SceneStore } from '../hexagonoids/store/scene/SceneStore'

export type SceneContextValue = [$scene: SceneStore, actions: SceneSetters]

export const SceneContext = createContext<SceneContextValue>()
