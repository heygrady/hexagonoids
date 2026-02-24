const normalizeSeedComponent = (value: string): string => {
  return value.trim().replace(/\s+/g, '-')
}

export function generationSeedPack(
  generation: number,
  seedsPerOrganism: number,
  baseSeed: string
): string[] {
  if (!Number.isInteger(generation) || generation < 0) {
    throw new Error(
      `generation must be a non-negative integer, received ${generation}`
    )
  }
  if (!Number.isInteger(seedsPerOrganism) || seedsPerOrganism <= 0) {
    throw new Error(
      `seedsPerOrganism must be a positive integer, received ${seedsPerOrganism}`
    )
  }

  const normalizedBaseSeed = normalizeSeedComponent(baseSeed)
  if (normalizedBaseSeed.length === 0) {
    throw new Error('baseSeed must not be empty')
  }

  return Array.from({ length: seedsPerOrganism }, (_, index) => {
    return `${normalizedBaseSeed}:g${generation}:s${index}`
  })
}
