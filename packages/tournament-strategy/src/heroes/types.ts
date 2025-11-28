import type { AnyGenome, GenomeEntry } from '@neat-evolution/evaluator'

/** Glicko-2 data for a persistent agent. */
export interface GlickoPersistenceData {
  rating: number
  rd: number
  vol: number
}

/** A "Hero" agent, combining its genome and Glicko data. */
export type HeroGenome<G extends AnyGenome<G>> = [
  genomeEntry: GenomeEntry<G>,
  glickoData: GlickoPersistenceData,
]
