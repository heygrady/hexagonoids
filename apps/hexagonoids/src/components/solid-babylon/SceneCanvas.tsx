// Based on https://doc.babylonjs.com/communityExtensions/Babylon.js+ExternalLibraries/BabylonJS_and_ReactJS
import {
  Engine,
  type EngineOptions,
  Scene,
  type SceneOptions,
} from '@babylonjs/core'
import { createVisibilityObserver } from '@solid-primitives/intersection-observer'
import {
  type Component,
  createSignal,
  type JSX,
  onCleanup,
  onMount,
} from 'solid-js'

import { bindSceneSetters } from '../hexagonoids/store/scene/SceneSetters'
import { createSceneStore } from '../hexagonoids/store/scene/SceneStore'

import { SceneContext, type SceneContextValue } from './SceneContext'

export type ReadyCallback = (scene: Scene) => void
export type VisibilityChangeCallback = (scene: Scene, visible: boolean) => void

export interface SceneCanvasProps
  extends JSX.CanvasHTMLAttributes<HTMLCanvasElement> {
  antialias?: boolean
  engineOptions?: EngineOptions
  adaptToDeviceRatio?: boolean
  sceneOptions?: SceneOptions
  onReady?: ReadyCallback
  onVisibilityChange?: VisibilityChangeCallback
}

export const SceneCanvas: Component<SceneCanvasProps> = (props) => {
  const $scene = createSceneStore()
  const sceneActions = bindSceneSetters($scene)
  const sceneContext: SceneContextValue = [$scene, sceneActions]

  const [sceneCanvas, setSceneCanvas] = createSignal<HTMLCanvasElement | null>(
    null
  )

  const resize = () => {
    const scene = $scene.get().scene
    if (scene !== null) {
      scene.getEngine().resize()
    }
  }

  const renderLoop = () => {
    const scene = $scene.get().scene
    if (scene?.activeCamera != null) {
      scene.render()
    }
  }
  let running = false
  const start = () => {
    if (running) {
      throw new Error('cannot start; already running')
    }
    const scene = $scene.get().scene
    if (scene == null) {
      throw new Error('cannot start; scene is null')
    }

    if (typeof props.onReady === 'function') {
      props.onReady(scene)
    }
    const engine = scene.getEngine()
    engine.runRenderLoop(renderLoop)
    running = true
    $scene.setKey('running', running)
  }

  const stop = () => {
    if (!running) {
      throw new Error('cannot stop; not running')
    }
    const scene = $scene.get().scene
    if (scene !== null) {
      scene.getEngine().stopRenderLoop(renderLoop)
      running = false
      $scene.setKey('running', running)
    }
  }

  const useVisibilityObserver = createVisibilityObserver(
    { threshold: 0.6 },
    (entry) => {
      console.log(entry)
      const scene = $scene.get().scene
      if (scene == null) {
        return entry.isIntersecting
      }
      if (props.onVisibilityChange != null) {
        props.onVisibilityChange(scene, entry.isIntersecting)
      }

      if (entry.isIntersecting && !running) {
        start()
      } else if (!entry.isIntersecting && running) {
        stop()
      }

      return entry.isIntersecting
    }
  )
  useVisibilityObserver(sceneCanvas)

  // set up basic engine and scene
  onMount(() => {
    const canvas = sceneCanvas()
    if (canvas == null) {
      return
    }

    const engine = new Engine(
      canvas,
      props.antialias,
      props.engineOptions,
      props.adaptToDeviceRatio
    )
    const scene = new Scene(engine, props.sceneOptions)
    sceneActions.setScene(scene)

    if (scene.isReady()) {
      start()
    } else {
      scene.onReadyObservable.addOnce(start)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', resize)
    }
  })

  onCleanup(() => {
    const scene = $scene.get().scene
    if (scene !== null) {
      scene.getEngine().dispose()
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', resize)
    }
  })

  return (
    <SceneContext.Provider value={sceneContext}>
      <canvas ref={setSceneCanvas} {...props}>
        {props.children}
      </canvas>
    </SceneContext.Provider>
  )
}
