import { readFileSync } from 'node:fs'

import { assertSerializedOrganism } from '../training/serialization/serializedOrganism.js'

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

  assertSerializedOrganism(parsed, pathname)
  return parsed
}
