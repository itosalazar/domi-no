import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { End, Placed } from '../engine/types'
import { CELL, NARROW_BOUNDS, WIDE_BOUNDS, computeLayout, footprintRect } from '../engine/layout'
import { Domino } from './Tile'

interface Camera {
  cx: number // board point centered in the viewport (px)
  cy: number
  s: number
  manual: boolean
}

interface BoardProps {
  chain: Placed[]
  /** Which open ends should show placement targets (selected tile's legal ends). */
  activeEnds: End[]
  onPlaceAt: (end: End) => void
  /** seq of the most recently placed tile — drives the landing animation. */
  lastSeq: number
  reducedMotion: boolean
  /** Changes whenever a hand tile is selected — forces a refit so ALL targets are visible. */
  refitKey?: string | null
  /** End currently hovered by a dragged tile. */
  hotEnd?: End | null
}

export function Board({
  chain,
  activeEnds,
  onPlaceAt,
  lastSeq,
  reducedMotion,
  refitKey,
  hotEnd,
}: BoardProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  // Phones get shorter runs (5 tiles per row) so the camera zooms out less.
  const [narrow, setNarrow] = useState(() => window.innerWidth < 640)
  const layout = useMemo(
    () => computeLayout(chain, activeEnds, narrow ? NARROW_BOUNDS : WIDE_BOUNDS),
    [chain, activeEnds, narrow],
  )
  const [cam, setCam] = useState<Camera>({ cx: CELL, cy: CELL / 2, s: 1, manual: false })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)

  // ---- auto-fit camera whenever the board grows (unless the user took over)
  const fit = useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    const vw = el.clientWidth
    const vh = el.clientHeight
    if (vw === 0 || vh === 0) return
    // Tighter margins on phones so the tiles stay as large as possible.
    const pad = vw < 640 ? 26 : 90
    const bw = (layout.maxX - layout.minX) * CELL + pad * 2
    const bh = (layout.maxY - layout.minY) * CELL + pad * 2
    const s = Math.min(Math.min(vw / bw, vh / bh), 1.05)
    setCam((c) => ({
      cx: ((layout.minX + layout.maxX) / 2) * CELL,
      cy: ((layout.minY + layout.maxY) / 2) * CELL,
      s: Math.max(s, 0.3),
      manual: false,
    }))
  }, [layout])

  useEffect(() => {
    if (!cam.manual) fit()
    // Refocus on every new placement even after manual pan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain.length])

  // Selecting a tile must always reveal every placement target, even after
  // the user panned or zoomed away.
  useEffect(() => {
    if (refitKey != null) fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refitKey])

  useEffect(() => {
    if (!cam.manual) fit()
  }, [layout, fit, cam.manual])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const obs = new ResizeObserver(() => {
      setNarrow(el.clientWidth < 640)
      setCam((c) => (c.manual ? c : { ...c }))
      fit()
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [fit])

  // ---- manual pan / zoom
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.board-target')) return
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < 4) return
    d.moved = true
    setDragging(true)
    d.x = e.clientX
    d.y = e.clientY
    setCam((c) => ({ ...c, cx: c.cx - dx / c.s, cy: c.cy - dy / c.s, manual: true }))
  }
  const onPointerUp = () => {
    dragRef.current = null
    setDragging(false)
  }
  const onWheel = (e: React.WheelEvent) => {
    setCam((c) => {
      const s = Math.min(2, Math.max(0.25, c.s * Math.exp(-e.deltaY * 0.0012)))
      return { ...c, s, manual: true }
    })
  }

  const vw = viewportRef.current?.clientWidth ?? 0
  const vh = viewportRef.current?.clientHeight ?? 0
  const tx = vw / 2 - cam.cx * cam.s
  const ty = vh / 2 - cam.cy * cam.s

  const last = layout.tiles.find((t) => t.placed.seq === lastSeq)
  const lastRect = last ? footprintRect(last, last.vertical) : null

  return (
    <div
      ref={viewportRef}
      className={`board ${dragging ? 'board-dragging' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div
        className="board-cam"
        style={{ transform: `translate(${tx}px, ${ty}px) scale(${cam.s})` }}
      >
        <div className="board-grid" />
        {!reducedMotion && lastRect && (
          <div
            key={`wave-${lastSeq}`}
            className="board-grid board-dotwave"
            style={
              {
                // mask center in grid-layer coordinates (layer origin is -2600,-2600)
                '--wx': `${lastRect.cx + 2600}px`,
                '--wy': `${lastRect.cy + 2600}px`,
              } as React.CSSProperties
            }
          />
        )}

        {layout.tiles.map((t) => {
          const r = footprintRect(t, t.vertical)
          const isLast = t.placed.seq === lastSeq
          return (
            <div
              key={t.id}
              className={`board-tile ${isLast && !reducedMotion ? 'tile-land' : ''}`}
              style={{ left: r.cx, top: r.cy, width: r.w, height: r.h }}
            >
              <Domino
                v1={t.v1}
                v2={t.v2}
                vertical={t.vertical}
                owner={t.placed.by}
                surface="board"
                className="dom-board"
              />
            </div>
          )
        })}

        {layout.targets.map((t) => {
          // Target footprint sits along the walk axis (not perpendicular).
          const r = footprintRect(t, !t.horizontal)
          return (
            <button
              key={t.end}
              data-end={t.end}
              className={`board-target ${hotEnd === t.end ? 'target-hot' : ''}`}
              style={{ left: r.cx, top: r.cy, width: r.w, height: r.h }}
              onClick={() => onPlaceAt(t.end)}
              aria-label={`place on ${t.end === 'L' ? 'left' : 'right'} end`}
            >
              <span className="target-pip" />
            </button>
          )
        })}

      </div>

      {cam.manual && (
        <button className="board-recenter" onClick={fit}>
          ⊙ RECENTER
        </button>
      )}
    </div>
  )
}