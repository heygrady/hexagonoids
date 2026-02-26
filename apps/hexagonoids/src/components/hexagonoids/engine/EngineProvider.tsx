import type { EngineHooks } from '@heygrady/hexagonoids-engine'
import {
  createReactiveEngine,
  GameStateContext,
} from '@heygrady/hexagonoids-engine/solid'
import { createContext, type JSX, useContext } from 'solid-js'

const EngineHooksContext = createContext<EngineHooks>()

/** Access the mutable engine hooks object to set late-bound callbacks. */
export const useEngineHooks = (): EngineHooks => {
  const ctx = useContext(EngineHooksContext)
  if (ctx == null) {
    throw new Error('useEngineHooks: must be inside EngineProvider')
  }
  return ctx
}

export interface EngineProviderProps {
  children: JSX.Element
}

export function EngineProvider(props: EngineProviderProps) {
  const hooks: EngineHooks = {}
  const engine = createReactiveEngine({ mode: 'single' }, hooks)

  return (
    <EngineHooksContext.Provider value={hooks}>
      <GameStateContext.Provider value={engine}>
        {props.children}
      </GameStateContext.Provider>
    </EngineHooksContext.Provider>
  )
}
