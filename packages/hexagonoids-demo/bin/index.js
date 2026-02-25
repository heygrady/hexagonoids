#!/usr/bin/env node

import { runMainCli } from '../dist/esm/main.js'

const code = await runMainCli(process.argv.slice(2))
if (code !== 0 && process.exitCode == null) {
  process.exitCode = code
}
