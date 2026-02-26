import {
  type Accessor,
  createContext,
  createSignal,
  type JSX,
  type Setter,
  useContext,
} from 'solid-js'

import type { AppMode } from '../types'

interface AppModeContextValue {
  appMode: Accessor<AppMode>
  setAppMode: Setter<AppMode>
}

const AppModeContext = createContext<AppModeContextValue>()

export function useAppMode(): AppModeContextValue {
  const ctx = useContext(AppModeContext)
  if (ctx == null) {
    throw new Error('useAppMode: must be inside AppModeProvider')
  }
  return ctx
}

export function AppModeProvider(props: { children: JSX.Element }) {
  const [appMode, setAppMode] = createSignal<AppMode>('play')

  return (
    <AppModeContext.Provider value={{ appMode, setAppMode }}>
      {props.children}
    </AppModeContext.Provider>
  )
}
