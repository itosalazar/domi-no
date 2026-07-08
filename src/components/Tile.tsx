/** Domino faces: pure geometry — rectangle, circular pips, a small × at the pivot. */

const POS: Record<string, [number, number]> = {
  tl: [28, 28],
  tr: [72, 28],
  ml: [28, 50],
  mr: [72, 50],
  bl: [28, 72],
  br: [72, 72],
  c: [50, 50],
}

/** The six packs its two columns tighter so the cluster sits centered. */
const POS6: Record<string, [number, number]> = {
  tl: [34, 30],
  ml: [34, 50],
  bl: [34, 70],
  tr: [66, 30],
  mr: [66, 50],
  br: [66, 70],
}

const PIP_MAP: string[][] = [
  [],
  ['c'],
  ['tl', 'br'],
  ['tl', 'c', 'br'],
  ['tl', 'tr', 'bl', 'br'],
  ['tl', 'tr', 'c', 'bl', 'br'],
  ['tl', 'ml', 'bl', 'tr', 'mr', 'br'],
]

/** Which pip turns accent on white faces — one per value, systematic. */
const ACCENT_PIP: Record<number, number> = { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 4 }

interface PipFaceProps {
  value: number
  color: string
  /** pip radius in the 100-unit box (smaller = more Rams) */
  r?: number
  /** paint one pip in the accent color */
  accented?: boolean
}

export function PipFace({ value, color, r = 5.5, accented = false }: PipFaceProps) {
  const accentIdx = accented ? ACCENT_PIP[value] : -1
  const pos = value === 6 ? POS6 : POS
  return (
    <svg viewBox="0 0 100 100" className="pipface" aria-hidden>
      {PIP_MAP[value].map((k, i) => {
        const [x, y] = pos[k]
        return <circle key={k} cx={x} cy={y} r={r} fill={i === accentIdx ? 'var(--accent)' : color} />
      })}
    </svg>
  )
}

export type TileOwner = 'p' | 'ai'
export type TileSurface = 'hand' | 'board'

interface DominoProps {
  v1: number
  v2: number
  vertical: boolean
  owner: TileOwner
  /** hand: white face, accent pips. board (player): full accent face, white pips. */
  surface?: TileSurface
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}

/**
 * Player tiles: strokeless white everywhere — small ink pips, one accent pip
 * per half, accent × at the pivot. AI tiles: solid near-black, white pips.
 */
export function Domino({ v1, v2, vertical, owner, surface = 'hand', className = '', style, onClick }: DominoProps) {
  const pip = owner === 'ai' ? 'var(--paper)' : 'var(--ink)'
  return (
    <div
      className={`domino ${vertical ? 'dom-v' : 'dom-h'} dom-${owner} ${className}`}
      style={style}
      onClick={onClick}
    >
      <div className="dom-half">
        <PipFace value={v1} color={pip} accented={owner === 'p'} />
      </div>
      <div className="dom-divider">
        <span className="dom-x" />
      </div>
      <div className="dom-half">
        <PipFace value={v2} color={pip} accented={owner === 'p'} />
      </div>
    </div>
  )
}
