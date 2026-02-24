import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { loadGenome } from '../../src/persistence/loadGenome.js'
import {
  SERIALIZED_ORGANISM_KIND,
  SERIALIZED_ORGANISM_VERSION,
} from '../../src/serialization/serializedOrganism.js'

describe('loadGenome', () => {
  it('loads a serialized organism JSON object', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hexagonoids-load-genome-'))
    const pathname = join(directory, 'best-NEAT.json')
    const payload = {
      __kind: SERIALIZED_ORGANISM_KIND,
      version: SERIALIZED_ORGANISM_VERSION,
      genome: {
        config: { foo: 'bar' },
        state: { nodes: [] },
        genomeOptions: { initConfig: { inputs: 30, outputs: 4 } },
        factoryOptions: {},
      },
      organismState: {
        generation: 3,
        fitness: 10.25,
      },
    }

    await writeFile(pathname, `${JSON.stringify(payload)}\n`, 'utf8')

    const loaded = loadGenome(pathname)
    expect(loaded).toEqual(payload)
  })

  it('throws an explicit parse error for invalid JSON', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hexagonoids-load-genome-'))
    const pathname = join(directory, 'broken.json')
    await writeFile(pathname, '{not-valid-json', 'utf8')

    expect(() => loadGenome(pathname)).toThrowError(
      `Failed to parse genome JSON at "${pathname}"`
    )
  })

  it('throws when required genome shape fields are missing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'hexagonoids-load-genome-'))
    const pathname = join(directory, 'invalid-shape.json')
    await writeFile(
      pathname,
      JSON.stringify({
        __kind: SERIALIZED_ORGANISM_KIND,
        version: SERIALIZED_ORGANISM_VERSION,
      }),
      'utf8'
    )

    expect(() => loadGenome(pathname)).toThrowError(
      `Genome file "${pathname}" is missing required "genome" object.`
    )
  })
})
