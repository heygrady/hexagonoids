/**
 * Performance monitoring utilities to detect freezes and infinite loops
 */

let frameCount = 0
let lastFrameTime = performance.now()
let currentFrameStartTime = performance.now()
let frameIncrementedThisRender = false
const ERROR_THRESHOLD_MS = 100 // Consider frame frozen if it takes >100ms
const WARNING_THRESHOLD_MS = 32 // Warn if frame takes >2 frames (>32ms at 60fps)

export const getFrameCount = () => frameCount

/**
 * Increment frame count once per render frame.
 * Uses requestAnimationFrame timing to ensure we only increment once per frame,
 * even if called by multiple components.
 */
export const incrementFrameCount = () => {
  const now = performance.now()

  // If we've already incremented this frame, skip
  if (frameIncrementedThisRender && now - currentFrameStartTime < 5) {
    return
  }

  // New frame detected
  frameCount++
  frameIncrementedThisRender = true
  currentFrameStartTime = now

  const frameDuration = now - lastFrameTime

  if (frameDuration > ERROR_THRESHOLD_MS) {
    console.error(
      `[PerformanceMonitor] Frame ${frameCount} took ${frameDuration.toFixed(
        2
      )}ms`
    )
  } else if (frameDuration > WARNING_THRESHOLD_MS) {
    console.warn(
      `[PerformanceMonitor] Slow frame ${frameCount}: ${frameDuration.toFixed(
        2
      )}ms`
    )
  }

  lastFrameTime = now

  // Reset flag after a short delay (next frame will set it again)
  setTimeout(() => {
    frameIncrementedThisRender = false
  }, 5)
}

/**
 * Wraps a function with performance timing
 * @template T
 * @param {string} name - Name of the function for logging
 * @param {T} fn - Function to wrap
 * @param {number} [warnThreshold] - Threshold in ms to warn
 * @returns {T} Wrapped function
 */
export const timeFunction = <T extends (...args: any[]) => any>(
  name: string,
  fn: T,
  warnThreshold = WARNING_THRESHOLD_MS
): T => {
  return ((...args: Parameters<T>): ReturnType<T> => {
    const start = performance.now()
    try {
      const result = fn(...args)
      const duration = performance.now() - start

      if (duration > warnThreshold) {
        console.warn(
          `[PerformanceMonitor] ${name} took ${duration.toFixed(
            2
          )}ms (frame ${frameCount})`
        )
      }

      return result
    } catch (error) {
      const duration = performance.now() - start
      console.error(
        `[PerformanceMonitor] ${name} threw error after ${duration.toFixed(
          2
        )}ms:`,
        error
      )
      throw error
    }
  }) as T
}

/**
 * Guard against infinite loops by limiting iterations
 */
export class LoopGuard {
  private iterations = 0
  private readonly maxIterations: number
  private readonly loopName: string

  constructor(loopName: string, maxIterations: number = 1000) {
    this.loopName = loopName
    this.maxIterations = maxIterations
  }

  check(): boolean {
    this.iterations++

    if (this.iterations > this.maxIterations) {
      const error = new Error(
        `[LoopGuard] ${this.loopName} exceeded ${this.maxIterations} iterations (frame ${frameCount})`
      )
      console.error(error)
      throw error
    }

    return true
  }

  getIterations(): number {
    return this.iterations
  }
}
