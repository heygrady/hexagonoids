import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import type { APIRoute } from 'astro'
import { appRouter } from '../../../server/router'

export const prerender = false

export const ALL: APIRoute = ({ request }) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter,
    createContext: () => ({}) as Record<string, never>,
  })
