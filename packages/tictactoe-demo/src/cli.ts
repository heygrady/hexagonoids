import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

import {
  checkState,
  getInitialBoard,
  type Player,
  minimaxAI,
  neatAI,
} from '@heygrady/tictactoe-game'
import {
  createConfig as createCPPNConfig,
  createGenome as createCPPNGenome,
  createPhenotype as createCPPNPhenotype,
  createState as createCPPNState,
} from '@neat-evolution/cppn'
import {
  createConfig as createDESHyperNEATConfig,
  createGenome as createDESHyperNEATGenome,
  createPhenotype as createDESHyperNEATPhenotype,
  createState as createDESHyperNEATState,
} from '@neat-evolution/des-hyperneat'
import {
  createConfig as createESHyperNEATConfig,
  createGenome as createESHyperNEATGenome,
  createPhenotype as createESHyperNEATPhenotype,
  createState as createESHyperNEATState,
} from '@neat-evolution/es-hyperneat'
import { createExecutor, type SyncExecutor } from '@neat-evolution/executor'
import {
  createConfig as createHyperNEATConfig,
  createGenome as createHyperNEATGenome,
  createPhenotype as createHyperNEATPhenotype,
  createState as createHyperNEATState,
} from '@neat-evolution/hyperneat'
import {
  createConfig as createNEATConfig,
  createGenome as createNEATGenome,
  createPhenotype as createNEATPhenotype,
  createState as createNEATState,
} from '@neat-evolution/neat'

export enum Methods {
  NEAT = 'NEAT',
  CPPN = 'CPPN',
  HyperNEAT = 'HyperNEAT',
  ES_HyperNEAT = 'ES-HyperNEAT',
  DES_HyperNEAT = 'DES-HyperNEAT',
}

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const method = Methods.NEAT

const bestFileName = `best-${method}.json`
const bestPath = path.join(dirname, '..', '..', `./${bestFileName}`)
const xMark = '😻' // '❌'
const oMark = '🌈' // '⭕'

let bestExecutor: SyncExecutor

function createHyperNEATExecutor(json: any) {
  return createExecutor(
    createHyperNEATPhenotype(
      createHyperNEATGenome(
        createHyperNEATConfig(json.genome.config),
        createHyperNEATState(json.genome.state),
        json.genome.genomeOptions,
        json.genome.genomeOptions.initConfig,
        json.genome.factoryOptions
      )
    )
  )
}

function createNEATExecutor(json: any) {
  return createExecutor(
    createNEATPhenotype(
      createNEATGenome(
        createNEATConfig(json.genome.config),
        createNEATState(json.genome.state),
        json.genome.genomeOptions,
        { inputs: 18, outputs: 9 },
        json.genome.factoryOptions
      )
    )
  )
}

function createCPPNExecutor(json: any) {
  return createExecutor(
    createCPPNPhenotype(
      createCPPNGenome(
        createCPPNConfig(json.genome.config),
        createCPPNState(json.genome.state),
        json.genome.genomeOptions,
        { inputs: 18, outputs: 9 },
        json.genome.factoryOptions
      )
    )
  )
}

function createESHyperNEATExecutor(json: any) {
  return createExecutor(
    createESHyperNEATPhenotype(
      createESHyperNEATGenome(
        createESHyperNEATConfig(json.genome.config),
        createESHyperNEATState(json.genome.state),
        json.genome.genomeOptions,
        { inputs: 18, outputs: 9 },
        json.genome.factoryOptions
      )
    )
  )
}

function createDESHyperNEATExecutor(json: any) {
  return createExecutor(
    createDESHyperNEATPhenotype(
      createDESHyperNEATGenome(
        createDESHyperNEATConfig(json.genome.config),
        createDESHyperNEATState(json.genome.state),
        json.genome.genomeOptions,
        { inputs: 18, outputs: 9 },
        json.genome.factoryOptions
      )
    )
  )
}

const executorFactory = {
  [Methods.NEAT]: createNEATExecutor,
  [Methods.CPPN]: createCPPNExecutor,
  [Methods.HyperNEAT]: createHyperNEATExecutor,
  [Methods.ES_HyperNEAT]: createESHyperNEATExecutor,
  [Methods.DES_HyperNEAT]: createDESHyperNEATExecutor,
}

try {
  const bestJSONRaw = fs.readFileSync(bestPath, 'utf-8')
  const bestNEAT = JSON.parse(bestJSONRaw)
  bestExecutor = executorFactory[method](bestNEAT)
  console.log(`Loaded best NEAT agent from: ${bestPath}`)
} catch (error) {
  console.error(`Error loading NEAT agent from ${bestPath}:`, error)
  process.exit(1) // eslint-disable-line n/no-process-exit
}

const keyCaps = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']

function displayBoard(board: number[]) {
  const symbols = { '0': null, '1': xMark, '-1': oMark }
  let boardString = ''
  for (let i = 0; i < 9; i++) {
    const box = board[i]?.toString() as keyof typeof symbols
    boardString += ` ${symbols[box] ?? keyCaps[i]} `
    if ((i + 1) % 3 === 0) {
      boardString += '\n'
      if (i < 8) {
        boardString += '-----------\n'
      }
    } else {
      boardString += '|'
    }
  }
  console.log(boardString)
}

export async function getPlayerMove(board: number[]): Promise<number> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return await new Promise((resolve) => {
    const prompt = `Your move (1-9): `
    rl.question(prompt, (userInput) => {
      rl.close()
      const move = parseInt(userInput, 10) - 1
      if (isNaN(move) || move < 0 || move > 8 || board[move] !== 0) {
        console.log(
          'Invalid move. Please enter a number between 1-9 for an empty square.'
        )
        resolve(getPlayerMove(board))
      } else {
        resolve(move)
      }
    })
  })
}
export const player: Player = -1
const useSimpleAI = false

async function playGameCLI() {
  const playerMark = player === -1 ? oMark : xMark
  const aiMark = player === -1 ? xMark : oMark
  let firstPlayer: Player = 1

  while (true) {
    let board = getInitialBoard()
    let currentPlayer: Player = firstPlayer

    console.log('\n--- New Game ---')
    if (firstPlayer === player) {
      console.log(`You go first as ${playerMark}.`)
    } else {
      console.log(`AI goes first as ${aiMark}.`)
    }
    displayBoard(board)

    while (true) {
      if (currentPlayer === player) {
        const move = await getPlayerMove(board)
        board[move] = currentPlayer
      } else {
        console.log('AI is thinking...')
        const startTime = Date.now()
        if (useSimpleAI) {
          const [newBoard, newMove] = minimaxAI(board, currentPlayer)
          board = newBoard

          const endTime = Date.now()
          console.log(
            `Simle AI chose move ${newMove + 1} in ${endTime - startTime}ms`
          )
        } else {
          const [newBoard, newMove] = neatAI(board, currentPlayer, {
            executor: bestExecutor,
            verbose: true,
          })
          board = newBoard

          const endTime = Date.now()
          console.log(
            `NEAT AI chose move ${newMove + 1} in ${endTime - startTime}ms`
          )
        }
      }

      displayBoard(board)
      const [isWin, isDraw, winner] = checkState(board)
      if (isWin) {
        const winnerName =
          winner === player ? `You (${playerMark})` : `AI (${aiMark})`
        console.log(`${winnerName} wins!`)
        break
      }

      if (isDraw) {
        console.log("It's a draw!")
        break
      }

      currentPlayer = (currentPlayer * -1) as Player
    }

    firstPlayer = (firstPlayer * -1) as Player
  }
}

process.on('SIGINT', () => {
  console.log('\nThanks for playing! Goodbye!')
  process.exit(0) // eslint-disable-line n/no-process-exit
})

playGameCLI().catch((error) => {
  console.error('An unexpected error occurred:', error)
  process.exit(1) // eslint-disable-line n/no-process-exit
})
