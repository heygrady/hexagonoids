import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { run } from '@oclif/core'

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
type DemoPackageJson = {
  name: string
  version: string
  oclif?: Record<string, unknown>
  [key: string]: unknown
}
const packageJson = JSON.parse(
  readFileSync(resolve(cliRoot, 'package.json'), 'utf8')
) as DemoPackageJson

export async function runCli(args = process.argv.slice(2)): Promise<number> {
  try {
    await run(args, {
      root: cliRoot,
      pjson: {
        ...packageJson,
        oclif: {
          ...packageJson.oclif,
          commands: {
            strategy: 'pattern',
            target: './src/commands',
          },
        },
      },
    })

    return 0
  } catch (error) {
    const candidate = error as {
      exitCode?: number
      message?: string
      oclif?: { exit?: number }
    }

    if (candidate.message) {
      console.error(candidate.message)
    }

    return candidate.oclif?.exit ?? candidate.exitCode ?? 1
  }
}
