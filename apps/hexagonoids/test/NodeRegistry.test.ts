import { describe, expect, test } from 'vitest'
import type { CullableEntry } from '../src/components/hexagonoids/NodeRegistry'
import { NodeRegistry } from '../src/components/hexagonoids/NodeRegistry'

function createEntry(): CullableEntry {
  return {
    originNode: {} as CullableEntry['originNode'],
    visualNode: {} as CullableEntry['visualNode'],
  }
}

describe('NodeRegistry', () => {
  test('register stores an entry retrievable by key', () => {
    const registry = new NodeRegistry()
    const entry = createEntry()

    registry.register('ship-1', entry)

    expect(registry.get('ship-1')).toBe(entry)
  })

  test('unregister removes a previously registered entry', () => {
    const registry = new NodeRegistry()
    const entry = createEntry()
    registry.register('rock-1', entry)

    registry.unregister('rock-1')

    expect(registry.get('rock-1')).toBeUndefined()
  })

  test('get returns undefined for an unregistered key', () => {
    const registry = new NodeRegistry()

    expect(registry.get('nonexistent')).toBeUndefined()
  })

  test('values iterates all registered entries', () => {
    const registry = new NodeRegistry()
    const entry1 = createEntry()
    const entry2 = createEntry()
    registry.register('a', entry1)
    registry.register('b', entry2)

    const allEntries = [...registry.values()]

    expect(allEntries).toHaveLength(2)
    expect(allEntries).toContain(entry1)
    expect(allEntries).toContain(entry2)
  })
})
