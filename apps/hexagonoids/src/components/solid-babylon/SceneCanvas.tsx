// Based on https://doc.babylonjs.com/communityExtensions/Babylon.js+ExternalLibraries/BabylonJS_and_ReactJS

import type { AbstractEngineOptions } from '@babylonjs/core/Engines/abstractEngine.js'
import { Scene } from '@babylonjs/core/scene'
import type { SceneOptions } from '@babylonjs/core/scene'
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
  engineOptions?: AbstractEngineOptions
  adaptToDeviceRatio?: boolean
  sceneOptions?: SceneOptions
  onReady?: ReadyCallback
  onVisibilityChange?: VisibilityChangeCallback
  enableWebGPU?: boolean
}

export const SceneCanvas: Component<SceneCanvasProps> = (props) => {
  const $scene = createSceneStore()
  const sceneActions = bindSceneSetters($scene)
  const sceneContext: SceneContextValue = [$scene, sceneActions]

  const [sceneCanvas, setSceneCanvas] = createSignal<HTMLCanvasElement | null>(
    null
  )
  const [engineReady, setEngineReady] = createSignal(false)

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

  // set up basic engine and scene with proper WebGPU async initialization
  let isInitializing = false
  onMount(() => {
    void (async () => {
      // Initialization guard to prevent concurrent engine creation
      if (isInitializing) {
        console.warn(
          'Engine initialization already in progress, skipping duplicate'
        )
        return
      }
      isInitializing = true

      const canvas = sceneCanvas()
      if (canvas == null) {
        isInitializing = false
        return
      }

      // Track if component was disposed during async operations
      let disposed = false
      onCleanup(() => {
        disposed = true
      })

      try {
        let engine = null

        // Attempt WebGPU if requested and supported, otherwise fall back to WebGL
        if (props.enableWebGPU === true) {
          console.log('Attempting WebGPU initialization...')
          try {
            // Lazy load WebGPUEngine only when needed
            const { WebGPUEngine } = await import(
              '@babylonjs/core/Engines/webgpuEngine.js'
            )
            const webGPUSupported = await WebGPUEngine.IsSupportedAsync

            if (webGPUSupported) {
              const webGPUEngine = new WebGPUEngine(canvas, props.engineOptions)
              await webGPUEngine.initAsync()

              // Check if disposed during async init
              if (disposed) {
                webGPUEngine.dispose()
                return
              }

              console.log('Hexagonoids engine initialized: WebGPU')
              webGPUEngine.useReverseDepthBuffer = true
              console.log('WebGPU reverse depth buffer enabled')
              if (webGPUEngine.isNDCHalfZRange) {
                console.log('WebGPU NDC half Z-range enabled (0 to 1)')
              }

              engine = webGPUEngine
            } else {
              console.warn('WebGPU not supported, falling back to WebGL')
            }
          } catch (error) {
            console.warn(
              'WebGPU initialization failed, falling back to WebGL:',
              error
            )
          }
        }

        // Fall back to WebGL if WebGPU not requested or failed
        if (engine === null) {
          console.log('Using WebGL engine')
          // Lazy load Engine only when needed
          const { Engine } = await import('@babylonjs/core/Engines/engine')
          engine = new Engine(
            canvas,
            props.antialias,
            props.engineOptions,
            props.adaptToDeviceRatio
          )
          console.log('Hexagonoids engine initialized: WebGL')
        }

        // Create scene (now inherits correct NDC settings)
        const scene = new Scene(engine, props.sceneOptions)
        sceneActions.setScene(scene)

        // Wait for scene AND all materials to be ready (proper async pattern)
        await scene.whenReadyAsync()

        // Check if disposed during async scene initialization
        if (disposed) {
          engine.dispose()
          return
        }

        console.log('Scene ready')

        // Mark engine as ready AFTER scene is fully ready (allows children to render)
        setEngineReady(true)

        // Start render loop
        start()

        // Resize handling
        if (typeof window !== 'undefined') {
          window.addEventListener('resize', resize)
        }
      } catch (error) {
        console.error('Failed to initialize Babylon.js engine:', error)
      } finally {
        isInitializing = false
      }
    })()
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
        {engineReady() ? props.children : null}
      </canvas>
    </SceneContext.Provider>
  )
}
