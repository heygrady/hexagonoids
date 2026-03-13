import {
  ROCK_LARGE_SIZE,
  ROCK_LARGE_VALUE,
  ROCK_MEDIUM_SIZE,
  ROCK_MEDIUM_VALUE,
  ROCK_SMALL_SIZE,
  ROCK_SMALL_VALUE,
} from '../constants.js'

export function rockValueForSize(size: 0 | 1 | 2): number {
  switch (size) {
    case ROCK_LARGE_SIZE:
      return ROCK_LARGE_VALUE
    case ROCK_MEDIUM_SIZE:
      return ROCK_MEDIUM_VALUE
    case ROCK_SMALL_SIZE:
      return ROCK_SMALL_VALUE
  }
}
