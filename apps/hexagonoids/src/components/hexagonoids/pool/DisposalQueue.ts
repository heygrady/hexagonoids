/**
 * Manages deferred disposal of Babylon.js resources.
 *
 * The disposal queue breaks synchronous observer chains by deferring
 * actual Babylon.js disposal to the next microtask. This prevents
 * re-entry loops caused by synchronous observer execution in Babylon.js v8.
 *
 * Usage:
 * ```typescript
 * const queue = new DisposalQueue()
 *
 * // Instead of disposing immediately:
 * // mesh.dispose()
 *
 * // Queue disposal for next tick:
 * queue.enqueue(() => mesh.dispose())
 * ```
 */
export class DisposalQueue {
  private queue: Array<() => void> = []
  private isProcessing = false
  private readonly name: string

  constructor(name = 'DisposalQueue') {
    this.name = name
  }

  /**
   * Enqueue a disposal function to be executed on the next microtask.
   * @param {() => void} fn - Function that performs disposal (e.g., () => mesh.dispose())
   */
  enqueue(fn: () => void): void {
    this.queue.push(fn)

    // Process on next microtask if not already processing
    if (!this.isProcessing) {
      queueMicrotask(() => {
        this.process()
      })
    }
  }

  /**
   * Process all queued disposal functions.
   * Executes synchronously once the microtask runs.
   */
  private process(): void {
    if (this.isProcessing) {
      return
    }

    this.isProcessing = true

    try {
      while (this.queue.length > 0) {
        const fn = this.queue.shift()
        if (fn === undefined) {
          continue
        }
        try {
          fn()
        } catch (error) {
          console.error(`[${this.name}] Disposal error:`, error)
        }
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Get the current number of queued disposals.
   * Useful for debugging and monitoring.
   * @returns {number} The number of queued disposals
   */
  get size(): number {
    return this.queue.length
  }

  /**
   * Clear all queued disposals without executing them.
   * Use with caution - may cause resource leaks.
   */
  clear(): void {
    const cleared = this.queue.length
    this.queue = []
    if (cleared > 0) {
      console.warn(
        `[${this.name}] Cleared ${cleared} disposal(s) without executing`
      )
    }
  }

  /**
   * Force immediate processing of the queue.
   * Normally not needed as queue processes automatically.
   */
  flush(): void {
    if (this.queue.length > 0) {
      this.process()
    }
  }
}
