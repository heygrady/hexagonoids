# Worker Module Pathname System

This directory contains **module bridge files** that enable web workers to dynamically import `@neat-evolution/*` packages in a Vite-bundled browser environment.

## Why this exists

Web workers can't resolve bare npm specifiers like `@neat-evolution/cppn` — only the main Vite dev server or bundler knows how to map those to actual file paths. But the neat-js worker system (`worker-evaluator`, `worker-reproducer`) uses `import(/* @vite-ignore */ pathname)` to dynamically load algorithm, environment, and executor modules inside workers.

The solution: each module that a worker needs is re-exported through a small bridge file in this directory. Vite's `import.meta.glob()` discovers these files at build time and produces import functions with resolved URLs. The main thread extracts those URLs and passes them to workers as string pathnames, which the workers then `import()` successfully.

## How it works

### 1. Bridge files (this directory)

Each file re-exports the symbols a worker needs from a `@neat-evolution/*` package:

```
CPPNAlgorithmPathname.ts       → re-exports createConfig, createGenome, etc. from @neat-evolution/cppn
HyperNEATAlgorithmPathname.ts  → re-exports from @neat-evolution/hyperneat
NEATAlgorithmPathname.ts       → re-exports from @neat-evolution/neat
ES-HyperNEATAlgorithmPathname.ts → re-exports from @neat-evolution/es-hyperneat
DES-HyperNEATAlgorithmPathname.ts → re-exports from @neat-evolution/des-hyperneat
createEnvironmentPathname.ts   → exports createEnvironment factory
createExecutorPathname.ts      → exports createExecutor
```

### 2. Pathname discovery (`createBrowserWorkerConfig.ts`)

Uses the shared worktree helper at:

`src/components/shared/neatWorkers/createBrowserWorkerConfig.ts`

Each feature still provides its own local `import.meta.glob('./modules/*.ts')`
map, but the shared helper owns:

- parsing resolved URLs from Vite's glob import functions
- validating required algorithm/environment/executor pathnames
- attaching worker script URLs to `evaluatorConfig`

The underlying import functions still contain the resolved URL (e.g.,
`/src/components/.../modules/CPPNAlgorithmPathname.ts` in dev, or a hashed
chunk path in production).

`extractModulePath()` parses the URL from the stringified function and returns it as an absolute URL string.

### 3. Pathname delivery to workers

The resolved pathname strings are passed to `EvolutionManager` which forwards them to worker init payloads:

```
createObserveTrainingAdapter.ts
  → createBrowserWorkerConfig(modules, method, threadCount, 'Observe training')
  → EvolutionManager({
      createEnvironmentPathname,     // ← top-level config field
      evaluatorConfig: {
        algorithmPathname,           // ← resolved URL, not bare specifier
        createExecutorPathname,
        evaluatorWorkerScriptUrl,
        reproducerWorkerScriptUrl,
        threadCount,
      },
    })
```

### 4. Worker-side dynamic import

Inside workers (`worker-evaluator/handleInitEvaluator.ts`, `worker-reproducer/initThread.ts`):

```typescript
const { createConfig, createGenome } = await import(
  /* @vite-ignore */ payload.algorithmPathname
)
```

The `@vite-ignore` comment prevents Vite from trying to statically analyze the import — the URL was already resolved on the main thread.

## EvolutionManager config shape

**This is the #1 source of breakage.** The adapter must match `EvolutionManagerConfig`:

```typescript
new EvolutionManager({
  algorithm: ...,
  environment: { description, toFactoryOptions },
  createEnvironmentPathname,          // REQUIRED — top-level, not nested
  evaluatorConfig: {                  // NOT "workerConfig"
    algorithmPathname,                // Vite-resolved URL string
    createExecutorPathname,           // Vite-resolved URL string
    threadCount,
    evaluatorWorkerScriptUrl,         // imported with ?worker&url suffix
    reproducerWorkerScriptUrl,        // imported with ?worker&url suffix
  },
})
```

If `evaluatorConfig` is missing or misnamed, pathnames silently fall back to bare specifiers (`@neat-evolution/cppn`) which fail in the browser with:

```
Failed to resolve module specifier '@neat-evolution/cppn'
```

## Vite/Astro bundler config (`astro.config.js`)

The bundler config requires maintenance as `@neat-evolution/*` packages are added:

### `optimizeDeps.exclude`

All `@neat-evolution/*` packages used by workers must be listed here. Vite's dependency pre-bundling converts ESM to a single file, which breaks dynamic `import()` from workers. Excluding them preserves the original module structure.

```javascript
optimizeDeps: {
  exclude: [
    '@neat-evolution/worker-actions',
    '@neat-evolution/worker-evaluator',
    '@neat-evolution/worker-reproducer',
    '@neat-evolution/worker-pool',
    '@neat-evolution/worker-threads',
    '@neat-evolution/neat',
    '@neat-evolution/cppn',
    '@neat-evolution/hyperneat',
    '@neat-evolution/es-hyperneat',
    '@neat-evolution/des-hyperneat',
    '@neat-evolution/executor',
    // ... any new packages workers import
  ],
}
```

### `build.rollupOptions.output.manualChunks`

Ensures worker-imported modules are isolated into their own chunks and don't get merged with main-thread code (e.g., Solid.js). Without this, a worker chunk could include browser-only imports and crash.

```javascript
manualChunks(id) {
  // Pathname bridge files → isolated worker chunks
  if (id.includes('/modules/') && id.includes('Pathname')) { ... }
  // @neat-evolution/* → per-package chunks (not per-file)
  if (id.includes('@neat-evolution') || ...) { ... }
}
```

### `server.fs.allow`

Must include the repo root so Vite's dev server can serve files from portal-linked `@neat-evolution/*` packages (which live outside the app directory via yarn `portal:` resolution).

## Quirks and failure modes

### 1. Errors don't surface properly

Worker errors are caught in `createObserveTrainingAdapter.ts` as generic
strings. The original stack trace is lost because errors cross the worker
boundary as `message` strings. You'll see:

```
[OBSERVE] training error: Unknown training error
```

To diagnose: open the browser devtools, check the console for the uncaught promise rejection which usually has the real error (`Failed to resolve module specifier '...'`). The `WorkerReproducer.ts` or `handleInitEvaluator.ts` line numbers point to the failing `import()`.

### 2. Dev vs production paths differ

- **Dev**: Vite serves modules as individual files. URLs look like `/src/components/.../CPPNAlgorithmPathname.ts`
- **Production**: Rollup bundles modules into hashed chunks. URLs look like `/assets/worker-CPPNAlgorithmPathname-abc123.js`

The `extractModulePath()` function handles both by parsing the URL from the stringified glob import function. If this parsing breaks (Vite changes its output format), pathnames will be wrong.

### 3. New packages require multi-file updates

When adding a new `@neat-evolution/*` package that workers need:

1. **Bridge file**: Add `<Name>AlgorithmPathname.ts` or similar in this `modules/` directory
2. **`astro.config.js`**: Add to `optimizeDeps.exclude` array
3. **`package.json` resolutions**: Add `portal:` entry in the worktree root if the package is new (see `.worktrees/CLAUDE.md`)
4. **`manualChunks`**: Usually handled by the existing glob patterns, but verify

### 4. Portal symlinks and Vite

The `@neat-evolution/*` packages are symlinked into the app via yarn `portal:` protocol. Vite generally follows symlinks, but `optimizeDeps` must exclude these packages or Vite will pre-bundle them and break the module boundary workers rely on. If you see `Cannot find module` errors only in dev mode, check `optimizeDeps.exclude`.

### 5. Worker script URLs

Worker scripts themselves also need Vite-resolved URLs:

```typescript
import workerEvaluatorScriptUrl from '@neat-evolution/worker-evaluator/workerEvaluatorScript?worker&url'
import workerReproducerScriptUrl from '@neat-evolution/worker-reproducer/workerReproducerScript?worker&url'
```

The `?worker&url` suffix tells Vite to treat these as worker entry points and return their resolved URLs as strings. These are passed via `evaluatorConfig.evaluatorWorkerScriptUrl` and `evaluatorConfig.reproducerWorkerScriptUrl`.

## Diagnostic checklist

When the worker integration breaks:

1. **Check browser console** for the real error (not just `[OBSERVE] training error`)
2. **"Failed to resolve module specifier '@neat-evolution/...'"** → pathname not reaching the worker. Check that `evaluatorConfig` (not `workerConfig` or other names) is passed to `EvolutionManager`, and that `createEnvironmentPathname` is a top-level field
3. **Module not found in dev only** → check `optimizeDeps.exclude` in `astro.config.js`
4. **Module not found in prod only** → check `manualChunks` in `astro.config.js`; the chunk may have been merged with incompatible code
5. **New package not working** → follow the "New packages require multi-file updates" checklist above
6. **Worker hangs silently** → check that worker script URLs use the `?worker&url` import suffix
