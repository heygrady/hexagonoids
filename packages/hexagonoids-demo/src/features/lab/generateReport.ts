import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { LabAnalysis } from './types.js'

function pad(value: string, width: number): string {
  return value.padStart(width)
}

function fmt(value: number, decimals = 3): string {
  return value.toFixed(decimals)
}

function pct(value: number): string {
  return (value * 100).toFixed(1)
}

export async function generateReport(
  analysis: LabAnalysis,
  experimentDir: string
): Promise<{ analysisPath: string; summaryPath: string }> {
  await mkdir(experimentDir, { recursive: true })

  const analysisPath = join(experimentDir, 'analysis.json')
  await writeFile(
    analysisPath,
    `${JSON.stringify(analysis, null, 2)}\n`,
    'utf8'
  )

  const summaryPath = join(experimentDir, 'summary.txt')
  const lines: string[] = []

  const t = analysis.config.trainOptions

  lines.push('Lab Analysis Summary')
  lines.push('====================')
  lines.push('')
  lines.push(`Experiment: ${analysis.config.experimentId}`)
  lines.push(`Method: ${t.method ?? 'HyperNEAT'}`)
  lines.push(`Iterations: ${t.iterations ?? '?'}`)
  lines.push(`Population: ${t.populationSize ?? '?'}`)
  lines.push(`Analysis seeds/genome: ${analysis.config.analysisSeedsPerGenome}`)
  lines.push(`Analysis max ticks: ${analysis.config.analysisMaxTicks}`)
  lines.push('')

  // Header
  const headers = [
    pad('Gen', 4),
    pad('Train', 7),
    pad('Prod', 7),
    pad('Thr%', 6),
    pad('Fir%', 6),
    pad('Lft%', 6),
    pad('Rgt%', 6),
    pad('Entr', 6),
    pad('Dist', 8),
    pad('Cells', 6),
    pad('Idle%', 6),
    pad('Rocks', 6),
    pad('Acc', 6),
    pad('Death', 6),
    pad('Eng%', 6),
  ]

  lines.push(headers.join(' '))
  lines.push('-'.repeat(headers.join(' ').length))

  // Rows
  for (const b of analysis.behaviors) {
    const row = [
      pad(String(b.generation), 4),
      pad(fmt(b.trainingFitness, 4), 7),
      pad(fmt(b.scoring.productionFitness, 4), 7),
      pad(pct(b.action.thrustPct), 6),
      pad(pct(b.action.firePct), 6),
      pad(pct(b.action.leftPct), 6),
      pad(pct(b.action.rightPct), 6),
      pad(fmt(b.action.entropy, 2), 6),
      pad(fmt(b.movement.distanceTraveled, 1), 8),
      pad(String(b.movement.uniqueCells), 6),
      pad(pct(b.movement.idlePct), 6),
      pad(String(b.rocksDestroyed), 6),
      pad(fmt(b.accuracy, 3), 6),
      pad(String(b.deaths), 6),
      pad(pct(b.engagement.framesWithRocksInSOIPct), 6),
    ]
    lines.push(row.join(' '))
  }

  lines.push('')

  // Key observations
  lines.push('Key Observations')
  lines.push('----------------')

  if (analysis.behaviors.length > 0) {
    // Peak fitness
    let peakGen = 0
    let peakFitness = -Infinity
    for (const b of analysis.behaviors) {
      if (b.scoring.productionFitness > peakFitness) {
        peakFitness = b.scoring.productionFitness
        peakGen = b.generation
      }
    }
    lines.push(
      `Peak production fitness: ${fmt(peakFitness, 4)} at generation ${peakGen}`
    )

    // Turtling detection
    const turtleGens: number[] = []
    for (const b of analysis.behaviors) {
      if (b.action.entropy < 1.0 && b.movement.idlePct > 0.8) {
        turtleGens.push(b.generation)
      }
    }
    if (turtleGens.length > 0) {
      lines.push(
        `Turtling detected (entropy < 1.0 + idle > 80%) at generations: ${turtleGens.join(', ')}`
      )
    } else {
      lines.push('No turtling detected.')
    }
  }

  lines.push('')
  await writeFile(summaryPath, lines.join('\n'), 'utf8')

  return { analysisPath, summaryPath }
}
