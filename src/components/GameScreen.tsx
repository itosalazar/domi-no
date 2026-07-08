import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { chooseAiAction } from '../engine/ai'
import {
  drawTile,
  legalEndsForTile,
  legalMoves,
  mustDraw,
  mustPass,
  newMatch,
  nextRound,
  passTurn,
  playMove,
  swapPerspective,
} from '../engine/engine'
import type { End, Match, MatchOptions, Mode, Move } from '../engine/types'
import { MODE_LABEL } from '../engine/types'
import { sfx } from '../audio/sound'
import { useStore } from '../state/store'
import type { OnlineSession } from '../net/peer'
import { Board } from './Board'
import { Hand } from './Hand'
import { Domino } from './Tile'
import { PixelFace } from './PixelFace'

interface Toast {
  key: number
  text: string
  kind: 'info' | 'score'
}

interface GameScreenProps {
  mode: Mode
  onExit: () => void
  onNewGame: () => void
  /**
   * Online 1v1 session. The host runs the canonical engine (host='p',
   * guest='ai'); the guest receives states already swapped so this whole
   * component stays 'p'-centric on both ends.
   */
  online?: OnlineSession | null
}

/** Reconstruct the option flags a match was created with. */
const matchOpts = (m: Match): MatchOptions => ({
  toHundred: m.mode !== 'fives' && m.target > 0,
  drawToPlay: m.mode === 'block' && m.drawing,
})

export function GameScreen({ mode, onExit, onNewGame, online }: GameScreenProps) {
  const { profile, settings, recordMatch, haptic } = useStore()
  const opts = { toHundred: profile.optToHundred, drawToPlay: profile.optDrawToPlay }
  const [match, setMatch] = useState<Match>(() => online?.initialMatch ?? newMatch(mode, opts))
  const [selected, setSelected] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [scorePop, setScorePop] = useState<{ key: number; points: number; seat: string } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null)
  const [hotEnd, setHotEnd] = useState<End | null>(null)
  const [oppLeft, setOppLeft] = useState(false)
  /** Consecutive boneyard draws by the player this turn — drives the mood face. */
  const [drawStreak, setDrawStreak] = useState(0)
  /** Consecutive rival draws this turn — the player's avatar mocks them. */
  const [aiDrawStreak, setAiDrawStreak] = useState(0)
  const inputLock = useRef(0)
  const recorded = useRef<Set<string>>(new Set())
  const toastKey = useRef(0)
  // Latest match for event listeners that outlive a render (drag drop, network).
  const matchRef = useRef(match)
  useEffect(() => {
    matchRef.current = match
  }, [match])

  const isGuest = !!online && !online.isHost
  const oppName = online ? (online.opponent.name || 'RIVAL').toUpperCase().slice(0, 14) : 'AI'
  const oppAvatar = online ? online.opponent.avatar : 'flat'
  const oppAccent = online ? online.opponent.accent : null

  const r = match.round
  const myTurn = !match.over && !r.over && r.turn === 'p'

  const playableIds = useMemo(() => {
    if (!myTurn) return new Set<string>()
    return new Set(legalMoves(r.hands.p, r.chain).map((m) => m.tileId))
  }, [myTurn, r.hands.p, r.chain])

  const selectedTile = selected ? r.hands.p.find((t) => t.id === selected) ?? null : null
  const activeEnds: End[] = useMemo(() => {
    if (!myTurn || !selectedTile) return []
    return legalEndsForTile(selectedTile, r.chain)
  }, [myTurn, selectedTile, r.chain])

  const showToast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    toastKey.current += 1
    setToast({ key: toastKey.current, text, kind })
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 1700)
    return () => clearTimeout(id)
  }, [toast])

  // ------------------------------------------------------------- AI driver
  useEffect(() => {
    if (online) return // remote human plays the other seat
    if (match.over || r.over || r.turn !== 'ai') {
      setAiThinking(false)
      return
    }
    setAiThinking(true)
    const planned = chooseAiAction(match)
    // A readable beat: the AI "thinks" 1.2s before playing.
    const delay = planned.type === 'play' ? 1200 : planned.type === 'draw' ? 550 : 800
    const id = setTimeout(() => {
      setMatch((m) => {
        if (m.over || m.round.over || m.round.turn !== 'ai') return m
        const act = chooseAiAction(m)
        try {
          if (act.type === 'play') return playMove(m, 'ai', act.move)
          if (act.type === 'draw') return drawTile(m)
          return passTurn(m)
        } catch {
          return m
        }
      })
    }, delay)
    return () => clearTimeout(id)
  }, [match, r.over, r.turn, online])

  // ----------------------------------------------------------- network glue
  // Host: broadcast every state change.
  useEffect(() => {
    if (online?.isHost) online.net.send({ t: 'state', match })
  }, [match, online])

  // Both ends: react to incoming messages.
  useEffect(() => {
    if (!online) return
    const net = online.net
    net.setOnMessage((msg) => {
      if (msg.t === 'leave') {
        setOppLeft(true)
        return
      }
      if (online.isHost) {
        setMatch((m) => {
          try {
            if (msg.t === 'move' && !m.over && !m.round.over && m.round.turn === 'ai') {
              return playMove(m, 'ai', msg.move as Move)
            }
            if (msg.t === 'draw' && !m.over && !m.round.over && m.round.turn === 'ai') {
              return drawTile(m, msg.index as number)
            }
            if (msg.t === 'pass' && !m.over && !m.round.over && m.round.turn === 'ai') {
              return passTurn(m)
            }
            if (msg.t === 'nextRound') return nextRound(m)
            if (msg.t === 'rematch' && m.over) return newMatch(m.mode, matchOpts(m))
          } catch {
            /* stale/illegal remote action — ignore */
          }
          return m
        })
      } else if (msg.t === 'state') {
        setMatch(swapPerspective(msg.match as Match))
      }
    })
    net.setOnClose(() => setOppLeft(true))
    return () => {
      net.setOnMessage(null)
      net.setOnClose(null)
    }
  }, [online])

  // ------------------------------------------------- opponent action feedback
  // Sounds, toasts and the mocking devil are derived from state diffs so they
  // work identically for the local AI, the online host, and the online guest.
  const prevMatch = useRef(match)
  useEffect(() => {
    const prev = prevMatch.current
    prevMatch.current = match
    if (prev === match || match.id !== prev.id || match.roundNumber !== prev.roundNumber) return
    const now = match.round
    const was = prev.round
    if (now.chain.length > was.chain.length) {
      const newest = now.chain.reduce((a, b) => (a.seq > b.seq ? a : b))
      if (newest.by === 'ai') sfx.place()
    }
    if (was.turn === 'ai' && now.hands.ai.length > was.hands.ai.length) {
      sfx.draw()
      showToast(`${oppName} DRAWS`)
      setAiDrawStreak((s) => s + 1)
    }
    if (was.turn === 'ai' && now.consecutivePasses > was.consecutivePasses) {
      sfx.pass()
      showToast(`${oppName} PASSES`)
    }
  }, [match, oppName, showToast])

  // ------------------------------------------------------- score + end fx
  useEffect(() => {
    const ev = match.lastScoreEvent
    if (!ev) return
    sfx.score()
    if (ev.seat === 'p') haptic(25)
    setScorePop({ key: ev.seq, points: ev.points, seat: ev.seat })
    const id = setTimeout(() => setScorePop(null), 1400)
    return () => clearTimeout(id)
  }, [match.lastScoreEvent, haptic])

  useEffect(() => {
    if (!match.over || recorded.current.has(match.id)) return
    recorded.current.add(match.id)
    recordMatch(match)
    if (match.winner === 'p') {
      sfx.win()
      haptic(40)
    } else if (match.winner === 'ai') {
      sfx.lose()
    }
  }, [match, recordMatch, haptic])

  // ---------------------------------------------------------- player input
  const locked = () => Date.now() < inputLock.current

  const onSelect = (id: string) => {
    if (!myTurn || locked()) return
    if (selected === id) {
      setSelected(null)
      sfx.deselect()
      return
    }
    if (!playableIds.has(id)) return
    setSelected(id)
    sfx.select()
    haptic(8)
  }

  /** Single validated placement path for click-to-place AND drag-drop. */
  const placeTile = useCallback(
    (tileId: string, end: End) => {
      const m = matchRef.current
      if (Date.now() < inputLock.current) return
      if (m.over || m.round.over || m.round.turn !== 'p') return
      const tile = m.round.hands.p.find((t) => t.id === tileId)
      if (!tile || !legalEndsForTile(tile, m.round.chain).includes(end)) return
      inputLock.current = Date.now() + 400
      if (isGuest) {
        online!.net.send({ t: 'move', move: { tileId, end } })
      } else {
        try {
          setMatch(playMove(m, 'p', { tileId, end }))
        } catch {
          return
        }
      }
      setSelected(null)
      sfx.place()
      haptic(15)
    },
    [haptic, isGuest, online],
  )

  const onPlaceAt = (end: End) => {
    if (!selectedTile || !activeEnds.includes(end)) return
    placeTile(selectedTile.id, end)
  }

  // ------------------------------------------------------------ drag & drop
  const onTilePointerDown = (id: string, e: React.PointerEvent) => {
    if (!myTurn || !playableIds.has(id) || locked()) return
    const x0 = e.clientX
    const y0 = e.clientY
    let started = false

    // Generous drop zone: any point within PAD px of a target frame counts,
    // nearest frame wins — dropping "about there" feels like a real table.
    const endAt = (x: number, y: number): End | null => {
      const PAD = 70
      let best: { end: End; d: number } | null = null
      document.querySelectorAll<HTMLElement>('.board-target').forEach((el) => {
        const b = el.getBoundingClientRect()
        if (x < b.left - PAD || x > b.right + PAD || y < b.top - PAD || y > b.bottom + PAD) return
        const d = Math.hypot(x - (b.left + b.right) / 2, y - (b.top + b.bottom) / 2)
        if (!best || d < best.d) best = { end: el.dataset.end as End, d }
      })
      return best ? (best as { end: End; d: number }).end : null
    }

    const move = (ev: PointerEvent) => {
      if (!started && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) {
        started = true
        setSelected(id) // reveals targets + refits the camera
        sfx.select()
      }
      if (started) {
        setDrag({ id, x: ev.clientX, y: ev.clientY })
        setHotEnd(endAt(ev.clientX, ev.clientY))
      }
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (!started) return // plain click — onClick handles selection
      const dropEnd = endAt(ev.clientX, ev.clientY)
      setDrag(null)
      setHotEnd(null)
      if (dropEnd) {
        placeTile(id, dropEnd)
      } else {
        setSelected(null)
        sfx.deselect()
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  /** Player picks a specific face-down tile from the boneyard tray. */
  const onDraw = (index: number) => {
    if (!myTurn || locked() || !mustDraw(match)) return
    inputLock.current = Date.now() + (isGuest ? 600 : 250)
    if (isGuest) {
      online!.net.send({ t: 'draw', index })
    } else {
      try {
        setMatch((m) => drawTile(m, index))
      } catch {
        return
      }
    }
    setDrawStreak((s) => s + 1)
    sfx.draw()
    haptic(8)
  }

  // Frustration/mockery streaks clear once the stuck player gets to act.
  useEffect(() => {
    setDrawStreak(0)
    setAiDrawStreak(0)
  }, [r.turn, r.chain.length, match.roundNumber, match.id])

  const onPass = () => {
    if (!myTurn || locked() || !mustPass(match)) return
    inputLock.current = Date.now() + 350
    if (isGuest) {
      online!.net.send({ t: 'pass' })
    } else {
      try {
        setMatch(passTurn)
      } catch {
        return
      }
    }
    sfx.pass()
    showToast('YOU PASS')
  }

  const onRematch = () => {
    if (oppLeft) return
    setSelected(null)
    if (isGuest) {
      online!.net.send({ t: 'rematch' })
      showToast('REMATCH REQUESTED')
      return
    }
    setMatch(newMatch(match.mode, online ? matchOpts(match) : opts))
  }

  const onContinueRound = () => {
    setSelected(null)
    if (isGuest) {
      online!.net.send({ t: 'nextRound' })
      return
    }
    setMatch(nextRound)
  }

  const playerMustDraw = myTurn && mustDraw(match)
  const playerMustPass = myTurn && mustPass(match)
  const lastSeq = r.chain.length > 0 ? Math.max(...r.chain.map((t) => t.seq)) : -1

  const name = (profile.name || 'PLAYER').toUpperCase()
  const scored = match.target > 0 // multi-round scoring HUD (fives or to-100)

  // ------------------------------------------------------------ mood face
  // Confidence while dragging, frustration while forced to draw, and a
  // little mocking devil while the rival digs through the boneyard.
  let mood: string | null = null
  if (!match.over && !r.over) {
    if (drawStreak > 0 && myTurn) {
      mood = drawStreak === 1 ? 'mad' : drawStreak === 2 ? 'madder' : 'desperate'
    } else if (aiDrawStreak > 0 && !myTurn) {
      mood = 'devil'
    } else if (drag) {
      const options = playableIds.size
      mood = options <= 1 ? 'unsure' : options === 2 ? 'smile' : 'grin'
    }
  }

  return (
    <div className="screen game-screen">
      {/* ------------------------------------------------ HUD */}
      <header className="game-hud">
        <div className="hud-left">
          <button className="hud-menu" onClick={() => setMenuOpen(true)} aria-label="menu">
            <span />
            <span />
            <span />
          </button>
          <div className="hud-mode">
            <span className="hud-mode-name">{MODE_LABEL[match.mode]}</span>
            {scored && <span className="hud-round">R{match.roundNumber} · TO {match.target}</span>}
          </div>
        </div>

        <div className="hud-players">
          <div className={`hud-player ${myTurn ? 'active' : ''}`}>
            <span className="hud-avatar">
              <PixelFace face={profile.avatar} />
            </span>
            <span className="hud-name">{name}</span>
            {scored ? (
              <span className="hud-score">{match.scores.p}</span>
            ) : (
              <span className="hud-count">{r.hands.p.length}</span>
            )}
          </div>
          <span className="hud-vs">/</span>
          <div className={`hud-player hud-ai ${!myTurn && !r.over && !match.over ? 'active' : ''}`}>
            <span
              className="hud-avatar hud-avatar-ai"
              style={oppAccent ? { background: oppAccent } : undefined}
            >
              <PixelFace face={oppAvatar} />
            </span>
            <span className="hud-name">{oppName}</span>
            {scored ? (
              <span className="hud-score">{match.scores.ai}</span>
            ) : (
              <span className="hud-count">{r.hands.ai.length}</span>
            )}
          </div>
        </div>

        <div className="hud-right">
          {match.drawing && (
            <div className="hud-boneyard" title="boneyard">
              <span className="hud-boneyard-count">{r.boneyard.length}</span>
              <span className="hud-boneyard-label">BONEYARD</span>
            </div>
          )}
        </div>
      </header>

      {/* ------------------------------------------------ BOARD */}
      <div className="game-board-wrap">
        <Board
          chain={r.chain}
          activeEnds={activeEnds}
          onPlaceAt={onPlaceAt}
          lastSeq={lastSeq}
          reducedMotion={settings.reducedMotion}
          refitKey={selected}
          hotEnd={hotEnd}
        />

        {r.chain.length === 0 && myTurn && !selectedTile && (
          <div className="board-hint">SELECT A DOMINO TO OPEN</div>
        )}
        {selectedTile && activeEnds.length > 0 && (
          <div className="board-hint">
            {activeEnds.length === 2 ? 'CHOOSE AN END' : 'TAP THE TARGET'}
          </div>
        )}

        {aiThinking && (
          <div className="ai-indicator">
            <span className="ai-pip" />
            <span className="ai-pip" />
            <span className="ai-pip" />
          </div>
        )}

        {toast && (
          <div key={toast.key} className={`toast toast-${toast.kind}`}>
            {toast.text}
          </div>
        )}

        {scorePop && (
          <div key={scorePop.key} className={`score-pop ${scorePop.seat === 'p' ? 'mine' : 'theirs'}`}>
            +{scorePop.points}
          </div>
        )}

        {mood && (
          <div key={mood} className="mood-chip" aria-hidden>
            <PixelFace face={mood} />
          </div>
        )}
      </div>

      {/* ------------------------------------------------ ACTION BAR */}
      {playerMustDraw && (
        <div className="boneyard-tray">
          <div className="tray-title">
            NO LEGAL MOVE — PICK A TILE · {r.boneyard.length} LEFT
          </div>
          <div className="tray-tiles">
            {r.boneyard.map((t, i) => (
              <button
                key={t.id}
                className="tray-tile"
                onClick={() => onDraw(i)}
                aria-label={`draw face-down tile ${i + 1}`}
              >
                <span className="tray-pivot" />
              </button>
            ))}
          </div>
        </div>
      )}
      {playerMustPass && (
        <div className="action-bar">
          <button className="btn-ink" onClick={onPass}>
            PASS — NO LEGAL MOVE
          </button>
        </div>
      )}

      {/* ------------------------------------------------ HAND */}
      <Hand
        tiles={r.hands.p}
        playableIds={playableIds}
        selectedId={selected}
        draggingId={drag?.id ?? null}
        myTurn={myTurn}
        onSelect={onSelect}
        onTilePointerDown={onTilePointerDown}
      />

      {/* ------------------------------------------------ DRAG GHOST */}
      {drag &&
        (() => {
          const t = r.hands.p.find((x) => x.id === drag.id)
          if (!t) return null
          return (
            <div className={`drag-ghost ${hotEnd ? 'ghost-hot' : ''}`} style={{ left: drag.x, top: drag.y }}>
              <Domino v1={t.a} v2={t.b} vertical owner="p" className="dom-hand" />
            </div>
          )
        })()}

      {/* ------------------------------------------------ ROUND OVERLAY (multi-round interstitial) */}
      {r.over && !match.over && r.result && !oppLeft && (
        <div className="overlay">
          <div className="panel">
            <div className="panel-kicker">ROUND {match.roundNumber}</div>
            <h2 className="panel-title">
              {r.result.winner === 'p'
                ? 'ROUND YOURS'
                : r.result.winner === 'ai'
                  ? `${oppName} ROUND`
                  : 'BLOCKED EVEN'}
            </h2>
            <div className="panel-rows">
              <div className="panel-row">
                <span>{name}</span>
                <b>{match.scores.p}</b>
              </div>
              <div className="panel-row">
                <span>{oppName}</span>
                <b>{match.scores.ai}</b>
              </div>
              {r.result.reason === 'blocked' && (
                <div className="panel-note">
                  BLOCKED · PIPS {r.result.pips.p} / {r.result.pips.ai}
                </div>
              )}
            </div>
            <button className="btn-accent" onClick={onContinueRound}>
              NEXT ROUND
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ MATCH OVERLAY */}
      {match.over && !oppLeft && (
        <MatchResult
          match={match}
          name={name}
          oppName={oppName}
          canRematch={!online || !oppLeft}
          onRematch={onRematch}
          onNewGame={onNewGame}
          onHome={onExit}
        />
      )}

      {/* ------------------------------------------------ OPPONENT LEFT */}
      {oppLeft && (
        <div className="overlay">
          <div className="panel">
            <div className="panel-kicker">CONNECTION</div>
            <h2 className="panel-title">
              {oppName}
              <br />
              LEFT
            </h2>
            <div className="panel-note">
              {match.over ? 'THE RESULT WAS ALREADY RECORDED.' : 'MATCH NOT RECORDED.'}
            </div>
            <button className="btn-accent" onClick={onExit}>
              HOME
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ MENU */}
      {menuOpen && !match.over && !oppLeft && (
        <div className="overlay" onClick={() => setMenuOpen(false)}>
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-kicker">PAUSED</div>
            <h2 className="panel-title">{MODE_LABEL[match.mode]}</h2>
            <button className="btn-accent" onClick={() => setMenuOpen(false)}>
              RESUME
            </button>
            <button
              className="btn-quiet"
              onClick={() => {
                setMenuOpen(false)
                onExit()
              }}
            >
              QUIT MATCH — NOT RECORDED
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- result

function MatchResult({
  match,
  name,
  oppName,
  canRematch,
  onRematch,
  onNewGame,
  onHome,
}: {
  match: Match
  name: string
  oppName: string
  canRematch: boolean
  onRematch: () => void
  onNewGame: () => void
  onHome: () => void
}) {
  const win = match.winner === 'p'
  const tie = match.winner === 'tie'
  const res = match.round.result
  const scored = match.target > 0

  return (
    <div className={`overlay result-overlay ${win ? 'result-win' : tie ? '' : 'result-loss'}`}>
      <div className="result-inner">
        <div className="panel-kicker">
          {MODE_LABEL[match.mode]} · {res?.reason === 'blocked' ? 'BLOCKED' : 'DOMINO'}
        </div>
        <div className="result-mood mood-chip-static" aria-hidden>
          <PixelFace face={win ? 'win' : tie ? 'flat' : 'cry'} />
        </div>
        <h1 className="result-title">{win ? 'WIN' : tie ? 'EVEN' : 'LOSS'}</h1>

        <div className="result-scores">
          <div className={`result-score ${win ? 'lead' : ''}`}>
            <span className="result-score-num">{scored ? match.scores.p : res?.pips.p ?? 0}</span>
            <span className="result-score-name">{name}</span>
          </div>
          <div className={`result-score ${match.winner === 'ai' ? 'lead' : ''}`}>
            <span className="result-score-num">{scored ? match.scores.ai : res?.pips.ai ?? 0}</span>
            <span className="result-score-name">{oppName}</span>
          </div>
        </div>
        {!scored && <div className="panel-note">REMAINING PIPS — LOWER WINS</div>}

        <div className="result-actions">
          {canRematch && (
            <button className="btn-accent" onClick={onRematch}>
              REMATCH
            </button>
          )}
          <button className="btn-ink" onClick={onNewGame}>
            NEW GAME
          </button>
          <button className="btn-quiet" onClick={onHome}>
            HOME
          </button>
        </div>
      </div>
    </div>
  )
}
