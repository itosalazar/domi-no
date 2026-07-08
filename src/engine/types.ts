export type Mode = 'block' | 'draw' | 'fives'
export type Seat = 'p' | 'ai'
export type End = 'L' | 'R'

export interface Tile {
  id: string
  a: number
  b: number
}

/** A tile placed on the chain. `left`/`right` are the oriented pip values in chain order. */
export interface Placed {
  id: string
  a: number
  b: number
  left: number
  right: number
  seq: number
  by: Seat
}

export interface Move {
  tileId: string
  end: End
}

export interface RoundResult {
  winner: Seat | 'tie'
  reason: 'domino' | 'blocked'
  pips: { p: number; ai: number }
  /** Points awarded for the round end (fives) or pip totals (block/draw). */
  points: { p: number; ai: number }
}

export interface Round {
  hands: { p: Tile[]; ai: Tile[] }
  boneyard: Tile[]
  chain: Placed[]
  turn: Seat
  starter: Seat
  consecutivePasses: number
  seq: number
  over: boolean
  result: RoundResult | null
}

export interface ScoreEvent {
  seat: Seat
  points: number
  seq: number
}

export interface MatchOptions {
  /** Multi-round match: round winner banks opponent's remaining pips, first to 100. */
  toHundred?: boolean
  /** Block only: draw from the boneyard until playable instead of passing. */
  drawToPlay?: boolean
}

export interface Match {
  id: string
  mode: Mode
  /** True when the boneyard is live (draw/fives always; block with the option). */
  drawing: boolean
  target: number
  scores: { p: number; ai: number }
  roundNumber: number
  round: Round
  over: boolean
  winner: Seat | 'tie' | null
  startedAt: number
  lastScoreEvent: ScoreEvent | null
  counts: {
    placed: { p: number; ai: number }
    passes: { p: number; ai: number }
    drawn: { p: number; ai: number }
    rounds: number
  }
}

export const MODE_LABEL: Record<Mode, string> = {
  block: 'BLOCK',
  draw: 'DRAW',
  fives: 'ALL FIVES',
}
