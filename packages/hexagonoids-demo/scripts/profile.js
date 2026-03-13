import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '..')
const distTrain = resolve(packageRoot, 'dist/esm/train.js')

function parseArgs(argv) {
  const args = argv.filter((arg) => arg !== '--')
  const options = {
    outputDir: '.artifacts/cpuprofiles',
    name: `hexagonoids-${new Date().toISOString().replace(/[:.]/g, '-')}.cpuprofile`,
    trainArgs: [],
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--output-dir' && args[i + 1]) {
      options.outputDir = args[++i]
      continue
    }
    if (arg === '--name' && args[i + 1]) {
      options.name = args[++i]
      continue
    }
    options.trainArgs.push(arg)
  }

  return options
}

function run(command, args, cwd = packageRoot) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function ensureBuild() {
  if (existsSync(distTrain)) {
    return
  }
  console.log('Build missing, running build...')
  run('yarn', ['build'])
}

function main() {
  const { outputDir, name, trainArgs } = parseArgs(process.argv.slice(2))
  const profileDir = resolve(packageRoot, outputDir)
  const profilePath = join(profileDir, name)
  const workerProfileDir = profilePath.replace(/\.cpuprofile$/u, '.workers')
  const targetScript = resolve(packageRoot, 'scripts/profile-target.js')
  const analyzeScript = resolve(packageRoot, 'scripts/analyze-profile.js')

  mkdirSync(profileDir, { recursive: true })
  ensureBuild()

  console.log(`CPU profile output: ${profilePath}`)
  console.log(`Worker CPU profile dir: ${workerProfileDir}`)
  run(process.execPath, [
    targetScript,
    '--profileOutput',
    profilePath,
    '--workerCpuProfiles',
    '--workerCpuProfileDir',
    workerProfileDir,
    ...trainArgs,
  ])

  console.log(`Profile saved: ${profilePath}`)
  console.log('\nAnalyzing profile...')
  run(process.execPath, [
    analyzeScript,
    profilePath,
    '--worker-cpu-profile-dir',
    workerProfileDir,
  ])
}

main()
