import { appendFile, mkdir, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { TRPCError } from '@trpc/server'
import { z } from 'zod/v4'
import { publicProcedure, router } from '../trpc'

const BENCHMARK_SEEDS = [
  'benchmark-001',
  'benchmark-002',
  'benchmark-003',
  'benchmark-004',
  'benchmark-005',
]

const SESSION_DURATION = 10_000

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
})

type SessionRecording = z.infer<typeof sessionRecordingSchema>

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
})
