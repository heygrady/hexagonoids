import type { SerializedGenome } from '../../registries/algorithmRegistry.js'

export const SERIALIZED_ORGANISM_KIND = 'SerializedOrganism' as const
export const SERIALIZED_ORGANISM_VERSION = 1 as const

type SerializedOrganismState = {
  generation?: number | undefined
  fitness?: number | undefined
  adjustedFitness?: number | undefined
}

export type SerializedOrganism = {
  __kind: typeof SERIALIZED_ORGANISM_KIND
  version: typeof SERIALIZED_ORGANISM_VERSION
  genome: SerializedGenome
  organismState?: SerializedOrganismState
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object'
}

export const isSerializedOrganism = (
  value: unknown
): value is SerializedOrganism => {
  if (!isRecord(value)) {
    return false
  }
  if (value.__kind !== SERIALIZED_ORGANISM_KIND) {
    return false
  }
  if (value.version !== SERIALIZED_ORGANISM_VERSION) {
    return false
  }
  const genome = value.genome
  if (!isRecord(genome)) {
    return false
  }
  if (!isRecord(genome.config) || !isRecord(genome.state)) {
    return false
  }
  if (!('factoryOptions' in genome)) {
    return false
  }
  return true
}

export const assertSerializedOrganism: (
  value: unknown,
  pathname: string
) => asserts value is SerializedOrganism = (value, pathname) => {
  if (!isRecord(value)) {
    throw new Error(
      `Genome file "${pathname}" must contain a JSON object at the root.`
    )
  }
  if (value.__kind !== SERIALIZED_ORGANISM_KIND) {
    throw new Error(
      `Genome file "${pathname}" is missing required "__kind" marker.`
    )
  }
  if (value.version !== SERIALIZED_ORGANISM_VERSION) {
    throw new Error(`Genome file "${pathname}" has unsupported version.`)
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
  if (!('factoryOptions' in genome)) {
    throw new Error(
      `Genome file "${pathname}" is missing required "genome.factoryOptions".`
    )
  }
}

export const ensureSerializedOrganismMarker = (value: unknown): unknown => {
  if (!isRecord(value)) {
    return value
  }
  return {
    ...value,
    __kind: SERIALIZED_ORGANISM_KIND,
    version: SERIALIZED_ORGANISM_VERSION,
  }
}
