import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { mockAppendFile, mockMkdir, mockReaddir, mockReadFile } = vi.hoisted(
  () => ({
    mockAppendFile: vi.fn().mockResolvedValue(undefined),
    mockMkdir: vi.fn().mockResolvedValue(undefined),
    mockReaddir: vi.fn().mockResolvedValue([]),
    mockReadFile: vi.fn().mockResolvedValue(''),
  })
)

vi.mock('node:fs/promises', () => ({
  default: {
    appendFile: mockAppendFile,
    mkdir: mockMkdir,
    readdir: mockReaddir,
    readFile: mockReadFile,
  },
  appendFile: mockAppendFile,
  mkdir: mockMkdir,
  readdir: mockReaddir,
  readFile: mockReadFile,
}))

import { sessionsRouter } from '../../src/server/routers/sessions'

const caller = sessionsRouter.createCaller({})
let warnSpy: ReturnType<typeof vi.spyOn> | null = null
let errorSpy: ReturnType<typeof vi.spyOn> | null = null

function validRecording(overrides?: Record<string, unknown>) {
  return {
    playerId: 'player1',
    seed: 'benchmark-001',
    duration: 10000,
    frames: [{ dt: 16, i: 0 }],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  warnSpy?.mockRestore()
  errorSpy?.mockRestore()
  warnSpy = null
  errorSpy = null
})

describe('sessions.seeds', () => {
  test('returns benchmark seeds and duration', async () => {
    const result = await caller.seeds()

    expect(result.seeds).toHaveLength(5)
    expect(result.seeds[0]).toBe('benchmark-001')
    expect(result.duration).toBe(10_000)
  })
})

describe('sessions.save', () => {
  test('writes recording as JSONL and creates directory', async () => {
    const recording = validRecording()

    const result = await caller.save(recording)

    expect(result).toEqual({ success: true })
    expect(mockMkdir).toHaveBeenCalledOnce()
    expect(mockAppendFile).toHaveBeenCalledOnce()
    const written = mockAppendFile.mock.calls[0][1] as string
    expect(written.endsWith('\n')).toBe(true)
    expect(JSON.parse(written)).toEqual(recording)
  })

  test('rejects path traversal characters in playerId', async () => {
    const recording = validRecording({ playerId: '../etc' })

    await expect(caller.save(recording)).rejects.toThrow()
  })
})

describe('sessions.get', () => {
  test('returns last valid recording from JSONL file', async () => {
    const recording = validRecording()
    mockReadFile.mockResolvedValueOnce(`${JSON.stringify(recording)}\n`)

    const result = await caller.get({
      playerId: 'player1',
      seed: 'benchmark-001',
    })

    expect(result).toEqual(recording)
  })

  test('returns null when file does not exist (ENOENT)', async () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    mockReadFile.mockRejectedValueOnce(err)

    const result = await caller.get({
      playerId: 'player1',
      seed: 'missing',
    })

    expect(result).toBeNull()
  })

  test('throws TRPCError for non-ENOENT filesystem errors', async () => {
    const err = Object.assign(new Error('EACCES'), { code: 'EACCES' })
    mockReadFile.mockRejectedValueOnce(err)

    await expect(
      caller.get({ playerId: 'player1', seed: 'benchmark-001' })
    ).rejects.toThrow('Failed to read session file')
  })

  test('returns null for invalid JSON in file', async () => {
    mockReadFile.mockResolvedValueOnce('{bad json}\n')

    const result = await caller.get({
      playerId: 'player1',
      seed: 'benchmark-001',
    })

    expect(result).toBeNull()
  })

  test('returns null when JSON does not match schema', async () => {
    mockReadFile.mockResolvedValueOnce(
      `${JSON.stringify({ unexpected: true })}\n`
    )

    const result = await caller.get({
      playerId: 'player1',
      seed: 'benchmark-001',
    })

    expect(result).toBeNull()
  })
})

describe('sessions.list', () => {
  test('returns empty array when player directory does not exist', async () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    mockReaddir.mockRejectedValueOnce(err)

    const result = await caller.list({ playerId: 'player1' })

    expect(result).toEqual([])
  })

  test('returns seed names from JSONL files, excluding non-JSONL', async () => {
    mockReaddir.mockResolvedValueOnce([
      'benchmark-001.jsonl',
      'benchmark-002.jsonl',
      'notes.txt',
    ])

    const result = await caller.list({ playerId: 'player1' })

    expect(result).toEqual(['benchmark-001', 'benchmark-002'])
  })
})

describe('sessions.exportBenchmarks', () => {
  test('aggregates best/avg score and best wave across multiple recordings', async () => {
    const line1 = JSON.stringify(validRecording({ score: 100, wave: 2 }))
    const line2 = JSON.stringify(validRecording({ score: 300, wave: 5 }))
    const line3 = JSON.stringify(validRecording({ score: 200, wave: 3 }))
    mockReadFile.mockResolvedValue(`${line1}\n${line2}\n${line3}\n`)

    const result = await caller.exportBenchmarks({ playerId: 'player1' })

    expect(result.playerId).toBe('player1')
    const stats = result.seeds['benchmark-001']
    expect(stats).toBeDefined()
    expect(stats!.bestScore).toBe(300)
    expect(stats!.avgScore).toBe(200)
    expect(stats!.attempts).toBe(3)
    expect(stats!.bestWave).toBe(5)
  })

  test('skips seeds with no recording file (ENOENT)', async () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    mockReadFile.mockRejectedValue(err)

    const result = await caller.exportBenchmarks({ playerId: 'player1' })

    expect(result.seeds).toEqual({})
  })

  test('defaults score and wave to 0 for recordings missing those fields', async () => {
    // Recording without score/wave (legacy format)
    const line = JSON.stringify(validRecording())
    mockReadFile.mockResolvedValue(`${line}\n`)

    const result = await caller.exportBenchmarks({ playerId: 'player1' })

    const stats = result.seeds['benchmark-001']
    expect(stats).toBeDefined()
    expect(stats!.bestScore).toBe(0)
    expect(stats!.avgScore).toBe(0)
    expect(stats!.attempts).toBe(1)
    expect(stats!.bestWave).toBe(0)
  })

  test('skips invalid JSON lines and still aggregates valid ones', async () => {
    const validLine = JSON.stringify(validRecording({ score: 50, wave: 1 }))
    mockReadFile.mockResolvedValue(`{bad json}\n${validLine}\n`)

    const result = await caller.exportBenchmarks({ playerId: 'player1' })

    const stats = result.seeds['benchmark-001']
    expect(stats).toBeDefined()
    expect(stats!.attempts).toBe(1)
    expect(stats!.bestScore).toBe(50)
  })
})
