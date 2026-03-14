import { loadGenome } from '../features/persistence/loadGenome.js'
import type { HexagonoidsEvolutionManagerOptions } from '../features/training/EvolutionManager.js'
import { HexagonoidsEvolutionManager } from '../features/training/EvolutionManager.js'
import { train } from '../features/training/train.js'

export const createNodeEvolutionManager = (
  options: HexagonoidsEvolutionManagerOptions = {}
): HexagonoidsEvolutionManager => {
  return new HexagonoidsEvolutionManager({
    ...options,
    trainer: train,
    deserializeOrganism: loadGenome,
  })
}

export * from '../browser/index.js'
export * from '../cli/index.js'
export * from '../features/lab/index.js'
export * from '../features/persistence/appendGenerationLog.js'
export * from '../features/persistence/loadGenome.js'
export * from '../features/persistence/saveGenome.js'
export * from '../features/training/replayGenome.js'
export * from '../features/training/train.js'
