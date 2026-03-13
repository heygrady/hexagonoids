# Profiling `@heygrady/hexagonoids-demo`

This package has lightweight profiling scripts modeled after the `neat-js` demo workflow.
The profile capture uses Node inspector around the `train()` call, so results are focused on training work rather than process startup.
It also records real worker CPU profiles to a sibling `*.workers/` directory.

## Generate a CPU Profile

From repo root:

```bash
yarn workspace @heygrady/hexagonoids-demo profile
```

This now:
- captures the main-thread CPU profile
- captures worker CPU profiles by default
- immediately runs the analyzer and prints both summaries

Defaults (focused train run, not Vitest):
- method: `HyperNEAT`
- population: `32`
- iterations: `1`
- maxTicks: `400`
- threadCount: `1`
- output dir: `packages/hexagonoids-demo/.artifacts/cpuprofiles`
- output file: timestamped `*.cpuprofile`
- worker CPU profiles: matching `*.workers/*.cpuprofile`

Optional args:

```bash
yarn workspace @heygrady/hexagonoids-demo profile -- \
  --output-dir .artifacts/cpuprofiles \
  --name latest.cpuprofile \
  --method NEAT \
  --populationSize 64 \
  --maxTicks 1000
```

## Analyze a Profile

```bash
yarn workspace @heygrady/hexagonoids-demo profile:analyze -- \
  .artifacts/cpuprofiles/latest.cpuprofile
```

This prints:
- total sampled time
- top functions by self time (with self/total percentages)
- aggregated worker CPU hotspots when `*.workers/` exists

It also writes a machine-readable summary JSON next to the profile:
- `*.summary.json`

Optional args:
- `--top 50`: number of rows in the console table
- `--summary <path>`: explicit summary output path
- `--include-runtime`: include `(idle)` and `(program)` rows in output
- `--sort total|self`: sort by inclusive (`total`, default) or self time
- `--repo-only`: include only first-party repo code (excludes `node_modules`)
- `--worker-cpu-profile-dir <path>`: explicit worker CPU profile directory
- `--no-worker-profile`: skip worker CPU profile aggregation

## Flamegraph Viewing

Open the generated `*.cpuprofile` in:
- Chrome DevTools Performance tab
- Speedscope

Use repeated runs with the same profile args to track hot-path changes after optimization passes.
