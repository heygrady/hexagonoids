/** `${speciesIndex}-${organismIndex}` */
export type GenomeId = string

export type GenomeIdTuple = [speciesIndex: number, organismIndex: number]

export const toGenomeId = (
  speciesIndex: number,
  organismIndex: number
): GenomeId => speciesIndex + '-' + organismIndex

export const fromGenomeId = (genomeId: GenomeId): GenomeIdTuple => {
  const bracketIndex = genomeId.indexOf('-')
  return [
    +genomeId.substring(0, bracketIndex),
    +genomeId.substring(bracketIndex + 1, genomeId.length),
  ]
}
