/**
 * Module pathname keys used for Vite glob import resolution.
 *
 * These pathnames are required by WorkerEvaluator to load modules in worker threads.
 * Vite requires absolute pathnames for worker imports, which are resolved using
 * import.meta.glob() and new URL(key, import.meta.url).pathname.
 *
 * See: devlogs/vite-glob-import.md
 */
export enum ModulePathnameKey {
  ALGORITHM = 'algorithmPathname',
  CREATE_EXECUTOR = 'createExecutorPathname',
  CREATE_ENVIRONMENT = 'createEnvironmentPathname',
}

export const modulePathnameKeys = Object.values(ModulePathnameKey)

export type ModulePathnames = Record<ModulePathnameKey, string>

/**
 * Validates that all required module pathnames are populated.
 * @param {ModulePathnames} pathnames - Module pathnames object to validate
 * @throws {Error} Error if any pathname is empty or undefined
 */
export function validateModulePathnames(pathnames: ModulePathnames): void {
  for (const key of modulePathnameKeys) {
    if (pathnames[key] === '' || pathnames[key] === undefined) {
      throw new Error(`Module pathname '${key}' is empty or undefined`)
    }
  }
}
