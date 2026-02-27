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
  observeTrainingGeneration: Accessor<number>
  setObserveTrainingGeneration: Setter<number>
  observeTrainingElapsedSeconds: Accessor<number>
  setObserveTrainingElapsedSeconds: Setter<number>
  observeRunningGeneration: Accessor<number | null>
  setObserveRunningGeneration: Setter<number | null>
  observeRunningFitness: Accessor<number | null>
  setObserveRunningFitness: Setter<number | null>
  observeSummary: Accessor<{
    generations: number
    bestGeneration: number
    bestFitness: number
  } | null>
  setObserveSummary: Setter<{
    generations: number
    bestGeneration: number
    bestFitness: number
  } | null>
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

export function AppModeProvider(props: {
  children: JSX.Element
  initialAppMode?: AppMode
}) {
  const [appMode, setAppMode] = createSignal<AppMode>(
    props.initialAppMode ?? 'play'
  )
  const [recordCountdownMs, setRecordCountdownMs] = createSignal(0)
  const [recordRoundIndex, setRecordRoundIndex] = createSignal(0)
  const [observeTrainingGeneration, setObserveTrainingGeneration] =
    createSignal(1)
  const [observeTrainingElapsedSeconds, setObserveTrainingElapsedSeconds] =
    createSignal(0)
  const [observeRunningGeneration, setObserveRunningGeneration] = createSignal<
    number | null
  >(null)
  const [observeRunningFitness, setObserveRunningFitness] = createSignal<
    number | null
  >(null)
  const [observeSummary, setObserveSummary] = createSignal<{
    generations: number
    bestGeneration: number
    bestFitness: number
  } | null>(null)

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
        observeTrainingGeneration,
        setObserveTrainingGeneration,
        observeTrainingElapsedSeconds,
        setObserveTrainingElapsedSeconds,
        observeRunningGeneration,
        setObserveRunningGeneration,
        observeRunningFitness,
        setObserveRunningFitness,
        observeSummary,
        setObserveSummary,
      }}
    >
      {props.children}
    </AppModeContext.Provider>
  )
}
