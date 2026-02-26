import { sessionsRouter } from './routers/sessions'
import { router } from './trpc'

export const appRouter = router({
  sessions: sessionsRouter,
})

export type AppRouter = typeof appRouter
