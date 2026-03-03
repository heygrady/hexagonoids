import type { SupportedAlgorithm } from '@heygrady/hexagonoids-demo'

const modules = import.meta.glob('./modules/*.ts')

const extractModulePath = (
  key: string,
  importFn: () => Promise<unknown>
): string => {
  const fnString = importFn.toString()
  const importMatch = fnString.match(/import\(["']([^"']+)["']\)/)
  if (importMatch != null) {
    return new URL(importMatch[1], import.meta.url).href
  }
  return new URL(key, import.meta.url).href
}

const validateModulePathnames = (
  algorithmName: SupportedAlgorithm,
  modulePathnames: {
    algorithmPathname: string
    createEnvironmentPathname: string
    createExecutorPathname: string
  }
) => {
  if (modulePathnames.algorithmPathname.length === 0) {
    throw new Error(
      `Observe training: missing ${algorithmName} algorithm pathname`
    )
  }
  if (modulePathnames.createEnvironmentPathname.length === 0) {
    throw new Error('Observe training: missing createEnvironment pathname')
  }
  if (modulePathnames.createExecutorPathname.length === 0) {
    throw new Error('Observe training: missing createExecutor pathname')
  }
}

export const getModulePathnamesForAlgorithm = (
  algorithmName: SupportedAlgorithm
) => {
  const modulePathnames = {
    algorithmPathname: '',
    createEnvironmentPathname: '',
    createExecutorPathname: '',
  }

  const algorithmPathnameKey = `${algorithmName}AlgorithmPathname`

  for (const [key, importFn] of Object.entries(modules)) {
    if (key.includes(algorithmPathnameKey)) {
      modulePathnames.algorithmPathname = extractModulePath(key, importFn)
    } else if (key.includes('createEnvironmentPathname')) {
      modulePathnames.createEnvironmentPathname = extractModulePath(
        key,
        importFn
      )
    } else if (key.includes('createExecutorPathname')) {
      modulePathnames.createExecutorPathname = extractModulePath(key, importFn)
    }
  }

  validateModulePathnames(algorithmName, modulePathnames)

  return modulePathnames
}
