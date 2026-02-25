import { describe, expect, it, vi } from 'vitest'
import { runCli } from '../src/cli.js'

describe('runCli', () => {
  it('returns 0 for --help', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const code = await runCli(['--help'])

    expect(code).toBe(0)
    vi.restoreAllMocks()
  })

  it('returns 1 when genome path is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const code = await runCli([])

    expect(code).toBe(1)
    vi.restoreAllMocks()
  })

  it('returns 1 for unknown option', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const code = await runCli(['--unknown'])

    expect(code).toBe(1)
    vi.restoreAllMocks()
  })

  it('returns 1 for invalid --method value', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const code = await runCli(['--path', 'genome.json', '--method', 'INVALID'])

    expect(code).toBe(1)
    vi.restoreAllMocks()
  })

  it('returns 1 for invalid --maxTicks value', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const code = await runCli(['--path', 'genome.json', '--maxTicks', '-5'])

    expect(code).toBe(1)
    vi.restoreAllMocks()
  })
})
