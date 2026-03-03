import type { AbstractEngineOptions } from '@babylonjs/core/Engines/abstractEngine'
import { Color4 } from '@babylonjs/core/Maths/math.color'
import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import type { SceneOptions } from '@babylonjs/core/scene'
import { vector3ToLatLng } from '@heygrady/h3-babylon'
import {
  type CollisionType,
  type EntityRef,
  evaluateWaveSpawnGate,
  nextWaveDelayMs,
  ROCK_LARGE_SIZE,
  ROCK_MEDIUM_SIZE,
  ROCK_WAVE_GRACE_PERIOD,
  spawnWave,
} from '@heygrady/hexagonoids-engine'
import { useGameState } from '@heygrady/hexagonoids-engine/solid'
import type { Component, JSX } from 'solid-js'
import { createSignal, Match, Show, Switch } from 'solid-js'
import { onBeforeRender } from '../solid-babylon/hooks/onBeforeRender'
import { useScene } from '../solid-babylon/hooks/useScene'
import { type ReadyCallback, SceneCanvas } from '../solid-babylon/SceneCanvas'
import { Bullets } from './Bullets'
import { spawnSparks } from './bullet/spawnSparks'
import { Cells } from './Cells'
import { Culling } from './Culling'
import { verifyShipRockCollision } from './collision/verifyShipRockCollision'
import {
  DEFAULT_PLAYER_ID,
  EXPLOSION_LARGE_LIFETIME,
  EXPLOSION_LARGE_SPEED,
  EXPLOSION_MEDIUM_LIFETIME,
  EXPLOSION_MEDIUM_SPEED,
  EXPLOSION_SMALL_LIFETIME,
  EXPLOSION_SMALL_SPEED,
} from './constants'
import { EndScreen } from './EndScreen'
import { EntityVisualSync } from './EntityVisualSync'
import { EngineProvider, useEngineHooks } from './engine/EngineProvider'
import { useGameLoop } from './engine/useGameLoop'
import {
  InputBridgeContext,
  useInputBridge,
  useInputs,
} from './engine/useInputBridge'
import { Globe } from './Globe'
import { Lights } from './Lights'
import { AppModeProvider, useAppMode } from './modes/AppModeProvider'
import { ObserveController } from './modes/ObserveController'
import { ObserveOverlay } from './modes/ObserveOverlay'
import { PlaybackController } from './modes/PlaybackController'
import { PlayerIdentity } from './modes/PlayerIdentity'
import { RecordController } from './modes/RecordController'
import { RecordCountdownScreen } from './modes/RecordCountdownScreen'
import { SpawnDebugController } from './modes/SpawnDebugController'
import { CameraLighting } from './NewLights'
import {
  type CullableEntry,
  NodeRegistryProvider,
  useNodeRegistry,
} from './NodeRegistry'
import { Rocks } from './Rocks'
import { Score } from './Score'
import { ShipCamera } from './ShipCamera'
import { Ships } from './Ships'
import { StartScreen } from './StartScreen'
import { spawnExplosion } from './ship/spawnExplosion'
import type { AppMode } from './types'
import { UI } from './UI'

const PLAYER_ID = DEFAULT_PLAYER_ID

export interface HexagonoidsCanvasProps
  extends JSX.CanvasHTMLAttributes<HTMLCanvasElement> {
  enableWebGPU?: boolean
  debug?: boolean
  initialAppMode?: AppMode
}

/**
 * Sets up the engine game loop and input bridge.
 * Must be rendered inside both EngineProvider and SceneContext.
 * Registered before entity components so the tick runs first.
 */
function EngineGameLoop() {
  const engine = useGameState()
  const scene = useScene()
  const hooks = useEngineHooks()
  const registry = useNodeRegistry()

  // --- Regeneration position hook ---
  // Spawn regenerated ship at the camera center so it's always visible.
  function getRegenerationPosition() {
    const cameraPosition = scene.getTransformNodeByName('shipCameraPosition')
    if (cameraPosition == null) return undefined
    cameraPosition.computeWorldMatrix(true)
    const pos = cameraPosition.getAbsolutePosition()
    if (pos.lengthSquared() === 0) return undefined
    const [lat, lng] = vector3ToLatLng(pos)
    return { lat, lng }
  }
  hooks.getRegenerationPosition = getRegenerationPosition

  let lastNarrowPhaseSyncNow = Number.NaN
  const narrowPhaseSyncedAt = new Map<string, number>()

  // --- Narrow-phase collision verification hook ---
  // Projects mesh outlines to lat/lng and checks for 2D polygon intersection
  // via martinez polygon clipping, which is reliable for flat polygons on a
  // curved sphere surface where Babylon's intersectsMesh is not.
  function verifyCollision(
    a: EntityRef,
    b: EntityRef,
    type: CollisionType
  ): boolean {
    if (type !== 'ship-rock') return true

    const shipEntry = registry.get(`ship:${a.id}`)
    const rockEntry = registry.get(`rock:${b.id}`)
    if (shipEntry == null || rockEntry == null) return true

    // Sync visual transforms lazily at most once per entity per game tick.
    // This keeps narrow-phase collision verification correct while avoiding
    // repeated world-matrix recomputation for the same entities.
    const ship = engine.state.ships.get(a.id)
    const rock = engine.state.rocks.get(b.id)
    if (ship == null || rock == null) return true

    const now = engine.state.now
    if (now !== lastNarrowPhaseSyncNow) {
      lastNarrowPhaseSyncNow = now
      narrowPhaseSyncedAt.clear()
    }

    const syncEntry = (
      key: string,
      entry: CullableEntry,
      orientation: { x: number; y: number; z: number; w: number }
    ) => {
      if (narrowPhaseSyncedAt.get(key) === now) return
      entry.originNode.rotationQuaternion?.copyFromFloats(
        orientation.x,
        orientation.y,
        orientation.z,
        orientation.w
      )
      entry.visualNode.computeWorldMatrix(true)
      narrowPhaseSyncedAt.set(key, now)
    }

    syncEntry(`ship:${a.id}`, shipEntry, ship.orientation)
    syncEntry(`rock:${b.id}`, rockEntry, rock.orientation)

    return verifyShipRockCollision(shipEntry, rockEntry)
  }
  hooks.verifyCollision = verifyCollision

  // --- Collision effects hook ---
  // Spawns visual-only explosion/spark effects; does not affect game state.
  function onCollision(a: EntityRef, b: EntityRef, type: CollisionType): void {
    const globe = scene.getMeshByName('globe')

    if (type === 'bullet-rock') {
      // Sparks at the rock position
      const rock = engine.state.rocks.get(b.id)
      if (rock == null) return

      const o = rock.orientation
      const orientation = new Quaternion(o.x, o.y, o.z, o.w)

      const speed =
        rock.size === ROCK_LARGE_SIZE
          ? EXPLOSION_LARGE_SPEED
          : rock.size === ROCK_MEDIUM_SIZE
            ? EXPLOSION_MEDIUM_SPEED
            : EXPLOSION_SMALL_SPEED
      const lifetime =
        rock.size === ROCK_LARGE_SIZE
          ? EXPLOSION_LARGE_LIFETIME
          : rock.size === ROCK_MEDIUM_SIZE
            ? EXPLOSION_MEDIUM_LIFETIME
            : EXPLOSION_SMALL_LIFETIME

      spawnSparks(scene, orientation, speed, lifetime, globe)
    } else if (type === 'ship-rock') {
      // Ship segments + sparks at the ship position
      const ship = engine.state.ships.get(a.id)
      if (ship == null) return

      const o = ship.orientation
      const orientation = new Quaternion(o.x, o.y, o.z, o.w)

      spawnExplosion(scene, orientation, ship.yaw, globe)
    }
  }
  hooks.onCollision = onCollision

  // Attract-mode: use the same engine wave policy as player mode.
  let attractNextWaveAt = ROCK_WAVE_GRACE_PERIOD
  onBeforeRender(() => {
    const state = engine.state
    // Only run attract-mode spawning when no players are in the game
    if (state.players.size > 0) return
    if (state.now < attractNextWaveAt) return

    const gate = evaluateWaveSpawnGate(
      state,
      { x: 1, y: 0, z: 0 },
      0,
      null,
      engine
    )
    if (!gate.canSpawn) {
      attractNextWaveAt = state.now + gate.deferMs
      return
    }

    engine.mutate((s) => {
      spawnWave(s, 0, 0, engine.rng)
    })
    attractNextWaveAt = state.now + nextWaveDelayMs(0)
  })

  return null
}

/**
 * Play-mode game loop. Registers the normal tick via useGameLoop.
 * Only rendered when appMode is 'play'.
 */
function PlayModeGameLoop() {
  const inputs = useInputs()
  useGameLoop(inputs, PLAYER_ID)
  return null
}

/**
 * Switches between game loop implementations based on the current app mode.
 * Play mode uses the normal game loop; record mode uses RecordController.
 */
function ModeGameLoop() {
  const { appMode } = useAppMode()

  return (
    <Switch>
      <Match when={appMode() === 'play'}>
        <PlayModeGameLoop />
      </Match>
      <Match when={appMode() === 'record'}>
        <RecordController />
      </Match>
      <Match when={appMode() === 'observe'}>
        <ObserveController />
      </Match>
      <Match when={appMode() === 'playback'}>
        <PlaybackController />
      </Match>
      <Match when={appMode() === 'spawn-debug'}>
        <SpawnDebugController />
      </Match>
    </Switch>
  )
}

function InputBridgeProvider(props: { children: JSX.Element }) {
  const inputs = useInputBridge()
  return (
    <InputBridgeContext.Provider value={inputs}>
      {props.children}
    </InputBridgeContext.Provider>
  )
}

export const HexagonoidsCanvas: Component<HexagonoidsCanvasProps> = (props) => {
  const antialias = true
  const adaptToDeviceRatio = true

  const engineOptions: AbstractEngineOptions = {}
  const sceneOptions: SceneOptions = {}

  // Wait for scene to be ready
  const [ready, setReady] = createSignal<boolean>(false)
  const onReady: ReadyCallback = (scene) => {
    console.log('game ready')
    scene.clearColor = Color4.FromInts(15, 23, 41, 0.4)
    scene.skipPointerMovePicking = true
    setReady(true)
  }

  return (
    <SceneCanvas
      antialias={antialias}
      engineOptions={engineOptions}
      adaptToDeviceRatio={adaptToDeviceRatio}
      sceneOptions={sceneOptions}
      onReady={onReady}
      enableWebGPU={props.enableWebGPU}
      {...props}
    >
      <EngineProvider>
        <AppModeProvider initialAppMode={props.initialAppMode}>
          <PlayerIdentity />
          <Show when={ready()}>
            <Globe>
              <InputBridgeProvider>
                <NodeRegistryProvider>
                  <EngineGameLoop />
                  <ModeGameLoop />
                  <Ships />
                  <Bullets />
                  <Rocks />
                  <EntityVisualSync />
                  <Cells />
                  <Lights />
                  <ShipCamera debug={props.debug}>
                    <CameraLighting>
                      <Culling />
                      <UI>
                        <RecordCountdownScreen />
                        <ObserveOverlay />
                        <Score />
                        <StartScreen />
                        <EndScreen />
                      </UI>
                    </CameraLighting>
                  </ShipCamera>
                </NodeRegistryProvider>
              </InputBridgeProvider>
            </Globe>
          </Show>
        </AppModeProvider>
      </EngineProvider>
    </SceneCanvas>
  )
}
