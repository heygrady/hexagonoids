import type { HexagonoidsEvolutionManagerOptions } from '../EvolutionManager.js'
import { HexagonoidsEvolutionManager } from '../EvolutionManager.js'
import { appendHeroesLog } from '../persistence/appendHeroesLog.js'
import { loadGenome } from '../persistence/loadGenome.js'
import { saveGenome } from '../persistence/saveGenome.js'
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
export * from '../persistence/appendHeroesLog.js'
export * from '../persistence/loadGenome.js'
export * from '../persistence/saveGenome.js'
export * from '../train.js'
export { appendHeroesLog, loadGenome, saveGenome }
