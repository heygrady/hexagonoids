/**
 * Debug utilities for performance timing
 * TEMPORARY: For local debugging only
 */

const timers = new Map<string, number>()

/**
 * Start a named timer
 * @param {string} name - Timer identifier
 * @param {boolean} [print] - Whether to log the start (default: false)
 */
export function startTimer(name: string, print: boolean = false): void {
  const now = performance.now()
  timers.set(name, now)
  if (print) {
    console.debug(`⏱️  Started: ${name}`)
  }
}

/**
 * End a named timer and optionally log the duration
 * @param {string} name - Timer identifier (must match startTimer call)
 * @param {boolean} [print] - Whether to log the duration (default: true)
 * @returns {number} Duration in milliseconds
 */
export function endTimer(name: string, print: boolean = true): number {
  const now = performance.now()
  const start = timers.get(name)

  if (start === undefined) {
    console.warn(`⚠️  Timer "${name}" was never started`)
    return 0
  }

  const duration = now - start
  timers.delete(name)

  if (print) {
    console.debug(`✓ Finished: ${name} in ${duration.toFixed(2)}ms`)
  }

  return duration
}

/**
 * Clear all timers
 */
export function clearTimers(): void {
  timers.clear()
}
