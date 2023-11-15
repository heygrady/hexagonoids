export interface Resettable {
  reset: () => void
}

export type FactoryFn<T, TFO> = (options: TFO) => T

export type InitializerFn<TFO> = (options: TFO) => void

export interface Initializable<TFO> {
  initialize: InitializerFn<TFO>
}

export class ObjectPool<T extends Resettable & Initializable<TFO>, TFO> {
  private readonly pool: T[] = []
  private readonly factory: FactoryFn<T, TFO>

  constructor(factory: FactoryFn<T, TFO>) {
    this.factory = factory
  }

  acquire(options: TFO): T {
    let item: T
    if (this.pool.length > 0) {
      item = this.pool.pop() as T
      item.initialize(options)
    } else {
      item = this.factory(options)
    }
    return item
  }

  release(item: T): void {
    item.reset()
    this.pool.push(item)
  }
}
