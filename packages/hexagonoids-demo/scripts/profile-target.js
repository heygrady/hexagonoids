import { mkdirSync, writeFileSync } from 'node:fs'
import inspector from 'node:inspector'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '..')

function parseArgs(argv) {
  const args = argv.filter((arg) => arg !== '--')
  const options = {
    method: 'HyperNEAT',
    populationSize: 32,
    iterations: 1,
    earlyStopPatience: 999,
    evaluationSeedsPerOrganism: 1,
    baseSeed: 'perf-profile-v1',
    maxTicks: 400,
    dtMs: 33,
    threadCount: 1,
    curriculumEnabled: true,
    curriculumCount: 32,
    scenarioMode: true,
    scenariosPerOrganism: 64,
    scenarioMaxTicks: 32,
    scenarioWeight: 0.15,
    fullGameWeight: 0.05,
    curriculumWeight: 0.8,
    outputDir: '.artifacts/profile-output',
    profileOutput: '.artifacts/cpuprofiles/latest.cpuprofile',
    workerCpuProfiles: false,
    workerCpuProfileDir: '.artifacts/cpuprofiles/latest.workers',
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--method' && args[i + 1]) options.method = args[++i]
    else if (arg === '--populationSize' && args[i + 1])
      options.populationSize = Number(args[++i])
    else if (arg === '--iterations' && args[i + 1])
      options.iterations = Number(args[++i])
    else if (arg === '--earlyStopPatience' && args[i + 1])
      options.earlyStopPatience = Number(args[++i])
    else if (arg === '--evaluationSeedsPerOrganism' && args[i + 1]) {
      options.evaluationSeedsPerOrganism = Number(args[++i])
    } else if (arg === '--baseSeed' && args[i + 1]) options.baseSeed = args[++i]
    else if (arg === '--maxTicks' && args[i + 1])
      options.maxTicks = Number(args[++i])
    else if (arg === '--dtMs' && args[i + 1]) options.dtMs = Number(args[++i])
    else if (arg === '--threadCount' && args[i + 1])
      options.threadCount = Number(args[++i])
    else if (arg === '--outputDir' && args[i + 1]) options.outputDir = args[++i]
    else if (arg === '--profileOutput' && args[i + 1])
      options.profileOutput = args[++i]
    else if (arg === '--workerCpuProfiles') options.workerCpuProfiles = true
    else if (arg === '--workerCpuProfileDir' && args[i + 1]) {
      options.workerCpuProfileDir = args[++i]
    } else if (arg === '--curriculumEnabled') options.curriculumEnabled = true
    else if (arg === '--no-curriculumEnabled') options.curriculumEnabled = false
    else if (arg === '--curriculumCount' && args[i + 1])
      options.curriculumCount = Number(args[++i])
    else if (arg === '--scenarioMode') options.scenarioMode = true
    else if (arg === '--no-scenarioMode') options.scenarioMode = false
    else if (arg === '--scenariosPerOrganism' && args[i + 1])
      options.scenariosPerOrganism = Number(args[++i])
    else if (arg === '--scenarioMaxTicks' && args[i + 1])
      options.scenarioMaxTicks = Number(args[++i])
  }

  options.outputDir = resolve(packageRoot, options.outputDir)
  options.profileOutput = resolve(packageRoot, options.profileOutput)
  options.workerCpuProfileDir = resolve(
    packageRoot,
    options.workerCpuProfileDir
  )
  return options
}

function postAsync(session, method, params = undefined) {
  return new Promise((resolvePromise, rejectPromise) => {
    session.post(method, params, (error, result) => {
      if (error) {
        rejectPromise(error)
        return
      }
      resolvePromise(result)
    })
  })
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  const { profileOutput, ...trainOptions } = options
  const { train } = await import('../dist/esm/train.js')

  mkdirSync(dirname(profileOutput), { recursive: true })
  const session = new inspector.Session()
  session.connect()
  await postAsync(session, 'Profiler.enable')

  console.log('Starting profile target train run...')
  await postAsync(session, 'Profiler.start')
  const result = await train(trainOptions)
  const stopped = await postAsync(session, 'Profiler.stop')
  session.disconnect()

  writeFileSync(profileOutput, JSON.stringify(stopped.profile))
  console.log(`Profile written: ${profileOutput}`)

  if (result.mode === 'training') {
    console.log(`Best fitness: ${result.bestFitness}`)
  }
}

run().catch((error) => {
  console.error('Profile target failed:', error)
  process.exit(1)
})
