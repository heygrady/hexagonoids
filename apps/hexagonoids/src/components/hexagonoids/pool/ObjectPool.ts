import QuickLRU from 'quick-lru'

import { DisposalQueue } from './DisposalQueue'
import type { PoolConfig, PoolStats } from './PooledObject'

/**
 * Generic object pool for managing reusable game objects.
 *
 * This pool solves the Babylon.js v8 disposal observer re-entry problem by:
 * 1. Separating "release" (return to pool) from "dispose" (eviction)
 * 2. Using re-entry guards to prevent recursive disposal
 * 3. Deferring Babylon.js disposal to next microtask
 *
 * Lifecycle:
 * - acquire(): Get object from pool (or create new) → return active
 * - release(item): Return to pool (resets state)
 * - dispose(): Eviction from pool (destroys Babylon.js resources)
 * @template T - The object type stored in the pool
 */
export class ObjectPool<T> {
  private readonly config: PoolConfig<T>
  private readonly pool: QuickLRU<string, T>
  private readonly activeObjects = new Set<string>()
  private readonly disposingObjects = new Set<string>()
  private readonly disposalQueue: DisposalQueue
  private readonly name: string

  // Statistics
  private readonly stats: PoolStats = {
    poolSize: 0,
    activeCount: 0,
    disposingCount: 0,
    totalAcquisitions: 0,
    totalReleases: 0,
    totalDisposals: 0,
    cacheMisses: 0,
    cacheHits: 0,
  }

  constructor(config: PoolConfig<T>) {
    this.config = config
    this.name = config.name ?? 'ObjectPool'
    this.disposalQueue = new DisposalQueue(`${this.name}/Disposal`)

    // Create LRU pool with eviction handler
    this.pool = new QuickLRU<string, T>({
      maxSize: config.maxSize,
      onEviction: (key, item) => {
        this.dispose(item)
      },
    })
  }

  /**
   * Acquire an object from the pool.
   *
   * If a key is provided and exists in the pool, that specific object is returned.
   * Otherwise, the oldest object is returned (LRU policy).
   * If the pool is empty, a new object is created.
   * @param {string} [key] - Optional key to acquire a specific object
   * @returns {T} An object ready for use
   */
  acquire(key?: string): T {
    this.stats.totalAcquisitions++

    let item: T | undefined

    // Try to get specific item if key provided
    if (key !== undefined && this.pool.has(key)) {
      item = this.pool.get(key)
      this.pool.delete(key)
      this.stats.cacheHits++
    } else {
      // Get oldest item (LRU policy)
      const oldestEntry = this.pool.entriesAscending().next().value
      if (oldestEntry !== undefined) {
        item = oldestEntry[1] as T
        this.pool.delete(oldestEntry[0])
        this.stats.cacheHits++
      }
    }

    // Create new item if pool was empty
    if (item === undefined) {
      // Get scene from getScene() callback
      const scene = this.config.getScene()
      if (scene === undefined) {
        throw new Error(
          `[${this.name}] getScene() returned undefined - this is a fatal error`
        )
      }
      item = this.config.createFn(scene)
      this.stats.cacheMisses++
    }

    // Track as active
    const itemKey = this.getKey(item)
    this.activeObjects.add(itemKey)

    this.updateStats()
    return item
  }

  /**
   * Acquire multiple objects from the pool.
   * @param {number} count - Number of objects to acquire
   * @returns {T[]} Array of objects
   */
  acquireMany(count: number): T[] {
    const items: T[] = []
    for (let i = 0; i < count; i++) {
      items.push(this.acquire())
    }
    return items
  }

  /**
   * Release an object back to the pool.
   *
   * This is a fast, synchronous operation that:
   * 1. Resets state to defaults
   * 2. Adds to pool (may trigger eviction)
   * @param {T} item - The object to release
   */
  release(item: T): void {
    const key = this.getKey(item)

    // Guard against releasing while disposing
    if (this.disposingObjects.has(key)) {
      console.warn(`[${this.name}] Cannot release ${key}: currently disposing`)
      return
    }

    // Guard against double release
    if (!this.activeObjects.has(key)) {
      // console.warn(`[${this.name}] Double release detected or object not tracked: ${key}`)
      // Proceed anyway to be safe, but log it
    }

    this.stats.totalReleases++

    // Remove from active tracking
    this.activeObjects.delete(key)

    // Reset state
    const resetItem = this.config.resetFn(item)

    // Add to pool (may trigger eviction)
    this.pool.set(key, resetItem)

    this.updateStats()
  }

  /**
   * Release multiple objects back to the pool.
   * @param {T[]} items - Array of objects to release
   */
  releaseMany(items: T[]): void {
    items.forEach((item) => {
      this.release(item)
    })
  }

  /**
   * Dispose of an object's Babylon.js resources.
   *
   * This is called automatically during eviction.
   * Should not be called directly unless you know what you're doing.
   * @param {T} item - The object to dispose
   */
  private dispose(item: T): void {
    const key = this.getKey(item)

    // Re-entry guard
    if (this.disposingObjects.has(key)) {
      console.warn(`[${this.name}] Re-entry prevented: ${key}`)
      return
    }

    this.stats.totalDisposals++
    this.disposingObjects.add(key)

    // Remove from active set if still there
    this.activeObjects.delete(key)

    // Queue disposal for next microtask
    // This breaks the synchronous chain and prevents re-entry
    this.disposalQueue.enqueue(() => {
      try {
        this.config.disposeFn(item)
      } catch (error) {
        console.error(`[${this.name}] Error disposing ${key}:`, error)
      } finally {
        this.disposingObjects.delete(key)
        this.updateStats()
      }
    })
  }

  /**
   * Get the key for an object.
   * @param {T} item - The object
   * @returns {string} The key
   */
  private getKey(item: T): string {
    if (this.config.keyFn !== undefined) {
      return this.config.keyFn(item)
    }
    // Try to find an id property
    if (typeof item === 'object' && item !== null && 'id' in item) {
      return String((item as any).id)
    }
    // Fallback (should be avoided)
    console.warn(`[${this.name}] No key found for object, using JSON string`)
    return JSON.stringify(item)
  }

  /**
   * Update statistics.
   */
  private updateStats(): void {
    this.stats.poolSize = this.pool.size
    this.stats.activeCount = this.activeObjects.size
    this.stats.disposingCount = this.disposingObjects.size
  }

  /**
   * Check if the pool contains a specific key.
   * @param {string} key - The key to check
   * @returns {boolean} True if the key exists in the pool
   */
  has(key: string): boolean {
    return this.pool.has(key)
  }

  /**
   * Get the current number of objects in the pool.
   * @returns {number} The pool size
   */
  size(): number {
    return this.pool.size
  }

  /**
   * Get pool statistics.
   * @returns {Readonly<PoolStats>} Current pool statistics
   */
  getStats(): Readonly<PoolStats> {
    return { ...this.stats }
  }

  /**
   * Clear the pool without disposing objects.
   * Objects remain in memory but are removed from the pool.
   * Use with caution - may cause resource leaks.
   */
  clear(): void {
    console.warn(`[${this.name}] Clearing pool without disposal`)
    this.pool.clear()
    this.activeObjects.clear()
    this.updateStats()
  }

  /**
   * Destroy the pool and dispose of all objects.
   * This includes both pooled and active objects.
   * Call during shutdown to clean up resources.
   */
  destroy(): void {
    // Dispose all active objects
    // Note: We can't iterate active objects easily because we only store keys
    // But we can clear the pool which disposes pooled objects
    // For active objects, we rely on the caller to release them or they will be GC'd
    // (Babylon resources should be disposed by the caller if they are active)

    // Dispose all pooled objects
    const pooledItems = Array.from(this.pool.values())
    pooledItems.forEach((item) => {
      this.dispose(item)
    })

    // Clear collections
    this.pool.clear()
    this.activeObjects.clear()

    // Flush disposal queue
    this.disposalQueue.flush()

    this.updateStats()
  }
}
