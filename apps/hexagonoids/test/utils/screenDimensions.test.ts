import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { getScreenDimensions } from '../../src/components/hexagonoids/utils/screenDimensions'

afterEach(() => {
  vi.unstubAllGlobals()
})

function createMockEngine(
  isWebGPU: boolean,
  renderWidth: number,
  renderHeight: number
): AbstractEngine {
  return {
    isWebGPU,
    getRenderWidth: (_useScreen?: boolean) => renderWidth,
    getRenderHeight: (_useScreen?: boolean) => renderHeight,
  } as unknown as AbstractEngine
}

describe('getScreenDimensions', () => {
  test('returns physical pixels for WebGPU engine', () => {
    const engine = createMockEngine(true, 1920, 1080)

    const [width, height] = getScreenDimensions(engine)

    expect(width).toBe(1920)
    expect(height).toBe(1080)
  })

  test('divides by device pixel ratio for WebGL engine', () => {
    vi.stubGlobal('devicePixelRatio', 2)
    const engine = createMockEngine(false, 3840, 2160)

    const [width, height] = getScreenDimensions(engine)

    expect(width).toBe(1920)
    expect(height).toBe(1080)
  })
})
