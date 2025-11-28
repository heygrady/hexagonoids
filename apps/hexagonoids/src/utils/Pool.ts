import { CELL_CACHE_SIZE } from '../components/hexagonoids/constants'

export type PoolCreate<T, A extends any[] = any[]> = (...args: A) => T
export type PoolReset<T> = (item: T) => void

export interface PoolOptions {
  maxSize: number
}

/**
 * Object pool implementation.
 * @template T - The type of object in the pool
 * @template A - The type of arguments for the create function
 */
export class Pool<T = any, A extends any[] = any[]> {
  private readonly create: PoolCreate<T, A>
  private readonly reset: PoolReset<T>
  private readonly maxSize: number
  private pool: T[]

  constructor(
    create: PoolCreate<T, A>,
    reset: PoolReset<T>,
    options?: Partial<PoolOptions>
  ) {
    this.create = create
    this.reset = reset
    // FIXME: consider using QuickLRU
    this.pool = []
    this.maxSize = options?.maxSize ?? CELL_CACHE_SIZE
  }

  get size() {
    return this.pool.length
  }

  /**
   * Remove an item from the pool or create a new one if the pool is empty.
   * @param {...any} args - Arguments to pass to the create function
   * @returns {T} The item from the pool or a new one
   */
  get(...args: A): T {
    if (this.pool.length === 0) {
      return this.create(...args)
    } else {
      return this.pool.pop() as T
    }
  }

  /**
   * Adds item back into the pool after resetting it.
   * @param {T} item - The item to release
   */
  release(item: T) {
    this.reset(item)
    this.pool.push(item)
    if (this.size > this.maxSize) {
      console.error(`Pool size exceeded: ${this.size} > ${this.maxSize}`)
    }
  }

  /**
   * Removes item from the pool without resetting it.
   * @param {T} item - The item to remove
   */
  remove(item: T) {
    this.pool = this.pool.filter((i) => i !== item)
  }
}
