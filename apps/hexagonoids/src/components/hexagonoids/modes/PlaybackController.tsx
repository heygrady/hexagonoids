import { MAX_DELTA } from '@heygrady/hexagonoids-engine'
import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import { createSignal, onCleanup } from 'solid-js'
import { useScene } from '../../solid-babylon/hooks/useScene'
import { DEFAULT_PLAYER_ID } from '../constants'
import { useInputs } from '../engine/useInputBridge'
import { unpackInputs } from '../types'
import { useAppMode } from './AppModeProvider'
import { BENCHMARK_SEEDS } from './constants'
import { PlaybackOverlay } from './PlaybackOverlay'
import { trpc } from './trpc'

const PLAYER_ID = DEFAULT_PLAYER_ID

interface SessionFrame {
  dt: number
  i: number
}

/**
 * Playback-mode controller. When active, hooks into the Babylon render loop,
 * replays recorded sessions using accumulator-based timing, and advances
 * through benchmark seeds. Returns to play mode when all sessions are done.
 */
export function PlaybackController() {
  const engine = useGameState()
  const inputs = useInputs()
  const scene = useScene()
  const { setAppMode } = useAppMode()

  const [seedIndex, setSeedIndex] = createSignal(0)
  const [frameIndex, setFrameIndex] = createSignal(0)
  const [totalFrames, setTotalFrames] = createSignal(0)

  let frames: SessionFrame[] = []
  let currentFrameIndex = 0
  let accumulator = 0
  let loading = true
  let disposed = false
  let availableSeeds: string[] = []

  function exitPlayback() {
    inputs.reset()
    engine.reseed(`default-${Date.now()}`, PLAYER_ID)
    setAppMode('play')
  }

  // Handle Escape key to exit playback
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      exitPlayback()
    }
  }
  window.addEventListener('keydown', handleKeyDown)

  async function loadSession(index: number): Promise<boolean> {
    const seed = availableSeeds[index]
    if (seed == null) return false

    const session = await trpc.sessions.get.query({
      playerId: PLAYER_ID,
      seed,
    })
    if (disposed) return false
    if (session == null) return false

    frames = session.frames
    currentFrameIndex = 0
    accumulator = 0
    loading = false

    setSeedIndex(index)
    setFrameIndex(0)
    setTotalFrames(frames.length)

    // Reseed the engine to match the recorded session
    engine.reseed(seed, PLAYER_ID)

    return true
  }

  async function advanceToNextSession() {
    loading = true
    const nextIndex = seedIndex() + 1

    if (nextIndex >= availableSeeds.length) {
      // All sessions done
      console.log('[PLAYBACK] All sessions complete')
      exitPlayback()
      return
    }

    const loaded = await loadSession(nextIndex)
    if (disposed) return
    if (!loaded) {
      console.warn(
        `[PLAYBACK] Failed to load session ${nextIndex}, finishing playback`
      )
      exitPlayback()
    }
  }

  // Start by fetching available sessions and loading the first one
  async function initialize() {
    try {
      availableSeeds = await trpc.sessions.list.query({ playerId: PLAYER_ID })
      if (disposed) return

      // Filter to only seeds that match benchmark seeds
      availableSeeds = availableSeeds.filter((s) => BENCHMARK_SEEDS.includes(s))

      if (availableSeeds.length === 0) {
        console.warn(
          '[PLAYBACK] No recordings found. Record first with Shift+R.'
        )
        exitPlayback()
        return
      }

      const loaded = await loadSession(0)
      if (disposed) return
      if (!loaded) {
        console.warn('[PLAYBACK] Failed to load first session')
        exitPlayback()
      }
    } catch (err) {
      if (disposed) return
      console.error('[PLAYBACK] Failed to initialize:', err)
      exitPlayback()
    }
  }

  void initialize()

  // Hook into the render loop for accumulator-based replay
  const observer = scene.onBeforeRenderObservable.add(() => {
    if (loading) return

    const actualDt = Math.min(scene.getEngine().getDeltaTime(), MAX_DELTA)
    accumulator += actualDt

    while (currentFrameIndex < frames.length) {
      const frame = frames[currentFrameIndex]
      if (frame == null || accumulator < frame.dt) break

      accumulator -= frame.dt
      const playerInputs = unpackInputs(frame.i)
      engine.tick({ [PLAYER_ID]: playerInputs }, frame.dt)
      currentFrameIndex++
      setFrameIndex(currentFrameIndex)
    }

    if (currentFrameIndex >= frames.length) {
      // Session complete — advance to next
      const player = engine.state.players.get(PLAYER_ID)
      const score = player?.score ?? 0
      const currentIndex = seedIndex()
      console.log(
        `[PLAYBACK] Seed ${currentIndex + 1}/${availableSeeds.length} ` +
          `(${availableSeeds[currentIndex]}) complete: ` +
          `score=${score} frames=${frames.length}`
      )
      void advanceToNextSession()
    }
  })

  onCleanup(() => {
    disposed = true
    scene.onBeforeRenderObservable.remove(observer)
    window.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <PlaybackOverlay
      seedIndex={seedIndex()}
      seedName={availableSeeds[seedIndex()] ?? 'unknown'}
      totalSeeds={availableSeeds.length}
      frameIndex={frameIndex()}
      totalFrames={totalFrames()}
    />
  )
}
