import { MAX_DELTA } from '@heygrady/hexagonoids-engine'
import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import { createSignal, onCleanup } from 'solid-js'
import { useScene } from '../../solid-babylon/hooks/useScene'
import { DEFAULT_PLAYER_ID } from '../constants'
import { useInputs } from '../engine/useInputBridge'
import type { FrameRecord } from '../types'
import { packInputs } from '../types'
import { useAppMode } from './AppModeProvider'
import { BENCHMARK_SEEDS, SESSION_DURATION } from './constants'
import { RecordOverlay } from './RecordOverlay'
import { trpc } from './trpc'

/**
 * Record-mode controller. When active, hooks into the Babylon render loop,
 * captures per-tick inputs, and saves sessions to the server via tRPC.
 * Cycles through benchmark seeds, then returns to play mode.
 */
export function RecordController() {
  const engine = useGameState()
  const inputs = useInputs()
  const scene = useScene()
  const { setAppMode, playerId } = useAppMode()
  const PLAYER_ID = playerId() || DEFAULT_PLAYER_ID

  const [seedIndex, setSeedIndex] = createSignal(0)
  const [sessionStartTime, setSessionStartTime] = createSignal(0)
  let frames: FrameRecord[] = []

  function startSession(index: number) {
    setSeedIndex(index)
    frames = []

    // Reseed the engine with the current benchmark seed
    engine.reseed(BENCHMARK_SEEDS[index]!, PLAYER_ID)
    setSessionStartTime(engine.state.now)
  }

  // Start the first session
  startSession(0)

  // Hook into the render loop to capture inputs each tick
  const observer = scene.onBeforeRenderObservable.add(() => {
    const dtMs = Math.min(scene.getEngine().getDeltaTime(), MAX_DELTA)

    // Tick the engine with current inputs
    engine.tick({ [PLAYER_ID]: inputs }, dtMs)

    // Capture the frame
    const elapsed = engine.state.now - sessionStartTime()
    frames.push({
      t: elapsed,
      dt: dtMs,
      i: packInputs(inputs),
    })

    // Check if session is complete (duration exceeded or game ended)
    const gameEnded = engine.state.endedAt != null
    if (elapsed >= SESSION_DURATION || gameEnded) {
      finishSession(gameEnded)
    }
  })

  function finishSession(gameEnded: boolean) {
    const player = engine.state.players.get(PLAYER_ID)
    const score = player?.score ?? 0
    const wave = engine.state.wave
    const survived = !gameEnded
    const duration = engine.state.now - sessionStartTime()
    const currentSeedIndex = seedIndex()

    // Fire-and-forget save to server
    trpc.sessions.save
      .mutate({
        playerId: PLAYER_ID,
        seed: BENCHMARK_SEEDS[currentSeedIndex]!,
        duration,
        frames: frames.map((f) => ({ dt: f.dt, i: f.i })),
        score,
        wave,
      })
      .catch((err: unknown) => {
        console.error('Failed to save session:', err)
      })

    // Log for developer feedback
    console.log(
      `[REC] Seed ${currentSeedIndex + 1}/${BENCHMARK_SEEDS.length} ` +
        `(${BENCHMARK_SEEDS[currentSeedIndex]}) complete: ` +
        `score=${score} wave=${wave} survived=${survived} ` +
        `frames=${frames.length} duration=${Math.round(duration)}ms`
    )

    // Advance to next seed or finish recording
    const nextIndex = currentSeedIndex + 1
    if (nextIndex < BENCHMARK_SEEDS.length) {
      inputs.reset()
      startSession(nextIndex)
    } else {
      // All seeds done — return to play mode
      inputs.reset()
      engine.reseed(`default-${Date.now()}`, PLAYER_ID)
      setAppMode('play')
    }
  }

  onCleanup(() => {
    scene.onBeforeRenderObservable.remove(observer)
  })

  return (
    <RecordOverlay
      seedIndex={seedIndex()}
      sessionStartTime={sessionStartTime()}
    />
  )
}
