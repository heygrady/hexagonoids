import { Dispatcher } from '@neat-evolution/worker-actions'
import { WorkerPool } from '@neat-evolution/worker-pool'
import { hardwareConcurrency } from '@neat-evolution/worker-threads'

import type { SupportedAlgorithm } from '../../algorithmRegistry.js'
import type { GenomeBehavior, ScoringMethod } from './types.js'
import {
  type AnalyzeBatchResult,
  analyzeBatch,
  type GenomeRef,
  init,
  terminate,
} from './workerLabActions.js'

export interface LabWorkerPool {
  analyzeGenomesParallel(options: {
    genomePaths: string[]
    method: SupportedAlgorithm
    seedsPerGenome: number
    maxTicks: number
    dtMs: number
    baseSeed: string
    scoringMethods?: Record<string, ScoringMethod> | undefined
    onProgress?: (completed: number, total: number) => void
  }): Promise<GenomeBehavior[]>

  terminate(): Promise<void>
}

function chunkArray<T>(array: T[], chunkCount: number): T[][] {
  if (chunkCount <= 0) return [array]
  const chunks: T[][] = []
  const chunkSize = Math.ceil(array.length / chunkCount)
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

export async function createLabWorkerPool(options?: {
  threadCount?: number | undefined
  verbose?: boolean | undefined
}): Promise<LabWorkerPool> {
  const threadCount =
    options?.threadCount ?? Math.max(1, hardwareConcurrency - 2)
  const verbose = options?.verbose ?? false

  const workerScriptUrl = new URL('./workerLabScript.js', import.meta.url)

  const pool = new WorkerPool({
    threadCount,
    taskCount: threadCount,
    workerScriptUrl,
    workerOptions: {
      name: 'LabWorker',
      type: 'module',
    },
    verbose,
  })

  const dispatcher = new Dispatcher(pool, { verbose })

  await pool.ready()
  await dispatcher.broadcast(init({}))

  console.log(`Lab worker pool initialized: ${threadCount} threads`)

  return {
    async analyzeGenomesParallel(analyzeOptions): Promise<GenomeBehavior[]> {
      const {
        genomePaths,
        method,
        seedsPerGenome,
        maxTicks,
        dtMs,
        baseSeed,
        scoringMethods,
        onProgress,
      } = analyzeOptions

      const hasScoringMethods =
        scoringMethods != null && Object.keys(scoringMethods).length > 0
      const includePerSeedMetrics = hasScoringMethods

      // Build genome refs with generation index
      const genomeRefs: GenomeRef[] = genomePaths.map((genomePath, i) => ({
        genomePath,
        generation: i,
      }))

      // Chunk across workers
      const chunks = chunkArray(genomeRefs, threadCount)

      let completed = 0
      const total = genomePaths.length

      const promises = chunks.map((chunk) =>
        dispatcher
          .call<AnalyzeBatchResult>(
            analyzeBatch({
              genomeRefs: chunk,
              method,
              seedsPerGenome,
              maxTicks,
              dtMs,
              baseSeed,
              includePerSeedMetrics,
            })
          )
          .then((result) => {
            completed += chunk.length
            onProgress?.(completed, total)
            return result
          })
      )

      const results = await Promise.all(promises)

      // Reassemble in order — chunks are contiguous and in order
      const behaviors: GenomeBehavior[] = []
      for (const result of results) {
        for (const entry of result.entries) {
          const behavior = entry.behavior

          // Apply scoring methods on main thread if needed
          if (hasScoringMethods && entry.perSeedMetrics != null) {
            const perSeedAltScores: Record<string, number[]> = {}
            for (const m of entry.perSeedMetrics) {
              for (const [name, fn] of Object.entries(scoringMethods!)) {
                let arr = perSeedAltScores[name]
                if (arr == null) {
                  arr = []
                  perSeedAltScores[name] = arr
                }
                arr.push(fn(m, { generation: behavior.generation }))
              }
            }
            const n = entry.perSeedMetrics.length
            for (const [name, arr] of Object.entries(perSeedAltScores)) {
              behavior.scoring.alternativeScores[name] =
                arr.reduce((a, b) => a + b, 0) / n
            }
          }

          behaviors.push(behavior)
        }
      }

      return behaviors
    },

    async terminate(): Promise<void> {
      await dispatcher.broadcast(terminate())
      await pool.terminate()
    },
  }
}
