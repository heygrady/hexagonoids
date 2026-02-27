import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '..')
const defaultPath = resolve(packageRoot, '.artifacts/worker-stage.jsonl')

function parseArgs(argv) {
  const args = argv.filter((arg) => arg !== '--')
  const options = {
    input: args[0] ? resolve(process.cwd(), args[0]) : defaultPath,
  }
  return options
}

function parseJsonl(path) {
  const text = readFileSync(path, 'utf8')
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return lines.map((line) => JSON.parse(line))
}

function pct(part, total) {
  if (total <= 0) return 0
  return (part / total) * 100
}

function summarizeByWorker(entries) {
  const latestByWorker = new Map()
  for (const entry of entries) {
    const workerId = `${entry.pid}:${entry.workerThreadId ?? 0}`
    const current = latestByWorker.get(workerId)
    if (current == null || entry.games > current.games) {
      latestByWorker.set(workerId, entry)
    }
  }
  return Array.from(latestByWorker.values())
}

function run() {
  const { input } = parseArgs(process.argv.slice(2))
  const entries = parseJsonl(input).filter(
    (entry) => entry.kind === 'hexagonoids-sim-profile'
  )
  if (entries.length === 0) {
    console.log(`No simulation profile entries found in ${input}`)
    return
  }

  const workerSummaries = summarizeByWorker(entries)
  const aggregate = {
    games: 0,
    ticks: 0,
    totalMs: 0,
    agentMs: 0,
    stepMs: 0,
    rewardMs: 0,
    memoryMs: 0,
  }

  for (const worker of workerSummaries) {
    aggregate.games += worker.games
    aggregate.ticks += worker.ticks
    aggregate.totalMs += worker.totalMs
    aggregate.agentMs += worker.stagesMs.agent
    aggregate.stepMs += worker.stagesMs.step
    aggregate.rewardMs += worker.stagesMs.reward
    aggregate.memoryMs += worker.stagesMs.memory
  }

  console.log(`Input: ${input}`)
  console.log(`Workers detected: ${workerSummaries.length}`)

  console.table(
    workerSummaries.map((worker) => ({
      Worker: `${worker.pid}:${worker.workerThreadId ?? 0}`,
      Games: worker.games,
      Ticks: worker.ticks,
      'Total ms': Number(worker.totalMs.toFixed(2)),
      'Agent %': Number(pct(worker.stagesMs.agent, worker.totalMs).toFixed(2)),
      'Step %': Number(pct(worker.stagesMs.step, worker.totalMs).toFixed(2)),
      'Reward %': Number(
        pct(worker.stagesMs.reward, worker.totalMs).toFixed(2)
      ),
      'Memory %': Number(
        pct(worker.stagesMs.memory, worker.totalMs).toFixed(2)
      ),
      'ms/tick': Number(
        (worker.ticks > 0 ? worker.totalMs / worker.ticks : 0).toFixed(4)
      ),
    }))
  )

  console.log('Aggregate:')
  console.table([
    {
      Workers: workerSummaries.length,
      Games: aggregate.games,
      Ticks: aggregate.ticks,
      'Total ms': Number(aggregate.totalMs.toFixed(2)),
      'Agent %': Number(pct(aggregate.agentMs, aggregate.totalMs).toFixed(2)),
      'Step %': Number(pct(aggregate.stepMs, aggregate.totalMs).toFixed(2)),
      'Reward %': Number(pct(aggregate.rewardMs, aggregate.totalMs).toFixed(2)),
      'Memory %': Number(pct(aggregate.memoryMs, aggregate.totalMs).toFixed(2)),
      'ms/tick': Number(
        (aggregate.ticks > 0 ? aggregate.totalMs / aggregate.ticks : 0).toFixed(
          4
        )
      ),
    },
  ])
}

run()
