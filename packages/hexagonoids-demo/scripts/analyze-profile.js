import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '..')
const repoRoot = resolve(packageRoot, '..', '..')
const defaultProfilePath = join(
  packageRoot,
  '.artifacts/cpuprofiles/latest.cpuprofile'
)

function resolveInputPath(inputPath) {
  if (!inputPath) return defaultProfilePath
  const candidates = [
    resolve(process.cwd(), inputPath),
    resolve(packageRoot, inputPath),
    resolve(repoRoot, inputPath),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return resolve(process.cwd(), inputPath)
}

function parseArgs(argv) {
  const args = argv.filter((arg) => arg !== '--')
  let profileArg = ''
  const flagStartIndex =
    args.findIndex((arg) => arg.startsWith('--')) >= 0
      ? args.findIndex((arg) => arg.startsWith('--'))
      : args.length
  if (flagStartIndex > 0) {
    profileArg = args[0]
  }
  const options = {
    profilePath: resolveInputPath(profileArg),
    top: 30,
    summaryPath: '',
    includeRuntime: false,
    sort: 'total',
    repoOnly: false,
    workerCpuProfileDir: '',
    noWorkerProfile: false,
  }

  for (let i = profileArg ? 1 : 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--top' && args[i + 1]) {
      options.top = Number(args[++i]) || options.top
    } else if (arg === '--summary' && args[i + 1]) {
      options.summaryPath = resolve(process.cwd(), args[++i])
    } else if (arg === '--include-runtime') {
      options.includeRuntime = true
    } else if (arg === '--sort' && args[i + 1]) {
      const sortMode = args[++i]
      options.sort = sortMode === 'self' ? 'self' : 'total'
    } else if (arg === '--repo-only') {
      options.repoOnly = true
    } else if (arg === '--worker-cpu-profile-dir' && args[i + 1]) {
      options.workerCpuProfileDir = resolveInputPath(args[++i])
    } else if (arg === '--no-worker-profile') {
      options.noWorkerProfile = true
    }
  }

  return options
}

function normalizeSourcePath(url) {
  if (!url) return ''
  if (url.startsWith('file://')) {
    try {
      return fileURLToPath(url)
    } catch {
      return url
    }
  }
  return url
}

function formatLabel(callFrame) {
  const fn = callFrame.functionName || '(anonymous)'
  const sourcePath = normalizeSourcePath(callFrame.url)
  const isRepoPath = isAbsolute(sourcePath) && sourcePath.startsWith(repoRoot)
  const source = isRepoPath
    ? relative(repoRoot, sourcePath)
    : basename(sourcePath)
  const line = callFrame.lineNumber ? callFrame.lineNumber + 1 : 0
  return source && line > 0 ? `${fn} (${source}:${line})` : fn
}

function analyzeCpuprofile(profile) {
  const nodes = profile.nodes || []
  const samples = profile.samples || []
  const timeDeltas = profile.timeDeltas || []

  const nodeById = new Map()
  const parentById = new Map()
  for (const node of nodes) {
    nodeById.set(node.id, node)
    const children = node.children || []
    for (const childId of children) {
      parentById.set(childId, node.id)
    }
  }

  const ancestorCache = new Map()
  function ancestors(nodeId) {
    if (ancestorCache.has(nodeId)) return ancestorCache.get(nodeId)
    const chain = []
    let currentId = nodeId
    while (currentId !== undefined) {
      chain.push(currentId)
      const parentId = parentById.get(currentId)
      currentId = parentId
    }
    ancestorCache.set(nodeId, chain)
    return chain
  }

  const byFunction = new Map()
  function upsert(key, label, sourcePath) {
    const entry = byFunction.get(key) || {
      function: label,
      sourcePath,
      key,
      selfSamples: 0,
      selfMs: 0,
      totalSamples: 0,
      totalMs: 0,
    }
    byFunction.set(key, entry)
    return entry
  }

  for (let i = 0; i < samples.length; i++) {
    const nodeId = samples[i]
    const deltaUs = timeDeltas[i] || 0
    const deltaMs = deltaUs / 1000

    const selfNode = nodeById.get(nodeId)
    if (!selfNode) continue
    const selfLabel = formatLabel(selfNode.callFrame)
    const selfSourcePath = normalizeSourcePath(selfNode.callFrame.url)
    const selfKey = `${selfNode.callFrame.functionName || '(anonymous)'}|${selfSourcePath}|${selfNode.callFrame.lineNumber || 0}|${selfNode.callFrame.columnNumber || 0}`
    const selfEntry = upsert(selfKey, selfLabel, selfSourcePath)
    selfEntry.selfSamples += 1
    selfEntry.selfMs += deltaMs

    const chain = ancestors(nodeId)
    for (const ancestorId of chain) {
      const ancestorNode = nodeById.get(ancestorId)
      if (!ancestorNode) continue
      const label = formatLabel(ancestorNode.callFrame)
      const sourcePath = normalizeSourcePath(ancestorNode.callFrame.url)
      const key = `${ancestorNode.callFrame.functionName || '(anonymous)'}|${sourcePath}|${ancestorNode.callFrame.lineNumber || 0}|${ancestorNode.callFrame.columnNumber || 0}`
      const entry = upsert(key, label, sourcePath)
      entry.totalSamples += 1
      entry.totalMs += deltaMs
    }
  }

  const totalMs = timeDeltas.reduce((sum, value) => sum + value, 0) / 1000
  const rows = Array.from(byFunction.values()).sort(
    (a, b) => b.selfMs - a.selfMs
  )
  return { totalMs, rows }
}

function parseCpuprofileContent(content) {
  const parsed = JSON.parse(content)
  return typeof parsed === 'string' ? JSON.parse(parsed) : parsed
}

function run() {
  const {
    profilePath,
    top,
    summaryPath,
    includeRuntime,
    sort,
    repoOnly,
    workerCpuProfileDir,
    noWorkerProfile,
  } = parseArgs(process.argv.slice(2))
  const content = readFileSync(profilePath, 'utf8')
  const profile = parseCpuprofileContent(content)
  const { totalMs, rows } = analyzeCpuprofile(profile)
  const filteredBase = includeRuntime
    ? rows
    : rows.filter(
        (row) =>
          row.function !== '(idle)' &&
          row.function !== '(program)' &&
          row.function !== '(root)'
      )
  const repoFiltered = repoOnly
    ? filteredBase.filter(
        (row) =>
          isAbsolute(row.sourcePath) &&
          row.sourcePath.startsWith(repoRoot) &&
          !row.sourcePath.includes('/node_modules/')
      )
    : filteredBase
  const sorted =
    sort === 'self'
      ? repoFiltered.sort((a, b) => b.selfMs - a.selfMs)
      : repoFiltered.sort((a, b) => b.totalMs - a.totalMs)
  const topRows = sorted.slice(0, top)

  console.log(`Analyzed: ${profilePath}`)
  console.log(`Total sampled time: ${totalMs.toFixed(1)} ms`)
  console.table(
    topRows.map((row) => ({
      Function:
        row.function.length > 100
          ? `${row.function.slice(0, 97)}...`
          : row.function,
      'Self ms': Number(row.selfMs.toFixed(2)),
      'Self %': Number(((row.selfMs / totalMs) * 100).toFixed(2)),
      'Total ms': Number(row.totalMs.toFixed(2)),
      'Total %': Number(((row.totalMs / totalMs) * 100).toFixed(2)),
      'Self Samples': row.selfSamples,
      'Total Samples': row.totalSamples,
    }))
  )

  const outputPath =
    summaryPath || profilePath.replace(/\.cpuprofile$/u, '.summary.json')
  const defaultWorkerCpuProfileDir = profilePath.replace(
    /\.cpuprofile$/u,
    '.workers'
  )
  const resolvedWorkerCpuProfileDir =
    workerCpuProfileDir || resolveInputPath(defaultWorkerCpuProfileDir)
  let workerCpuSummary = null
  if (!noWorkerProfile && existsSync(resolvedWorkerCpuProfileDir)) {
    const workerProfilePaths = readdirSync(resolvedWorkerCpuProfileDir)
      .filter((name) => name.endsWith('.cpuprofile'))
      .sort()
      .map((name) => join(resolvedWorkerCpuProfileDir, name))

    if (workerProfilePaths.length > 0) {
      const aggregateByFunction = new Map()
      let workerTotalMs = 0

      for (const pathname of workerProfilePaths) {
        const content = readFileSync(pathname, 'utf8')
        const profile = parseCpuprofileContent(content)
        const { totalMs: profileTotalMs, rows: profileRows } =
          analyzeCpuprofile(profile)
        workerTotalMs += profileTotalMs

        for (const row of profileRows) {
          const current = aggregateByFunction.get(row.key) || {
            function: row.function,
            sourcePath: row.sourcePath,
            selfSamples: 0,
            selfMs: 0,
            totalSamples: 0,
            totalMs: 0,
          }
          current.selfSamples += row.selfSamples
          current.selfMs += row.selfMs
          current.totalSamples += row.totalSamples
          current.totalMs += row.totalMs
          aggregateByFunction.set(row.key, current)
        }
      }

      const workerRows = [...aggregateByFunction.values()]
      const filteredWorkerRows = includeRuntime
        ? workerRows
        : workerRows.filter(
            (row) =>
              row.function !== '(idle)' &&
              row.function !== '(program)' &&
              row.function !== '(root)'
          )
      const repoFilteredWorkerRows = repoOnly
        ? filteredWorkerRows.filter(
            (row) =>
              isAbsolute(row.sourcePath) &&
              row.sourcePath.startsWith(repoRoot) &&
              !row.sourcePath.includes('/node_modules/')
          )
        : filteredWorkerRows
      const sortedWorkerRows =
        sort === 'self'
          ? repoFilteredWorkerRows.sort((a, b) => b.selfMs - a.selfMs)
          : repoFilteredWorkerRows.sort((a, b) => b.totalMs - a.totalMs)
      const topWorkerRows = sortedWorkerRows.slice(0, top)

      console.log(`Worker CPU profiles: ${resolvedWorkerCpuProfileDir}`)
      console.log(
        `Aggregated worker sampled time: ${workerTotalMs.toFixed(1)} ms`
      )
      console.table(
        topWorkerRows.map((row) => ({
          Function:
            row.function.length > 100
              ? `${row.function.slice(0, 97)}...`
              : row.function,
          'Self ms': Number(row.selfMs.toFixed(2)),
          'Self %': Number(
            ((row.selfMs / Math.max(workerTotalMs, 1)) * 100).toFixed(2)
          ),
          'Total ms': Number(row.totalMs.toFixed(2)),
          'Total %': Number(
            ((row.totalMs / Math.max(workerTotalMs, 1)) * 100).toFixed(2)
          ),
          'Self Samples': row.selfSamples,
          'Total Samples': row.totalSamples,
        }))
      )

      workerCpuSummary = {
        path: resolvedWorkerCpuProfileDir,
        profiles: workerProfilePaths,
        totalMs: workerTotalMs,
        top: topWorkerRows,
      }
    }
  }
  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        profilePath,
        totalMs,
        top: topRows,
        workerCpuSummary,
      },
      null,
      2
    )
  )
  console.log(`Summary written: ${outputPath}`)
}

run()
