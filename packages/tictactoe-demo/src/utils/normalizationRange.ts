import fs from 'node:fs/promises'

import type { GlickoObservedRanges } from '@heygrady/tournament-strategy'

import { writeJsonFile } from './writeJsonFile.js'

const normalizationRangesPath = new URL(
  '../../../normalization-ranges.json',
  import.meta.url
).pathname

export async function readObservedRanges(): Promise<GlickoObservedRanges> {
  try {
    const fileContent = await fs.readFile(normalizationRangesPath, 'utf-8')
    const ranges = JSON.parse(fileContent)

    return {
      environmentFitness: {
        min: ranges.environmentFitness?.min ?? null,
        max: ranges.environmentFitness?.max ?? null,
      },
      seedFitness: {
        min: ranges.seedFitness?.min ?? null,
        max: ranges.seedFitness?.max ?? null,
      },
      glickoRating: {
        min: ranges.glickoRating?.min ?? null,
        max: ranges.glickoRating?.max ?? null,
      },
      conservativeRating: {
        min: ranges.conservativeRating?.min ?? null,
        max: ranges.conservativeRating?.max ?? null,
      },
      seedGlickoRating: {
        min: ranges.seedGlickoRating?.min ?? null,
        max: ranges.seedGlickoRating?.max ?? null,
      },
      seedConservativeRating: {
        min: ranges.seedConservativeRating?.min ?? null,
        max: ranges.seedConservativeRating?.max ?? null,
      },
    }
  } catch (error) {
    // File might not exist, so return default wide ranges
    return {
      environmentFitness: { min: null, max: null },
      seedFitness: { min: null, max: null },
      glickoRating: { min: null, max: null },
      conservativeRating: { min: null, max: null },
      seedGlickoRating: { min: null, max: null },
      seedConservativeRating: { min: null, max: null },
    }
  }
}

async function writeObservedRanges(ranges: GlickoObservedRanges) {
  await writeJsonFile(normalizationRangesPath, ranges)
}
export async function clearObservedRanges() {
  await writeJsonFile(normalizationRangesPath, {})
}

export function handleObservedRangeUpdate(
  newObservedRanges: GlickoObservedRanges,
  observedRanges: GlickoObservedRanges
) {
  let needsUpdate = false

  // Track environment fitness (tournament match scores)
  if (
    newObservedRanges.environmentFitness.min != null &&
    newObservedRanges.environmentFitness.min <
      (observedRanges.environmentFitness.min ?? Infinity)
  ) {
    observedRanges.environmentFitness.min =
      newObservedRanges.environmentFitness.min
    needsUpdate = true
  }
  if (
    newObservedRanges.environmentFitness.max != null &&
    newObservedRanges.environmentFitness.max >
      (observedRanges.environmentFitness.max ?? -Infinity)
  ) {
    observedRanges.environmentFitness.max =
      newObservedRanges.environmentFitness.max
    needsUpdate = true
  }

  // Track seed fitness (individual evaluation scores)
  if (
    newObservedRanges.seedFitness.min != null &&
    newObservedRanges.seedFitness.min <
      (observedRanges.seedFitness.min ?? Infinity)
  ) {
    observedRanges.seedFitness.min = newObservedRanges.seedFitness.min
    needsUpdate = true
  }
  if (
    newObservedRanges.seedFitness.max != null &&
    newObservedRanges.seedFitness.max >
      (observedRanges.seedFitness.max ?? -Infinity)
  ) {
    observedRanges.seedFitness.max = newObservedRanges.seedFitness.max
    needsUpdate = true
  }

  // Track Glicko ratings
  if (
    newObservedRanges.glickoRating.min != null &&
    newObservedRanges.glickoRating.min <
      (observedRanges.glickoRating.min ?? Infinity)
  ) {
    observedRanges.glickoRating.min = newObservedRanges.glickoRating.min
    needsUpdate = true
  }
  if (
    newObservedRanges.glickoRating.max != null &&
    newObservedRanges.glickoRating.max >
      (observedRanges.glickoRating.max ?? -Infinity)
  ) {
    observedRanges.glickoRating.max = newObservedRanges.glickoRating.max
    needsUpdate = true
  }

  // Track conservative ratings
  if (
    newObservedRanges.conservativeRating.min != null &&
    newObservedRanges.conservativeRating.min <
      (observedRanges.conservativeRating.min ?? Infinity)
  ) {
    observedRanges.conservativeRating.min =
      newObservedRanges.conservativeRating.min
    needsUpdate = true
  }
  if (
    newObservedRanges.conservativeRating.max != null &&
    newObservedRanges.conservativeRating.max >
      (observedRanges.conservativeRating.max ?? -Infinity)
  ) {
    observedRanges.conservativeRating.max =
      newObservedRanges.conservativeRating.max
    needsUpdate = true
  }

  // Track seed AI Glicko ratings
  if (
    newObservedRanges.seedGlickoRating.min != null &&
    newObservedRanges.seedGlickoRating.min <
      (observedRanges.seedGlickoRating.min ?? Infinity)
  ) {
    observedRanges.seedGlickoRating.min = newObservedRanges.seedGlickoRating.min
    needsUpdate = true
  }
  if (
    newObservedRanges.seedGlickoRating.max != null &&
    newObservedRanges.seedGlickoRating.max >
      (observedRanges.seedGlickoRating.max ?? -Infinity)
  ) {
    observedRanges.seedGlickoRating.max = newObservedRanges.seedGlickoRating.max
    needsUpdate = true
  }

  // Track seed AI conservative ratings
  if (
    newObservedRanges.seedConservativeRating.min != null &&
    newObservedRanges.seedConservativeRating.min <
      (observedRanges.seedConservativeRating.min ?? Infinity)
  ) {
    observedRanges.seedConservativeRating.min =
      newObservedRanges.seedConservativeRating.min
    needsUpdate = true
  }
  if (
    newObservedRanges.seedConservativeRating.max != null &&
    newObservedRanges.seedConservativeRating.max >
      (observedRanges.seedConservativeRating.max ?? -Infinity)
  ) {
    observedRanges.seedConservativeRating.max =
      newObservedRanges.seedConservativeRating.max
    needsUpdate = true
  }

  if (needsUpdate) {
    void writeObservedRanges(observedRanges)
  }
}
