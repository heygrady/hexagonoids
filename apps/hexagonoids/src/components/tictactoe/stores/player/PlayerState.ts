export enum PlayerToken {
  X = 'X',
  O = 'O',
}

export interface PlayerState {
  token: PlayerToken
}

export const defaultPlayerState: PlayerState = {
  token: PlayerToken.X, // default token
}
