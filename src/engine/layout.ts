import type { End, Placed } from './types'

/**
 * Board layout: pure function from the logical chain to cell coordinates.
 *
 * The first tile ever played anchors the origin. The chain then grows as two
 * arms — the right arm snakes rightward and wraps downward, the left arm
 * snakes leftward and wraps upward, so the two arms can never collide.
 *
 * Regular tiles occupy two adjacent cells along the walk. Doubles on a
 * straight run occupy a SINGLE cell and render perpendicular across the
 * line, so neighbors sit flush against them like physical dominoes. A double
 * that lands exactly on a snake turn renders along the travel axis instead
 * (perpendicular there would overlap the previous row).
 */

export const CELL = 44 // px per board cell at zoom 1

const XMAX = 6 // right-most cell of a horizontal run
const XMIN = -7 // left-most cell of a horizontal run
const inX = (x: number) => x >= XMIN && x <= XMAX

export interface LaidTile {
  id: string
  placed: Placed
  /** cells (unit coords); x1==x2 && y1==y2 for perpendicular doubles */
  x1: number
  y1: number
  x2: number
  y2: number
  /** pip values shown at half1/half2 */
  v1: number
  v2: number
  /** drawing orientation of the long axis */
  vertical: boolean
  /** double drawn across the line of travel on a single cell */
  perp: boolean
  isDouble: boolean
}

export interface TargetSlot {
  end: End
  x1: number
  y1: number
  x2: number
  y2: number
  horizontal: boolean
}

export interface BoardLayout {
  tiles: LaidTile[]
  targets: TargetSlot[]
  /** bounding box in cell units, inclusive of targets and perp overhang */
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface Cursor {
  x: number
  y: number
  horiz: 1 | -1
  vSign: 1 | -1
}

function walkArm(
  tiles: Placed[],
  start: { x: number; y: number },
  horiz: 1 | -1,
  vSign: 1 | -1,
  outward: boolean, // true when walking away from anchor on the left arm
  out: LaidTile[],
): Cursor {
  const c: Cursor = { x: start.x, y: start.y, horiz, vSign }
  let prevAxisH = true // both arms connect to the horizontal anchor row
  for (const t of tiles) {
    const isDbl = t.a === t.b
    const len = isDbl ? 1 : 2
    const endX = c.x + (len - 1) * c.horiz
    let dx: number
    let dy: number
    let flip = false
    if (inX(endX)) {
      dx = c.horiz
      dy = 0
    } else {
      dx = 0
      dy = c.vSign
      flip = true
    }
    const axisH = dy === 0
    const perp = isDbl && axisH === prevAxisH
    const x1 = c.x
    const y1 = c.y
    const x2 = perp ? x1 : x1 + dx
    const y2 = perp ? y1 : y1 + dy
    // `inner` is the pip value facing the anchor (i.e. the previous tile).
    const inner = outward ? t.right : t.left
    const outer = outward ? t.left : t.right
    // The renderer always draws v1 at the left/top half. When this arm walks
    // in the negative direction, the inner half sits at the RIGHT/BOTTOM cell,
    // so the display order flips.
    const negative = dx < 0 || dy < 0
    out.push({
      id: t.id,
      placed: t,
      x1,
      y1,
      x2,
      y2,
      v1: negative ? outer : inner,
      v2: negative ? inner : outer,
      vertical: perp ? axisH : !axisH,
      perp,
      isDouble: isDbl,
    })
    c.x = x2 + dx
    c.y = y2 + dy
    if (flip) c.horiz = (c.horiz * -1) as 1 | -1
    prevAxisH = axisH
  }
  return c
}

/** Footprint for the NEXT placement at an arm's cursor (always 2 cells). */
function slotAt(c: Cursor, end: End): TargetSlot {
  const horizontal = inX(c.x + c.horiz)
  const dx = horizontal ? c.horiz : 0
  const dy = horizontal ? 0 : c.vSign
  return { end, x1: c.x, y1: c.y, x2: c.x + dx, y2: c.y + dy, horizontal }
}

export function computeLayout(chain: Placed[], openEnds: End[]): BoardLayout {
  const tiles: LaidTile[] = []
  const targets: TargetSlot[] = []

  if (chain.length === 0) {
    if (openEnds.length > 0) {
      targets.push({ end: 'R', x1: 0, y1: 0, x2: 1, y2: 0, horizontal: true })
    }
    return { tiles, targets, minX: -1, minY: -1, maxX: 2, maxY: 1 }
  }

  // The anchor is the tile with the lowest placement seq.
  let anchorIdx = 0
  for (let i = 1; i < chain.length; i++) {
    if (chain[i].seq < chain[anchorIdx].seq) anchorIdx = i
  }

  const rightArm = chain.slice(anchorIdx) // anchor first, walking right
  const leftArm = chain.slice(0, anchorIdx).reverse() // nearest-to-anchor first, walking left

  const rightCursor = walkArm(rightArm, { x: 0, y: 0 }, 1, 1, false, tiles)
  // The left arm starts flush against whatever the anchor occupies.
  const anchorLaid = tiles[0]
  const leftStartX = Math.min(anchorLaid.x1, anchorLaid.x2) - 1
  const leftCursor = walkArm(leftArm, { x: leftStartX, y: 0 }, -1, -1, true, tiles)

  if (openEnds.includes('R')) targets.push(slotAt(rightCursor, 'R'))
  if (openEnds.includes('L')) targets.push(slotAt(leftCursor, 'L'))

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const consider = (x: number, y: number) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + 1)
    maxY = Math.max(maxY, y + 1)
  }
  for (const t of tiles) {
    if (t.perp) {
      // half-cell overhang across the line of travel
      if (t.vertical) {
        consider(t.x1, t.y1 - 0.5)
        consider(t.x1, t.y1 + 0.5)
      } else {
        consider(t.x1 - 0.5, t.y1)
        consider(t.x1 + 0.5, t.y1)
      }
    } else {
      consider(t.x1, t.y1)
      consider(t.x2, t.y2)
    }
  }
  for (const t of targets) {
    consider(t.x1, t.y1)
    consider(t.x2, t.y2)
  }
  return { tiles, targets, minX, minY, maxX, maxY }
}

/** Pixel rect (center + size) for a footprint, drawn along the given axis. */
export function footprintRect(
  f: { x1: number; y1: number; x2: number; y2: number },
  vertical: boolean,
) {
  const cx = ((f.x1 + f.x2) / 2 + 0.5) * CELL
  const cy = ((f.y1 + f.y2) / 2 + 0.5) * CELL
  // Long axis is 2 cells, short axis 1 cell; hairline inset so chained tiles
  // sit nearly flush, like physical dominoes.
  const long = CELL * 2 - 2
  const short = CELL - 2
  return { cx, cy, w: vertical ? short : long, h: vertical ? long : short }
}
