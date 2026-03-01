import type { HexagonoidsEvolutionManagerOptions } from '../EvolutionManager.js'
import { HexagonoidsEvolutionManager } from '../EvolutionManager.js'
import { loadGenome } from '../persistence/loadGenome.js'
import { train } from '../train.js'

export const createNodeEvolutionManager = (
  options: HexagonoidsEvolutionManagerOptions = {}
): HexagonoidsEvolutionManager => {
  return new HexagonoidsEvolutionManager({
    ...options,
    trainer: train,
    deserializeOrganism: loadGenome,
  })
}

export * from '../cli.js'
export * from '../features/lab/index.js'
export * from '../main.js'
export * from '../persistence/appendGenerationLog.js'
export * from '../persistence/loadGenome.js'
export * from '../persistence/saveGenome.js'
export * from '../train.js'
