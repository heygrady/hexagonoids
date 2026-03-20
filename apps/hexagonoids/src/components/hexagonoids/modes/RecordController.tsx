import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { MAX_DELTA } from '@heygrady/hexagonoids-engine'
import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import { createSignal, onCleanup } from 'solid-js'
import { useScene } from '../../solid-babylon/hooks/useScene'
import { DEFAULT_PLAYER_ID, RADIUS } from '../constants'
import { useInputs } from '../engine/useInputBridge'
import { getYawPitch } from '../ship/getYawPitch'
import { moveNodeTo } from '../ship/orientation'
import type { FrameRecord } from '../types'
import { packInputs } from '../types'
import { useAppMode } from './AppModeProvider'
import {
  BENCHMARK_SEEDS,
  RECORD_COUNTDOWN_ZERO_HOLD_MS,
  SESSION_DURATION,
} from './constants'
import { RecordOverlay } from './RecordOverlay'
import { trpc } from './trpc'

const ROUND_COUNTDOWN_MS = 3_000 + RECORD_COUNTDOWN_ZERO_HOLD_MS

/**
 * Record-mode controller. When active, hooks into the Babylon render loop,
 * captures per-tick inputs, and saves sessions to the server via tRPC.
 * Cycles through benchmark seeds, then returns to play mode.
 */
export function RecordController() {
  const engine = useGameState()
  const inputs = useInputs()
  const scene = useScene()
  const { setAppMode, playerId, setRecordCountdownMs, setRecordRoundIndex } =
    useAppMode()
  const PLAYER_ID = playerId() || DEFAULT_PLAYER_ID

  const [seedIndex, setSeedIndex] = createSignal(0)
  const [sessionStartTime, setSessionStartTime] = createSignal(0)
  const [countdownMs, _setCountdownMs] = createSignal(ROUND_COUNTDOWN_MS)
  let frames: FrameRecord[] = []

  function setCountdownMs(ms: number) {
    _setCountdownMs(ms)
    setRecordCountdownMs(ms)
  }

  function snapCameraToPlayer() {
    const player = engine.state.players.get(PLAYER_ID)
    if (player?.shipId == null) return

    const ship = engine.state.ships.get(player.shipId)
    if (ship == null) return

    const cameraOriginNode = scene.getTransformNodeByName('shipCameraOrigin')
    if (!(cameraOriginNode instanceof TransformNode)) return

    const pos = new Vector3(
      ship.position[0] * RADIUS,
      ship.position[1] * RADIUS,
      ship.position[2] * RADIUS
    )
    const [yaw, pitch] = getYawPitch(pos)
    moveNodeTo(cameraOriginNode, yaw, pitch)
  }

  function startSession(index: number) {
    setSeedIndex(index)
    setRecordRoundIndex(index)
    frames = []
    inputs.reset()

    // Reseed the engine with the current benchmark seed
    engine.reseed(BENCHMARK_SEEDS[index]!, PLAYER_ID)

    // Snap camera immediately so the player is visible before countdown starts.
    snapCameraToPlayer()

    // Round starts after countdown, so timer begins at that moment.
    setCountdownMs(ROUND_COUNTDOWN_MS)
    setSessionStartTime(engine.state.now)
  }

  function returnToTitleScreen() {
    inputs.reset()
    setCountdownMs(0)

    // Clear active entities/players so StartScreen becomes visible again.
    engine.mutate((state) => {
      state.ships.clear()
      state.rocks.clear()
      state.bullets.clear()
      state.players.clear()
      state.wave = 0
      state.endedAt = null
      state.startedAt = state.now
    })

    setAppMode('play')
  }

  // Start the first session
  startSession(0)

  // Hook into the render loop to capture inputs each tick
  const observer = scene.onBeforeRenderObservable.add(() => {
    const dtMs = Math.min(scene.getEngine().getDeltaTime(), MAX_DELTA)

    const remainingCountdown = countdownMs()
    if (remainingCountdown > 0) {
      const nextCountdown = Math.max(0, remainingCountdown - dtMs)
      setCountdownMs(nextCountdown)
      if (nextCountdown === 0) {
        // Begin round timing only after countdown fully completes.
        setSessionStartTime(engine.state.now)
      }
      return
    }

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
      startSession(nextIndex)
    } else {
      // All seeds done — return to title screen
      returnToTitleScreen()
    }
  }

  onCleanup(() => {
    setCountdownMs(0)
    scene.onBeforeRenderObservable.remove(observer)
  })

  return (
    <RecordOverlay
      seedIndex={seedIndex()}
      sessionStartTime={sessionStartTime()}
    />
  )
}
