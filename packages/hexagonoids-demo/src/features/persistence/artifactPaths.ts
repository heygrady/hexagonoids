import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function findPackageRoot(startDir: string): string {
  let dir = startDir
  for (let i = 0; i < 10; i++) {
    const packageJsonPath = join(dir, 'package.json')
    if (existsSync(packageJsonPath)) return dir
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return startDir
}

export const PACKAGE_ROOT = findPackageRoot(
  fileURLToPath(new URL('.', import.meta.url))
)
export const DEFAULT_ARTIFACTS_DIR = join(PACKAGE_ROOT, '.artifacts')
