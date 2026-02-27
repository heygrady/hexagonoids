import {
  type Accessor,
  createContext,
  createSignal,
  type JSX,
  type Setter,
  useContext,
} from 'solid-js'

import type { AppMode } from '../types'

const PLAYER_ID_KEY = 'hexagonoids-playerId'

interface AppModeContextValue {
  appMode: Accessor<AppMode>
  setAppMode: Setter<AppMode>
  playerId: Accessor<string>
  setPlayerId: (id: string) => void
  recordCountdownMs: Accessor<number>
  setRecordCountdownMs: Setter<number>
  recordRoundIndex: Accessor<number>
  setRecordRoundIndex: Setter<number>
}

const AppModeContext = createContext<AppModeContextValue>()

export function useAppMode(): AppModeContextValue {
  const ctx = useContext(AppModeContext)
  if (ctx == null) {
    throw new Error('useAppMode: must be inside AppModeProvider')
  }
  return ctx
}

/** Slugify a name: lowercase, trim, replace non-alphanumeric runs with hyphens. */
function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function AppModeProvider(props: { children: JSX.Element }) {
  const [appMode, setAppMode] = createSignal<AppMode>('play')
  const [recordCountdownMs, setRecordCountdownMs] = createSignal(0)
  const [recordRoundIndex, setRecordRoundIndex] = createSignal(0)

  const stored =
    typeof window !== 'undefined'
      ? (localStorage.getItem(PLAYER_ID_KEY) ?? '')
      : ''
  const [playerId, _setPlayerId] = createSignal(stored)

  function setPlayerId(id: string) {
    const slug = slugify(id)
    if (slug.length === 0) return
    localStorage.setItem(PLAYER_ID_KEY, slug)
    _setPlayerId(slug)
  }

  return (
    <AppModeContext.Provider
      value={{
        appMode,
        setAppMode,
        playerId,
        setPlayerId,
        recordCountdownMs,
        setRecordCountdownMs,
        recordRoundIndex,
        setRecordRoundIndex,
      }}
    >
      {props.children}
    </AppModeContext.Provider>
  )
}
