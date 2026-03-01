/**
 * Compatibility wrapper for the robust scenario-bank generator.
 *
 * The implementation now lives in the demo CLI:
 *   yarn workspace @heygrady/hexagonoids-demo demo scenarios ...
 */
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '..')
const cliPath = resolve(packageRoot, 'bin/index.js')

const args = [cliPath, 'scenarios', ...process.argv.slice(2)]

execFileSync(process.execPath, args, {
  stdio: 'inherit',
  cwd: packageRoot,
})
