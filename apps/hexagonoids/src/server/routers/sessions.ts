import { appendFile, mkdir, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { TRPCError } from '@trpc/server'
import { z } from 'zod/v4'
import {
  BENCHMARK_SEEDS,
  SESSION_DURATION,
} from '../../components/hexagonoids/modes/constants'
import { publicProcedure, router } from '../trpc'

const DATA_DIR = path.resolve('.data/sessions')

// Only alphanumeric, hyphens, and underscores — no path separators or traversal
const safeIdSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/)

const frameRecordSchema = z.object({
  dt: z.number(),
  i: z.number(),
})

const sessionRecordingSchema = z.object({
  playerId: safeIdSchema,
  seed: safeIdSchema,
  duration: z.number(),
  frames: z.array(frameRecordSchema),
  score: z.number().optional(),
  wave: z.number().optional(),
})

type SessionRecording = z.infer<typeof sessionRecordingSchema>

interface SeedBenchmarkStats {
  bestScore: number
  avgScore: number
  attempts: number
  bestWave: number
}

function sessionPath(playerId: string, seed: string): string {
  // path.basename() strips any remaining path separators as defense-in-depth
  return path.join(
    DATA_DIR,
    path.basename(playerId),
    `${path.basename(seed)}.jsonl`
  )
}

export const sessionsRouter = router({
  save: publicProcedure
    .input(sessionRecordingSchema)
    .mutation(async ({ input }): Promise<{ success: true }> => {
      const filePath = sessionPath(input.playerId, input.seed)
      await mkdir(path.dirname(filePath), { recursive: true })
      await appendFile(filePath, `${JSON.stringify(input)}\n`)
      return { success: true }
    }),

  get: publicProcedure
    .input(z.object({ playerId: safeIdSchema, seed: safeIdSchema }))
    .query(async ({ input }): Promise<SessionRecording | null> => {
      const filePath = sessionPath(input.playerId, input.seed)
      let content: string
      try {
        content = await readFile(filePath, 'utf-8')
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to read session file: ${(err as Error).message}`,
          cause: err,
        })
      }

      const lines = content.trim().split('\n').filter(Boolean)
      const lastLine = lines.at(-1)
      if (!lastLine) return null

      let parsed: unknown
      try {
        parsed = JSON.parse(lastLine)
      } catch {
        console.warn(`Invalid JSON in ${filePath}`)
        return null
      }

      const result = sessionRecordingSchema.safeParse(parsed)
      if (!result.success) {
        console.warn(`Schema validation failed for ${filePath}:`, result.error)
        return null
      }
      return result.data
    }),

  list: publicProcedure
    .input(z.object({ playerId: safeIdSchema }))
    .query(async ({ input }): Promise<string[]> => {
      const playerDir = path.join(DATA_DIR, path.basename(input.playerId))
      let files: string[]
      try {
        files = await readdir(playerDir)
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to read player directory: ${(err as Error).message}`,
          cause: err,
        })
      }
      return files
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => f.replace('.jsonl', ''))
    }),

  seeds: publicProcedure.query((): { seeds: string[]; duration: number } => ({
    seeds: BENCHMARK_SEEDS,
    duration: SESSION_DURATION,
  })),

  exportBenchmarks: publicProcedure
    .input(z.object({ playerId: safeIdSchema }))
    .query(
      async ({
        input,
      }): Promise<{
        playerId: string
        seeds: Record<string, SeedBenchmarkStats>
      }> => {
        const seeds: Record<string, SeedBenchmarkStats> = {}

        for (const seed of BENCHMARK_SEEDS) {
          const filePath = sessionPath(input.playerId, seed)
          let content: string
          try {
            content = await readFile(filePath, 'utf-8')
          } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Failed to read session file: ${(err as Error).message}`,
              cause: err,
            })
          }

          const lines = content.trim().split('\n').filter(Boolean)
          if (lines.length === 0) continue

          let totalScore = 0
          let bestScore = 0
          let bestWave = 0
          let attempts = 0

          for (const line of lines) {
            let parsed: unknown
            try {
              parsed = JSON.parse(line)
            } catch {
              continue
            }
            const result = sessionRecordingSchema.safeParse(parsed)
            if (!result.success) continue

            const recording = result.data
            const score = recording.score ?? 0
            const wave = recording.wave ?? 0

            attempts++
            totalScore += score
            if (score > bestScore) bestScore = score
            if (wave > bestWave) bestWave = wave
          }

          if (attempts > 0) {
            seeds[seed] = {
              bestScore,
              avgScore: totalScore / attempts,
              attempts,
              bestWave,
            }
          }
        }

        return { playerId: input.playerId, seeds }
      }
    ),
})
