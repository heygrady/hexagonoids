import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { bench, describe } from 'vitest'

import { train } from '../src/train.js'

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

describe('training flamegraph target', () => {
  bench(
    'hyperneat flamegraph run (24 genomes, 300 ticks, 1 generation)',
    async () => {
      await withTempOutputDir('hex-flame-train', async (outputDir) => {
        await train({
          method: 'HyperNEAT',
          populationSize: 24,
          iterations: 1,
          earlyStopPatience: 999,
          evaluationSeedsPerOrganism: 1,
          baseSeed: 'perf-flame-v1',
          maxTicks: 300,
          dtMs: 33,
          threadCount: 1,
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
