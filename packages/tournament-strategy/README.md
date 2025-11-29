# @heygrady/tournament-strategy

Tournament and rating system implementations for evaluating NEAT genomes through competitive play. This package provides two evaluation strategies: a Swiss-style tournament system with Buchholz tiebreakers, and a Glicko-2 rating system that tracks skill uncertainty over generations.

These strategies integrate with the `@neat-evolution/evaluation-strategy` interface to provide sophisticated fitness evaluation that goes beyond simple win/loss counting.

## Purpose

- **Swiss Tournaments**: Pair genomes by performance bracket to ensure competitive matches
- **Glicko-2 Ratings**: Track skill and uncertainty with a proven chess rating system
- **Multi-Component Fitness**: Combine environment scores, tournament results, and rating data
- **Generational Heroes**: Maintain a pool of historical best performers for benchmarking

## How it Fits into the Ecosystem

- **@neat-evolution/evaluation-strategy**: Both strategies implement the `EvaluationStrategy<G>` interface
- **@heygrady/tictactoe-environment**: Uses these strategies to evaluate Tic-Tac-Toe playing agents
- **@heygrady/tictactoe-demo**: Configures and runs training with these tournament strategies

## Installation

```bash
yarn add @heygrady/tournament-strategy
```

## Key Components

### Strategy Classes

- **`SwissTournamentStrategy`**: Runs multiple rounds of Swiss-paired matches with Buchholz scoring for strength-of-schedule adjustments
- **`GlickoStrategy`**: Uses Glicko-2 rating system with optional seed tournaments against built-in AI opponents

### Types

- **`ScoreComponents`**: Components for Swiss fitness calculation (environmentScore, tournamentScore, seedScore, buchholzScore)
- **`GlickoScoreComponents`**: Components for Glicko fitness (environmentScore, seedScore, glickoScore, conservativeScore)
- **`SwissTournamentStrategyOptions`**: Configuration for Swiss tournaments
- **`GlickoStrategyOptions`**: Configuration for Glicko strategy including hero management
- **`HeroGenome`**: Tuple of genome entry and Glicko rating data for historical best performers

### Utilities

- **`defaultFitnessCalculator`**: Default weighted combination for Swiss tournament scores
- **`defaultGlickoStrategyOptions`**: Sensible defaults for Glicko-2 configuration
- **`toId(entry)`**: Convert genome entry to unique numeric ID for tracking

## Usage

### Swiss Tournament Strategy

```typescript
import { SwissTournamentStrategy } from '@heygrady/tournament-strategy'
import type { EvaluationContext } from '@neat-evolution/evaluation-strategy'
import type { GenomeEntries, AnyGenome } from '@neat-evolution/evaluator'

// 1. Create the strategy with options
const strategy = new SwissTournamentStrategy({
  matchPlayerSize: 2,      // Head-to-head matches
  rounds: 5,               // Number of tournament rounds
  minScore: -0.25,         // Min score for normalization
  maxScore: 3,             // Max score for normalization
  individualSeeding: true, // Evaluate against AI before tournament
})

// 2. Use with NEAT evaluation context
async function evaluatePopulation<G extends AnyGenome<G>>(
  context: EvaluationContext<G>,
  genomes: GenomeEntries<G>
) {
  const results: Array<[number, number, number]> = []

  // 3. The strategy yields fitness data for each genome
  for await (const [speciesIndex, organismIndex, fitness] of strategy.evaluate(
    context,
    genomes
  )) {
    results.push([speciesIndex, organismIndex, fitness])
    console.log(
      `Species ${speciesIndex}, Organism ${organismIndex}: fitness = ${fitness.toFixed(3)}`
    )
  }

  return results
}
```

### Glicko-2 Strategy with Heroes

```typescript
import {
  GlickoStrategy,
  type GlickoStrategyOptions,
  type HeroGenome,
} from '@heygrady/tournament-strategy'
import type { AnyGenome } from '@neat-evolution/evaluator'

// 1. Create strategy with hero tracking
const strategy = new GlickoStrategy<MyGenome>({
  matchPlayerSize: 2,
  rounds: 5,
  individualSeeding: true,     // Run seed tournaments first
  numSeedTournaments: 5,       // Games per AI opponent type
  heroPoolRatio: 0.2,          // 20% of population size as heroes

  // Glicko-2 settings
  glickoSettings: {
    tau: 0.5,      // System volatility constant
    rating: 1500,  // Default rating
    rd: 350,       // Default rating deviation
    vol: 0.06,     // Default volatility
  },

  // Fitness component weights (must sum to 1.0)
  fitnessWeights: {
    seedWeight: 0.2,         // Weight for AI tournament performance
    envWeight: 0.3,          // Weight for environment score
    glickoWeight: 0.25,      // Weight for raw Glicko rating
    conservativeWeight: 0.25, // Weight for conservative rating (rating - 2*RD)
  },

  // Callbacks for tracking progress
  onHeroesUpdated: (heroes: HeroGenome<MyGenome>[]) => {
    console.log(`New hero added. Total heroes: ${heroes.length}`)
  },
  onBestExecutorUpdate: ({ entry, fitness, rating }) => {
    console.log(`Best genome: fitness=${fitness.toFixed(3)}, rating=${rating}`)
  },
})

// 2. The strategy maintains heroes across generations automatically
// Each generation's best performer is added to the hero pool
// Heroes are sampled uniformly across generations for diversity
```

### Custom Fitness Calculator

```typescript
import {
  SwissTournamentStrategy,
  type ScoreComponents,
  type FitnessCalculator,
} from '@heygrady/tournament-strategy'
import type { GenomeEntry, AnyGenome } from '@neat-evolution/evaluator'

// 1. Define custom fitness calculation logic
const customFitnessCalculator: FitnessCalculator<MyGenome> = (
  components: ScoreComponents,
  entry: GenomeEntry<MyGenome>
) => {
  const { environmentScore, tournamentScore, buchholzScore, seedScore } =
    components

  // 2. Weight components according to your priorities
  // Example: Heavily favor tournament wins over raw environment scores
  let fitness = tournamentScore * 0.5 + (buchholzScore ?? 0) * 0.3

  // 3. Add seed score if available (from individual seeding)
  if (seedScore != null) {
    fitness += seedScore * 0.1
  }

  // 4. Environment score as minor factor
  fitness += environmentScore * 0.1

  return fitness
}

// 5. Use with SwissTournamentStrategy
const strategy = new SwissTournamentStrategy({
  individualSeeding: true,
  fitnessCalculator: customFitnessCalculator,
})
```

## How Tournament Scoring Works

### Swiss Tournament Flow

1. **Round 1**: Random pairing of all genomes
2. **Subsequent Rounds**: Pair by score bracket (winners play winners)
3. **Buchholz Calculation**: Sum opponents' scores for strength-of-schedule
4. **Final Fitness**: Weighted combination of environment, tournament, and Buchholz scores

### Glicko-2 Flow

1. **Seed Tournaments** (optional): Each genome plays against AI opponents (minimax, heuristic, random)
2. **Rating Initialization**: Genomes start at seeded rating based on AI performance
3. **Head-to-Head Matches**: Swiss-paired matches update Glicko ratings
4. **Hero Selection**: Generation's best performer added to hero pool
5. **Final Fitness**: Weighted combination of seed, environment, Glicko, and conservative ratings

## License

MIT License - see [LICENSE](../../LICENSE) for details.
