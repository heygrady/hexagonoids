import type { Scene } from '@babylonjs/core/scene'

/**
 * Configuration for creating an object pool.
 * @template T - The object type stored in the pool
 */
export interface PoolConfig<T> {
  /**
   * Maximum number of objects to keep in the pool.
   * When exceeded, oldest objects are evicted and disposed.
   */
  maxSize: number

  /**
   * Getter function to retrieve the Babylon.js scene.
   * Called when a new object needs to be created (cache miss).
   * MUST return a valid scene - it is a fatal error to return undefined.
   * Allows lazy scene initialization - scene doesn't need to exist at pool creation time.
   * @returns The Babylon.js scene
   */
  getScene: () => Scene

  /**
   * Factory function to create a new object.
   * Called when the pool is empty and a new object is requested.
   */
  createFn: (scene: Scene) => T

  /**
   * Function to reset an object's state when returned to the pool.
   * Should return the object with reset state.
   */
  resetFn: (item: T) => T

  /**
   * Function to dispose of an object's Babylon.js resources.
   * Called when an object is evicted from the pool.
   */
  disposeFn: (item: T) => void

  /**
   * Optional function to extract a key from an object.
   * Defaults to using the object's `id` property if it exists.
   */
  keyFn?: (item: T) => string

  /**
   * Optional name for the pool (used in logging).
   */
  name?: string
}

/**
 * Statistics about pool usage.
 * Useful for debugging and performance monitoring.
 */
export interface PoolStats {
  /**
   * Current number of objects in the pool.
   */
  poolSize: number

  /**
   * Number of active objects (acquired but not released).
   */
  activeCount: number

  /**
   * Number of objects currently being disposed.
   */
  disposingCount: number

  /**
   * Total number of acquisitions since creation.
   */
  totalAcquisitions: number

  /**
   * Total number of releases since creation.
   */
  totalReleases: number

  /**
   * Total number of disposals since creation.
   */
  totalDisposals: number

  /**
   * Number of times acquire() created a new object (cache miss).
   */
  cacheMisses: number

  /**
   * Number of times acquire() reused a pooled object (cache hit).
   */
  cacheHits: number
}
