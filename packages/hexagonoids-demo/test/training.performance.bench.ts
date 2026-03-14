import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { bench, describe } from 'vitest'

import { train } from '../src/features/training/train.js'

async function withTempOutputDir<T>(
  prefix: string,
  run: (outputDir: string) => Promise<T>
): Promise<T> {
  const outputDir = await mkdtemp(join(tmpdir(), `${prefix}-`))
  try {
    return await run(outputDir)
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
}

describe('training performance', () => {
  bench(
    'hyperneat short run (64 genomes, 3000 ticks, 3 generations)',
    async () => {
      await withTempOutputDir('hex-short-train', async (outputDir) => {
        await train({
          method: 'HyperNEAT',
          populationSize: 64,
          iterations: 3,
          earlyStopPatience: 999,
          evaluationSeedsPerOrganism: 4,
          baseSeed: 'perf-short-v1',
          maxTicks: 3000,
          dtMs: 33,
          outputDir,
        })
      })
    },
    {
      iterations: 1,
      warmupIterations: 0,
      time: 0,
      warmupTime: 0,
    }
  )

  bench(
    'hyperneat baseline (100 genomes, 1000 ticks, 10 generations)',
    async () => {
      await withTempOutputDir('hex-baseline-train', async (outputDir) => {
        await train({
          method: 'HyperNEAT',
          populationSize: 100,
          iterations: 10,
          earlyStopPatience: 999,
          evaluationSeedsPerOrganism: 1,
          baseSeed: 'perf-baseline-v1',
          maxTicks: 1000,
          dtMs: 33,
          outputDir,
        })
      })
    },
    {
      iterations: 1,
      warmupIterations: 0,
      time: 0,
      warmupTime: 0,
    }
  )
})
