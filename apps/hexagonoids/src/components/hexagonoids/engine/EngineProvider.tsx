import {
  createReactiveEngine,
  GameStateContext,
} from '@heygrady/hexagonoids-engine/solid'
import type { JSX } from 'solid-js'

export interface EngineProviderProps {
  children: JSX.Element
}

export function EngineProvider(props: EngineProviderProps) {
  const engine = createReactiveEngine({ mode: 'single' })

  return (
    <GameStateContext.Provider value={engine}>
      {props.children}
    </GameStateContext.Provider>
  )
}
