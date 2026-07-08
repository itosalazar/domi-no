import { chainEnds, endsTotal, isDouble, legalMoves, mustDraw, mustPass, seatHasMove } from './engine'
import type { Match, Move, Placed, Tile } from './types'

export type AiAction = { type: 'play'; move: Move } | { type: 'draw' } | { type: 'pass' }

/** Simulate the oriented chain after a move, to evaluate the resulting ends. */
function simulateChain(chain: Placed[], tile: Tile, end: 'L' | 'R'): Placed[] {
  const ends = chainEnds(chain)
  const stub = { seq: -1, by: 'ai' as const }
  if (!ends) return [{ ...tile, left: tile.a, right: tile.b, ...stub }]
  if (end === 'L') {
    const right = tile.b === ends.L ? tile.b : tile.a
    const left = tile.b === ends.L ? tile.a : tile.b
    return [{ ...tile, left, right, ...stub }, ...chain]
  }
  const left = tile.a === ends.R ? tile.a : tile.b
  const right = tile.a === ends.R ? tile.b : tile.a
  return [...chain, { ...tile, left, right, ...stub }]
}

/**
 * Weighted evaluation:
 *  - All Fives: immediate points dominate.
 *  - Shed heavy tiles, shed doubles before they strand.
 *  - Keep future flexibility (tiles in hand that still match the new ends).
 *  - Small jitter breaks ties so play isn't robotic.
 */
export function chooseAiAction(match: Match): AiAction {
  const r = match.round
  if (r.turn !== 'ai' || r.over || match.over) return { type: 'pass' }

  if (!seatHasMove(r, 'ai')) {
    if (mustDraw(match)) return { type: 'draw' }
    if (mustPass(match)) return { type: 'pass' }
  }

  const moves = legalMoves(r.hands.ai, r.chain)
  let best: Move | null = null
  let bestScore = -Infinity

  for (const move of moves) {
    const tile = r.hands.ai.find((t) => t.id === move.tileId)!
    const rest = r.hands.ai.filter((t) => t.id !== move.tileId)
    const nextChain = simulateChain(r.chain, tile, move.end)
    const nextEnds = chainEnds(nextChain)!

    let score = 0

    if (match.mode === 'fives') {
      const total = endsTotal(nextChain)
      if (total > 0 && total % 5 === 0) score += total * 10
      // Avoid leaving ends one tile away from an easy multiple for the opponent.
      const risk = (total % 5 === 0 ? 0 : Math.min(total % 5, 5 - (total % 5))) === 1 ? 1 : 0
      score -= risk
    }

    // Shed pips.
    score += (tile.a + tile.b) * 1.0
    // Doubles are liabilities held late.
    if (isDouble(tile)) score += 2.5
    // Flexibility: remaining tiles that can still play on the resulting ends.
    const flexible = rest.filter(
      (t) => t.a === nextEnds.L || t.b === nextEnds.L || t.a === nextEnds.R || t.b === nextEnds.R,
    ).length
    score += flexible * 1.5
    // Prefer keeping both ends alive with values we still hold in duplicate.
    const jitter = Math.random() * 0.75
    score += jitter

    if (score > bestScore) {
      bestScore = score
      best = move
    }
  }

  if (best) return { type: 'play', move: best }
  if (mustDraw(match)) return { type: 'draw' }
  return { type: 'pass' }
}
