import { describe, expect, it, vi } from 'vitest'
import { runCli } from '../src/cli/index.js'

describe('runCli', () => {
  it('returns 0 for --help', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const code = await runCli(['--help'])

    expect(code).toBe(0)
    vi.restoreAllMocks()
  })

  it('returns 0 when no command is given', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const code = await runCli([])

    expect(code).toBe(0)
    vi.restoreAllMocks()
  })

  it('returns 2 for unknown command', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const code = await runCli(['foobar'])

    expect(code).toBe(2)
    vi.restoreAllMocks()
  })

  it('returns 2 when replay genome path is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const code = await runCli(['replay'])

    expect(code).toBe(2)
    vi.restoreAllMocks()
  })

  it('returns 2 for unknown option in baseline mode', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const code = await runCli(['baseline', '--bogus'])

    expect(code).toBe(2)
    vi.restoreAllMocks()
  })

  it('returns 2 for invalid --thrustMath value', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const code = await runCli(['train', '--thrustMath', 'bad'])

    expect(code).toBe(2)
    vi.restoreAllMocks()
  })

  it('rejects the removed positional method shorthand for lab', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const code = await runCli(['lab', 'NEAT'])

    expect(code).toBe(2)
    vi.restoreAllMocks()
  })
})
