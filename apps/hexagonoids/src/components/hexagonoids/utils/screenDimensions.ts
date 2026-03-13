import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine'

/**
 * WebGPU and WebGL engines handle screen coordinates differently.
 * Uses engine.isWebGPU accessor to avoid loading WebGPUEngine class.
 * @param {AbstractEngine} engine - Babylon.js engine
 * @returns {[number, number]} [width, height]
 */
export const getScreenDimensions = (
  engine: AbstractEngine
): [width: number, height: number] => {
  // Use Babylon.js built-in engine.isWebGPU property
  if (engine.isWebGPU) {
    // WebGPU: Use physical pixels (hardware pixels)
    return [engine.getRenderWidth(true), engine.getRenderHeight(true)]
  } else {
    // WebGL: Use hardware pixel dimensions but account for device pixel ratio
    const pixelRatio = globalThis?.devicePixelRatio ?? 1
    const width = engine.getRenderWidth(true) / pixelRatio
    const height = engine.getRenderHeight(true) / pixelRatio
    return [width, height]
  }
}
