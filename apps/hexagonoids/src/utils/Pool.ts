import { CELL_CACHE_SIZE } from '../components/hexagonoids/constants'

export type PoolCreate<T, A extends any[] = any[]> = (...args: A) => T
export type PoolReset<T> = (item: T) => void

export interface PoolOptions {
  maxSize: number
}

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
   * @param {...any} args
   * @returns {T}
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
   * @param item
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
   * @param item
   */
  remove(item: T) {
    this.pool = this.pool.filter((i) => i !== item)
  }
}
