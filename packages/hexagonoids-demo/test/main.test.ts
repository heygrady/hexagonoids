import { describe, expect, it, vi } from 'vitest'
import { runMainCli } from '../src/main.js'

describe('runMainCli', () => {
  it('returns 0 for --help', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const code = await runMainCli(['--help'])

    expect(code).toBe(0)
    vi.restoreAllMocks()
  })

  it('returns 0 when no command is given', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const code = await runMainCli([])

    expect(code).toBe(0)
    vi.restoreAllMocks()
  })

  it('returns 1 for unknown command', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const code = await runMainCli(['foobar'])

    expect(code).toBe(1)
    vi.restoreAllMocks()
  })

  it('delegates replay subcommand to replay CLI', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // replay with no args fails because genome path is missing
    const code = await runMainCli(['replay'])

    expect(code).toBe(1)
    vi.restoreAllMocks()
  })

  it('returns 1 for unknown option in baseline mode', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const code = await runMainCli(['baseline', '--bogus'])

    expect(code).toBe(1)
    vi.restoreAllMocks()
  })
})
