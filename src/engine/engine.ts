import type { End, Match, MatchOptions, Mode, Move, Placed, Round, RoundResult, Seat, Tile } from './types'

// ---------------------------------------------------------------- set + deal

/** Full double-six set: 28 unique tiles, 0-0 through 6-6. */
export function makeSet(): Tile[] {
  const tiles: Tile[] = []
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      tiles.push({ id: `${a}-${b}`, a, b })
    }
  }
  return tiles
}

export function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export const isDouble = (t: { a: number; b: number }) => t.a === t.b
export const pipTotal = (hand: Tile[]) => hand.reduce((s, t) => s + t.a + t.b, 0)

/** Highest double, else highest pip total, decides who opens round one. */
export function determineStarter(hands: { p: Tile[]; ai: Tile[] }): Seat {
  const best = (hand: Tile[]) => {
    let bestDouble = -1
    let bestPips = -1
    for (const t of hand) {
      if (isDouble(t)) bestDouble = Math.max(bestDouble, t.a)
      bestPips = Math.max(bestPips, t.a + t.b)
    }
    return { bestDouble, bestPips }
  }
  const p = best(hands.p)
  const ai = best(hands.ai)
  if (p.bestDouble !== ai.bestDouble) return p.bestDouble > ai.bestDouble ? 'p' : 'ai'
  return p.bestPips >= ai.bestPips ? 'p' : 'ai'
}

function dealRound(starter: Seat | null): Round {
  const deck = shuffle(makeSet())
  const hands = { p: deck.slice(0, 7), ai: deck.slice(7, 14) }
  const boneyard = deck.slice(14)
  const s = starter ?? determineStarter(hands)
  return {
    hands,
    boneyard,
    chain: [],
    turn: s,
    starter: s,
    consecutivePasses: 0,
    seq: 0,
    over: false,
    result: null,
  }
}

export function newMatch(mode: Mode, opts: MatchOptions = {}): Match {
  return {
    id: `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    mode,
    drawing: mode !== 'block' || !!opts.drawToPlay,
    target: mode === 'fives' || opts.toHundred ? 100 : 0,
    scores: { p: 0, ai: 0 },
    roundNumber: 1,
    round: dealRound(null),
    over: false,
    winner: null,
    startedAt: Date.now(),
    lastScoreEvent: null,
    counts: {
      placed: { p: 0, ai: 0 },
      passes: { p: 0, ai: 0 },
      drawn: { p: 0, ai: 0 },
      rounds: 0,
    },
  }
}

// ---------------------------------------------------------------- chain state

export function chainEnds(chain: Placed[]): { L: number; R: number } | null {
  if (chain.length === 0) return null
  return { L: chain[0].left, R: chain[chain.length - 1].right }
}

/**
 * All Fives ends total. A double sitting at an open end counts both halves.
 * A single tile on the board exposes both of its halves.
 */
export function endsTotal(chain: Placed[]): number {
  if (chain.length === 0) return 0
  if (chain.length === 1) {
    const t = chain[0]
    return t.a + t.b
  }
  const first = chain[0]
  const last = chain[chain.length - 1]
  const l = isDouble(first) ? first.left * 2 : first.left
  const r = isDouble(last) ? last.right * 2 : last.right
  return l + r
}

export function legalMoves(hand: Tile[], chain: Placed[]): Move[] {
  const ends = chainEnds(chain)
  if (!ends) return hand.map((t) => ({ tileId: t.id, end: 'R' as End }))
  const moves: Move[] = []
  for (const t of hand) {
    if (t.a === ends.L || t.b === ends.L) moves.push({ tileId: t.id, end: 'L' })
    if (t.a === ends.R || t.b === ends.R) moves.push({ tileId: t.id, end: 'R' })
  }
  return moves
}

export function legalEndsForTile(tile: Tile, chain: Placed[]): End[] {
  return legalMoves([tile], chain).map((m) => m.end)
}

export const seatHasMove = (round: Round, seat: Seat) =>
  legalMoves(round.hands[seat], round.chain).length > 0

/** When the boneyard is live, a player with no legal move must draw while tiles remain. */
export function mustDraw(match: Match): boolean {
  const r = match.round
  if (r.over || match.over) return false
  if (!match.drawing) return false
  return !seatHasMove(r, r.turn) && r.boneyard.length > 0
}

/** Passing is only legal when no move exists and drawing is impossible. */
export function mustPass(match: Match): boolean {
  const r = match.round
  if (r.over || match.over) return false
  if (seatHasMove(r, r.turn)) return false
  if (match.drawing && r.boneyard.length > 0) return false
  return true
}

// ---------------------------------------------------------------- mutations
// All engine mutations return a NEW match object (structural sharing inside).

const round5 = (n: number) => Math.round(n / 5) * 5

function cloneMatch(m: Match): Match {
  return {
    ...m,
    scores: { ...m.scores },
    counts: {
      placed: { ...m.counts.placed },
      passes: { ...m.counts.passes },
      drawn: { ...m.counts.drawn },
      rounds: m.counts.rounds,
    },
    round: {
      ...m.round,
      hands: { p: m.round.hands.p.slice(), ai: m.round.hands.ai.slice() },
      boneyard: m.round.boneyard.slice(),
      chain: m.round.chain.slice(),
    },
  }
}

function finishRound(m: Match, result: RoundResult) {
  m.round.over = true
  m.round.result = result
  m.counts.rounds += 1

  if (m.target > 0) {
    // Multi-round match (fives, or block/draw with the to-100 option).
    m.scores.p += result.points.p
    m.scores.ai += result.points.ai
    if (m.scores.p >= m.target || m.scores.ai >= m.target) {
      m.over = true
      m.winner = m.scores.p === m.scores.ai ? 'tie' : m.scores.p > m.scores.ai ? 'p' : 'ai'
    }
  } else {
    // Classic block/draw: decided in a single round; scores show pip counts.
    m.scores.p = result.points.p
    m.scores.ai = result.points.ai
    m.over = true
    m.winner = result.winner
  }
}

/** Apply a validated move for `seat`. Throws on illegal input. */
export function playMove(match: Match, seat: Seat, move: Move): Match {
  const m = cloneMatch(match)
  const r = m.round
  if (m.over || r.over || r.turn !== seat) throw new Error('not your turn')
  const idx = r.hands[seat].findIndex((t) => t.id === move.tileId)
  if (idx === -1) throw new Error('tile not in hand')
  const tile = r.hands[seat][idx]
  const ends = chainEnds(r.chain)

  let placed: Placed
  if (!ends) {
    placed = { ...tile, left: tile.a, right: tile.b, seq: r.seq, by: seat }
    r.chain.push(placed)
  } else if (move.end === 'L') {
    if (tile.a !== ends.L && tile.b !== ends.L) throw new Error('illegal move')
    // New tile's right side must equal the current left end.
    const right = tile.b === ends.L ? tile.b : tile.a
    const left = tile.b === ends.L ? tile.a : tile.b
    placed = { ...tile, left, right, seq: r.seq, by: seat }
    r.chain.unshift(placed)
  } else {
    if (tile.a !== ends.R && tile.b !== ends.R) throw new Error('illegal move')
    const left = tile.a === ends.R ? tile.a : tile.b
    const right = tile.a === ends.R ? tile.b : tile.a
    placed = { ...tile, left, right, seq: r.seq, by: seat }
    r.chain.push(placed)
  }

  r.hands[seat].splice(idx, 1)
  r.seq += 1
  r.consecutivePasses = 0
  m.counts.placed[seat] += 1
  m.lastScoreEvent = null

  // All Fives pip scoring, derived from real board state.
  if (m.mode === 'fives') {
    const total = endsTotal(r.chain)
    if (total > 0 && total % 5 === 0) {
      m.scores[seat] += total
      m.lastScoreEvent = { seat, points: total, seq: placed.seq }
      if (m.scores[seat] >= m.target) {
        m.over = true
        m.winner = seat
        r.over = true
        m.counts.rounds += 1
        const pips = { p: pipTotal(r.hands.p), ai: pipTotal(r.hands.ai) }
        r.result = { winner: seat, reason: 'domino', pips, points: { p: 0, ai: 0 } }
        return m
      }
    }
  }

  if (r.hands[seat].length === 0) {
    const pips = { p: pipTotal(r.hands.p), ai: pipTotal(r.hands.ai) }
    // Fives banks opponent pips rounded to 5; to-100 banks them exactly;
    // classic single-round records the raw pip counts.
    let points = pips
    if (m.mode === 'fives') {
      points = seat === 'p' ? { p: round5(pips.ai), ai: 0 } : { p: 0, ai: round5(pips.p) }
    } else if (m.target > 0) {
      points = seat === 'p' ? { p: pips.ai, ai: 0 } : { p: 0, ai: pips.p }
    }
    finishRound(m, { winner: seat, reason: 'domino', pips, points })
    return m
  }

  r.turn = seat === 'p' ? 'ai' : 'p'
  return m
}

/**
 * Draw one tile from the boneyard into the current player's hand.
 * `index` lets the player pick a specific face-down tile; omitted (AI) takes
 * the top of the pile — identical odds either way.
 */
export function drawTile(match: Match, index?: number): Match {
  const m = cloneMatch(match)
  const r = m.round
  if (m.over || r.over) throw new Error('round over')
  if (!m.drawing) throw new Error('boneyard not in play')
  if (seatHasMove(r, r.turn)) throw new Error('has a legal move')
  if (r.boneyard.length === 0) throw new Error('boneyard empty')
  const i = index ?? r.boneyard.length - 1
  if (i < 0 || i >= r.boneyard.length) throw new Error('bad boneyard index')
  const tile = r.boneyard.splice(i, 1)[0]
  r.hands[r.turn].push(tile)
  m.counts.drawn[r.turn] += 1
  m.lastScoreEvent = null
  return m
}

export function passTurn(match: Match): Match {
  const m = cloneMatch(match)
  const r = m.round
  if (m.over || r.over) throw new Error('round over')
  if (!mustPass(m)) throw new Error('pass not allowed')
  const seat = r.turn
  m.counts.passes[seat] += 1
  r.consecutivePasses += 1
  m.lastScoreEvent = null

  if (r.consecutivePasses >= 2) {
    // Blocked round.
    const pips = { p: pipTotal(r.hands.p), ai: pipTotal(r.hands.ai) }
    const winner: Seat | 'tie' = pips.p === pips.ai ? 'tie' : pips.p < pips.ai ? 'p' : 'ai'
    let points = { p: 0, ai: 0 }
    if (m.mode === 'fives') {
      if (winner === 'p') points = { p: round5(pips.ai - pips.p), ai: 0 }
      else if (winner === 'ai') points = { p: 0, ai: round5(pips.p - pips.ai) }
    } else if (m.target > 0) {
      // Blocked to-100 round: the lighter hand banks the pip difference.
      if (winner === 'p') points = { p: pips.ai - pips.p, ai: 0 }
      else if (winner === 'ai') points = { p: 0, ai: pips.p - pips.ai }
    } else {
      points = pips
    }
    finishRound(m, { winner, reason: 'blocked', pips, points })
    return m
  }

  r.turn = seat === 'p' ? 'ai' : 'p'
  return m
}

/** Deal the next round of a multi-round match. Round winner leads; ties alternate. */
export function nextRound(match: Match): Match {
  const m = cloneMatch(match)
  if (m.over || !m.round.over || !m.round.result) throw new Error('cannot start round')
  const res = m.round.result
  const starter: Seat =
    res.winner === 'tie' ? (m.round.starter === 'p' ? 'ai' : 'p') : res.winner
  m.roundNumber += 1
  m.round = dealRound(starter)
  m.lastScoreEvent = null
  return m
}

export function matchDurationSec(m: Match): number {
  return Math.round((Date.now() - m.startedAt) / 1000)
}

// ---------------------------------------------------------------- online

/**
 * Swap the two seats in a match. In online play the host runs the canonical
 * engine (host = 'p', guest = 'ai'); the guest swaps every received state so
 * the entire UI can stay 'p'-centric on both ends.
 */
export function swapPerspective(m: Match): Match {
  const sw = <T extends Seat | 'tie'>(s: T): T => (s === 'p' ? ('ai' as T) : s === 'ai' ? ('p' as T) : s)
  const r = m.round
  return {
    ...m,
    scores: { p: m.scores.ai, ai: m.scores.p },
    winner: m.winner ? sw(m.winner) : null,
    lastScoreEvent: m.lastScoreEvent ? { ...m.lastScoreEvent, seat: sw(m.lastScoreEvent.seat) } : null,
    counts: {
      placed: { p: m.counts.placed.ai, ai: m.counts.placed.p },
      passes: { p: m.counts.passes.ai, ai: m.counts.passes.p },
      drawn: { p: m.counts.drawn.ai, ai: m.counts.drawn.p },
      rounds: m.counts.rounds,
    },
    round: {
      ...r,
      hands: { p: r.hands.ai.slice(), ai: r.hands.p.slice() },
      boneyard: r.boneyard.slice(),
      turn: sw(r.turn),
      starter: sw(r.starter),
      chain: r.chain.map((t) => ({ ...t, by: sw(t.by) })),
      result: r.result
        ? {
            ...r.result,
            winner: sw(r.result.winner),
            pips: { p: r.result.pips.ai, ai: r.result.pips.p },
            points: { p: r.result.points.ai, ai: r.result.points.p },
          }
        : null,
    },
  }
}
