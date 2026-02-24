import { readFileSync } from 'node:fs'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value != null
}

function assertSerializedOrganismShape(
  value: unknown,
  pathname: string
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(
      `Genome file "${pathname}" must contain a JSON object at the root.`
    )
  }

  const genome = value.genome
  if (!isRecord(genome)) {
    throw new Error(
      `Genome file "${pathname}" is missing required "genome" object.`
    )
  }

  if (!isRecord(genome.config)) {
    throw new Error(
      `Genome file "${pathname}" is missing required "genome.config" object.`
    )
  }

  if (!isRecord(genome.state)) {
    throw new Error(
      `Genome file "${pathname}" is missing required "genome.state" object.`
    )
  }
}

export function loadGenome(pathname: string): unknown {
  let raw = ''
  try {
    raw = readFileSync(pathname, 'utf8')
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to read genome file "${pathname}": ${reason}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse genome JSON at "${pathname}": ${reason}`)
  }

  assertSerializedOrganismShape(parsed, pathname)
  return parsed
}
