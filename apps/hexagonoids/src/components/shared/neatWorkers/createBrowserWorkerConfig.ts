import type { EvaluatorConfig } from '@neat-evolution/evolution-manager'
// eslint-disable-next-line import/default
import workerEvaluatorScriptUrl from '@neat-evolution/worker-evaluator/workerEvaluatorScript?worker&url'
// eslint-disable-next-line import/default
import workerReproducerScriptUrl from '@neat-evolution/worker-reproducer/workerReproducerScript?worker&url'

export interface BrowserWorkerModules {
  [key: string]: () => Promise<unknown>
}

export interface BrowserWorkerModulePathnames {
  algorithmPathname: string
  createEnvironmentPathname: string
  createExecutorPathname: string
}

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

export function resolveBrowserWorkerModulePathnames(
  modules: BrowserWorkerModules,
  algorithmName: string,
  scopeLabel: string
): BrowserWorkerModulePathnames {
  const modulePathnames: BrowserWorkerModulePathnames = {
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

  for (const [name, value] of Object.entries(modulePathnames)) {
    if (value.length === 0) {
      throw new Error(`${scopeLabel}: missing ${name}`)
    }
  }

  return modulePathnames
}

export function createBrowserWorkerConfig(
  modules: BrowserWorkerModules,
  algorithmName: string,
  threadCount: number,
  scopeLabel: string
): {
  createEnvironmentPathname: string
  evaluatorConfig: EvaluatorConfig
} {
  const pathnames = resolveBrowserWorkerModulePathnames(
    modules,
    algorithmName,
    scopeLabel
  )

  return {
    createEnvironmentPathname: pathnames.createEnvironmentPathname,
    evaluatorConfig: {
      algorithmPathname: pathnames.algorithmPathname,
      createExecutorPathname: pathnames.createExecutorPathname,
      evaluatorWorkerScriptUrl: workerEvaluatorScriptUrl,
      reproducerWorkerScriptUrl: workerReproducerScriptUrl,
      threadCount,
    },
  }
}
