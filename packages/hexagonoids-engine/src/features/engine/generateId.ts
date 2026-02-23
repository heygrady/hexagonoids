let nextId = 0

export function generateId(prefix: string): string {
  return `${prefix}-${nextId++}`
}

export function resetIdCounter(): void {
  nextId = 0
}
