import type { AbstractEngineOptions } from '@babylonjs/core/Engines/abstractEngine'
import { Color4 } from '@babylonjs/core/Maths/math.color'
import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import type { SceneOptions } from '@babylonjs/core/scene'
import { vector3ToLatLng } from '@heygrady/h3-babylon'
import {
  type CollisionType,
  type EntityRef,
  hasNearbyRocks,
  MAX_ROCKS,
  ROCK_ENCOUNTER_COOLDOWN,
  ROCK_LARGE_SIZE,
  ROCK_MEDIUM_SIZE,
  ROCK_WAVE_GRACE_PERIOD,
  ROCK_WAVE_PERIOD,
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
import { RecordController } from './modes/RecordController'
import { CameraLighting } from './NewLights'
import { NodeRegistryProvider, useNodeRegistry } from './NodeRegistry'
import { Rocks } from './Rocks'
import { Score } from './Score'
import { ShipCamera } from './ShipCamera'
import { Ships } from './Ships'
import { StartScreen } from './StartScreen'
import { spawnExplosion } from './ship/spawnExplosion'
import { UI } from './UI'

const PLAYER_ID = DEFAULT_PLAYER_ID

export interface HexagonoidsCanvasProps
  extends JSX.CanvasHTMLAttributes<HTMLCanvasElement> {
  enableWebGPU?: boolean
  debug?: boolean
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

    // Sync visual node transforms to current engine state (visual updates
    // haven't run yet this frame since EngineGameLoop ticks first)
    const ship = engine.state.ships.get(a.id)
    const rock = engine.state.rocks.get(b.id)
    if (ship == null || rock == null) return true

    const so = ship.orientation
    shipEntry.originNode.rotationQuaternion!.copyFromFloats(
      so.x,
      so.y,
      so.z,
      so.w
    )
    const ro = rock.orientation
    rockEntry.originNode.rotationQuaternion!.copyFromFloats(
      ro.x,
      ro.y,
      ro.z,
      ro.w
    )

    // Force world matrix recomputation through the node hierarchy
    shipEntry.visualNode.computeWorldMatrix(true)
    rockEntry.visualNode.computeWorldMatrix(true)

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

  // Attract-mode: spawn waves at the normal cadence while no player exists.
  // Mirrors checkWaveSpawn logic: grace period, wave period, encounter cooldown.
  let attractWaveAt = -ROCK_WAVE_PERIOD + ROCK_WAVE_GRACE_PERIOD
  onBeforeRender(() => {
    const state = engine.state
    // Only run attract-mode spawning when no players are in the game
    if (state.players.size > 0) return
    if (state.rocks.size >= MAX_ROCKS) return
    if (state.now - attractWaveAt < ROCK_WAVE_PERIOD) return

    // Don't spawn if rocks are nearby — delay by encounter cooldown
    if (hasNearbyRocks(state, 0, 0)) {
      attractWaveAt = state.now - ROCK_WAVE_PERIOD + ROCK_ENCOUNTER_COOLDOWN
      return
    }

    engine.mutate((s) => {
      spawnWave(s, 0, 0, engine.rng, { minDistance: 10, maxDistance: 30 })
    })
    attractWaveAt = state.now
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
        <AppModeProvider>
          <Show when={ready()}>
            <Globe>
              <InputBridgeProvider>
                <NodeRegistryProvider>
                  <EngineGameLoop />
                  <ModeGameLoop />
                  <Ships />
                  <Bullets />
                  <Rocks />
                  <Lights />
                  <ShipCamera debug={props.debug}>
                    <CameraLighting>
                      <Culling />
                      <UI>
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
