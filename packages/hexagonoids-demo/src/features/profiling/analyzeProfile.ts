/**
 * V8 CPU profile analysis — produces JSONL bottleneck records.
 *
 * Ported from packages/demo/src/features/profile/index.ts.
 * Designed for LLM-friendly output: each record is a self-contained JSON line
 * with scoring, classification, call paths, and child breakdown.
 */

import { relative } from 'node:path'

const RUNTIME_NAMES = new Set(['(idle)', '(program)', '(root)', ''])

// --- Types ---

interface ProfileCallFrame {
  functionName: string
  url: string
  lineNumber: number
  columnNumber: number
}

interface ProfileNode {
  id: number
  callFrame: ProfileCallFrame
  children?: number[]
}

interface CpuProfile {
  nodes: ProfileNode[]
  samples: number[]
  timeDeltas: number[]
}

interface NodeMetrics {
  id: number
  callFrame: ProfileCallFrame
  selfUs: number
  totalUs: number
  childTotals: Map<number, number>
}

type BottleneckKind =
  | 'leaf'
  | 'hot-loop'
  | 'gc-pressure'
  | 'serialization'
  | 'mixed'

export interface BottleneckRecord {
  rank: number
  kind: BottleneckKind
  function: string
  file: string
  line: number
  selfMs: number
  totalMs: number
  selfPct: number
  totalPct: number
  exclusivePct: number
  maxChildPct: number
  score: number
  callPaths: string[][]
  children: Array<{ function: string; totalMs: number; pct: number }>
}

// --- Path normalization ---

function normalizeFilePath(url: string): string {
  if (!url) return ''
  let p = url
  if (p.startsWith('file://')) {
    p = p.slice(7)
  }
  const packagesIndex = p.indexOf('packages/')
  if (packagesIndex >= 0) {
    p = p.slice(packagesIndex)
  } else {
    try {
      p = relative(process.cwd(), p)
    } catch {
      // keep as-is
    }
  }
  p = p.replace(/\/dist\/(?:esm|cjs)\//, '/src/')
  p = p.replace(/\.js$/, '.ts')
  return p
}

// --- Classification ---

function classifyKind(
  fn: string,
  exclusivePct: number,
  childCount: number
): BottleneckKind {
  if (fn === '(garbage collector)') return 'gc-pressure'
  if (fn === 'postMessage' || fn === 'structuredClone') return 'serialization'
  if (exclusivePct >= 0.8) return 'leaf'
  if (exclusivePct >= 0.25 && childCount > 0) return 'hot-loop'
  return 'mixed'
}

function functionKey(callFrame: ProfileCallFrame): string {
  return `${callFrame.functionName}|${callFrame.url}|${callFrame.lineNumber}`
}

// --- Rounding ---

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

// --- Main analysis ---

export function analyzeProfile(
  profileJson: string,
  topN = 20,
  threshold = 0.01
): BottleneckRecord[] {
  const profile: CpuProfile = JSON.parse(profileJson)
  const { nodes, samples, timeDeltas } = profile

  // Build maps
  const nodeById = new Map<number, ProfileNode>()
  const parentById = new Map<number, number>()
  for (const node of nodes) {
    nodeById.set(node.id, node)
    if (node.children) {
      for (const childId of node.children) {
        parentById.set(childId, node.id)
      }
    }
  }

  // Accumulate per-node times
  const metrics = new Map<number, NodeMetrics>()
  function getMetrics(id: number): NodeMetrics {
    let m = metrics.get(id)
    if (m) return m
    const node = nodeById.get(id)
    const callFrame = node
      ? node.callFrame
      : { functionName: '', url: '', lineNumber: 0, columnNumber: 0 }
    m = { id, callFrame, selfUs: 0, totalUs: 0, childTotals: new Map() }
    metrics.set(id, m)
    return m
  }

  let totalUs = 0
  for (let i = 0; i < samples.length; i++) {
    const leafId = samples[i]
    if (leafId === undefined) continue
    const deltaUs = timeDeltas[i] ?? 0
    totalUs += deltaUs

    const leafMetrics = getMetrics(leafId)
    leafMetrics.selfUs += deltaUs

    let currentId: number | undefined = leafId
    while (currentId !== undefined) {
      const m = getMetrics(currentId)
      m.totalUs += deltaUs
      currentId = parentById.get(currentId)
    }
  }

  // Build child totals per parent
  for (const [childId, parentId] of parentById) {
    const childMetrics = metrics.get(childId)
    if (!childMetrics || childMetrics.totalUs <= 0) continue
    const parentMetrics = metrics.get(parentId)
    if (!parentMetrics) continue
    const existing = parentMetrics.childTotals.get(childId) ?? 0
    parentMetrics.childTotals.set(childId, existing + childMetrics.totalUs)
  }

  const totalMs = totalUs / 1000

  // Aggregate by function+file
  interface FunctionAggregate {
    callFrame: ProfileCallFrame
    selfUs: number
    totalUs: number
    childByFunction: Map<string, { name: string; totalUs: number }>
    callPaths: string[][]
  }

  const aggregates = new Map<string, FunctionAggregate>()

  for (const m of metrics.values()) {
    const fn = m.callFrame.functionName
    if (RUNTIME_NAMES.has(fn) && fn !== '(garbage collector)') continue

    const key = functionKey(m.callFrame)
    let agg = aggregates.get(key)
    if (!agg) {
      agg = {
        callFrame: m.callFrame,
        selfUs: 0,
        totalUs: 0,
        childByFunction: new Map(),
        callPaths: [],
      }
      aggregates.set(key, agg)
    }

    agg.selfUs += m.selfUs
    agg.totalUs += m.totalUs

    for (const [childId, childUs] of m.childTotals) {
      const childNode = nodeById.get(childId)
      if (!childNode) continue
      const childName = childNode.callFrame.functionName
      if (!childName || RUNTIME_NAMES.has(childName)) continue
      const childKey = functionKey(childNode.callFrame)
      const existing = agg.childByFunction.get(childKey)
      if (existing) {
        existing.totalUs += childUs
      } else {
        agg.childByFunction.set(childKey, {
          name: childName,
          totalUs: childUs,
        })
      }
    }

    const path: string[] = []
    let walkId: number | undefined = m.id
    while (walkId !== undefined) {
      const node = nodeById.get(walkId)
      if (node) {
        const name = node.callFrame.functionName
        if (!RUNTIME_NAMES.has(name)) {
          path.unshift(name)
        }
      }
      walkId = parentById.get(walkId)
    }
    if (
      agg.callPaths.length < 3 &&
      !agg.callPaths.some((p) => p.join('->') === path.join('->'))
    ) {
      agg.callPaths.push(path)
    }
  }

  // Build bottleneck records
  const records: BottleneckRecord[] = []

  for (const agg of aggregates.values()) {
    const fn = agg.callFrame.functionName
    const selfMs = agg.selfUs / 1000
    const aggTotalMs = agg.totalUs / 1000
    const selfPct = selfMs / Math.max(totalMs, 1)
    const totalPct = aggTotalMs / Math.max(totalMs, 1)

    if (totalPct < threshold) continue

    const exclusivePct = aggTotalMs > 0 ? selfMs / aggTotalMs : 0

    const isGc = fn === '(garbage collector)'
    if (!isGc && (selfMs < 0.5 || exclusivePct < 0.05)) continue

    const childEntries: Array<{
      function: string
      totalMs: number
      pct: number
    }> = []
    for (const child of agg.childByFunction.values()) {
      const childTotalMs = child.totalUs / 1000
      childEntries.push({
        function: child.name,
        totalMs: round2(childTotalMs),
        pct: round3(aggTotalMs > 0 ? childTotalMs / aggTotalMs : 0),
      })
    }
    childEntries.sort((a, b) => b.totalMs - a.totalMs)

    const maxChildPct =
      childEntries.length > 0 && aggTotalMs > 0
        ? (childEntries[0]?.totalMs ?? 0) / aggTotalMs
        : 0

    const score = selfMs * (0.35 + exclusivePct)

    const kind = classifyKind(fn, exclusivePct, childEntries.length)

    records.push({
      rank: 0,
      kind,
      function: fn,
      file: normalizeFilePath(agg.callFrame.url),
      line: agg.callFrame.lineNumber + 1,
      selfMs: round2(selfMs),
      totalMs: round2(aggTotalMs),
      selfPct: round3(selfPct),
      totalPct: round3(totalPct),
      exclusivePct: round3(exclusivePct),
      maxChildPct: round3(maxChildPct),
      score: round1(score),
      callPaths: agg.callPaths,
      children: childEntries.slice(0, 5),
    })
  }

  records.sort((a, b) => b.score - a.score)
  const topRecords = records.slice(0, topN)

  for (let i = 0; i < topRecords.length; i++) {
    const record = topRecords[i]
    if (!record) continue
    record.rank = i + 1
  }

  return topRecords
}

// --- Heap profile analysis ---

interface HeapNode {
  callFrame: ProfileCallFrame
  selfSize: number
  id: number
  children?: HeapNode[]
}

interface HeapProfile {
  head: HeapNode
}

type HeapKind = 'alloc-leaf' | 'alloc-tree' | 'builtin' | 'mixed'

export interface HeapRecord {
  rank: number
  kind: HeapKind
  function: string
  file: string
  line: number
  selfKB: number
  totalKB: number
  selfPct: number
  totalPct: number
  exclusivePct: number
  score: number
  callPaths: string[][]
  children: Array<{ function: string; totalKB: number; pct: number }>
}

function classifyHeapKind(
  fn: string,
  file: string,
  exclusivePct: number,
  childCount: number
): HeapKind {
  if (
    !file &&
    (fn === 'Map' ||
      fn === 'Set' ||
      fn === 'set' ||
      fn === 'add' ||
      fn === 'get' ||
      fn === 'next' ||
      fn === 'delete' ||
      fn === '(V8 API)')
  ) {
    return 'builtin'
  }
  if (exclusivePct >= 0.8) return 'alloc-leaf'
  if (childCount > 0 && exclusivePct >= 0.1) return 'alloc-tree'
  return 'mixed'
}

export function analyzeHeapProfile(
  profileJson: string,
  topN = 20,
  threshold = 0.01
): HeapRecord[] {
  const profile: HeapProfile = JSON.parse(profileJson)

  interface HeapMetrics {
    callFrame: ProfileCallFrame
    selfBytes: number
    totalBytes: number
    childByFunction: Map<string, { name: string; totalBytes: number }>
    callPaths: string[][]
  }

  const aggregates = new Map<string, HeapMetrics>()
  let grandTotal = 0

  function walk(node: HeapNode, pathSoFar: string[]): number {
    const fn = node.callFrame.functionName || ''
    const skipName = fn === '(root)'
    const path = skipName ? pathSoFar : [...pathSoFar, fn]

    let childrenTotal = 0
    const childTotals = new Map<string, { name: string; totalBytes: number }>()

    if (node.children) {
      for (const child of node.children) {
        const childTotal = walk(child, path)
        childrenTotal += childTotal

        const childFn = child.callFrame.functionName || '(anonymous)'
        const childKey = functionKey(child.callFrame)
        const existing = childTotals.get(childKey)
        if (existing) {
          existing.totalBytes += childTotal
        } else {
          childTotals.set(childKey, { name: childFn, totalBytes: childTotal })
        }
      }
    }

    const selfBytes = node.selfSize || 0
    const totalBytes = selfBytes + childrenTotal
    grandTotal += selfBytes

    if (skipName || totalBytes === 0) return totalBytes

    const key = functionKey(node.callFrame)
    let agg = aggregates.get(key)
    if (!agg) {
      agg = {
        callFrame: node.callFrame,
        selfBytes: 0,
        totalBytes: 0,
        childByFunction: new Map(),
        callPaths: [],
      }
      aggregates.set(key, agg)
    }

    agg.selfBytes += selfBytes
    agg.totalBytes += totalBytes

    for (const [childKey, childInfo] of childTotals) {
      const existing = agg.childByFunction.get(childKey)
      if (existing) {
        existing.totalBytes += childInfo.totalBytes
      } else {
        agg.childByFunction.set(childKey, { ...childInfo })
      }
    }

    const trimmedPath = path.length > 6 ? path.slice(-6) : path
    if (
      agg.callPaths.length < 3 &&
      !agg.callPaths.some((p) => p.join('->') === trimmedPath.join('->'))
    ) {
      agg.callPaths.push(trimmedPath)
    }

    return totalBytes
  }

  walk(profile.head, [])

  const records: HeapRecord[] = []

  for (const agg of aggregates.values()) {
    const fn = agg.callFrame.functionName || '(anonymous)'
    if (RUNTIME_NAMES.has(fn)) continue

    const selfKB = agg.selfBytes / 1024
    const totalKB = agg.totalBytes / 1024
    const grandTotalKB = grandTotal / 1024
    const selfPct = selfKB / Math.max(grandTotalKB, 1)
    const totalPct = totalKB / Math.max(grandTotalKB, 1)

    if (totalPct < threshold) continue
    if (selfKB < 1 && totalKB < 32) continue

    const exclusivePct = totalKB > 0 ? selfKB / totalKB : 0

    const childEntries: Array<{
      function: string
      totalKB: number
      pct: number
    }> = []
    for (const child of agg.childByFunction.values()) {
      const childKB = child.totalBytes / 1024
      if (childKB < 1) continue
      childEntries.push({
        function: child.name,
        totalKB: round1(childKB),
        pct: round3(totalKB > 0 ? childKB / totalKB : 0),
      })
    }
    childEntries.sort((a, b) => b.totalKB - a.totalKB)

    const file = normalizeFilePath(agg.callFrame.url)
    const kind = classifyHeapKind(fn, file, exclusivePct, childEntries.length)
    const score = selfKB * (0.35 + exclusivePct)

    records.push({
      rank: 0,
      kind,
      function: fn,
      file,
      line: agg.callFrame.lineNumber + 1,
      selfKB: round1(selfKB),
      totalKB: round1(totalKB),
      selfPct: round3(selfPct),
      totalPct: round3(totalPct),
      exclusivePct: round3(exclusivePct),
      score: round1(score),
      callPaths: agg.callPaths,
      children: childEntries.slice(0, 5),
    })
  }

  records.sort((a, b) => b.score - a.score)
  const topRecords = records.slice(0, topN)

  for (let i = 0; i < topRecords.length; i++) {
    const record = topRecords[i]
    if (!record) continue
    record.rank = i + 1
  }

  return topRecords
}
