import type { Tile } from '../engine/types'
import { Domino } from './Tile'

interface HandProps {
  tiles: Tile[]
  playableIds: Set<string>
  selectedId: string | null
  /** id of the tile currently being dragged (its slot dims while the ghost flies). */
  draggingId: string | null
  myTurn: boolean
  onSelect: (id: string) => void
  onTilePointerDown: (id: string, e: React.PointerEvent) => void
}

export function Hand({
  tiles,
  playableIds,
  selectedId,
  draggingId,
  myTurn,
  onSelect,
  onTilePointerDown,
}: HandProps) {
  return (
    <div className={`hand ${myTurn ? '' : 'hand-waiting'}`}>
      {tiles.map((t) => {
        const playable = myTurn && playableIds.has(t.id)
        const selected = t.id === selectedId
        const dragging = t.id === draggingId
        return (
          <button
            key={t.id}
            className={`hand-slot ${playable ? 'playable' : 'unplayable'} ${selected ? 'selected' : ''} ${dragging ? 'drag-src' : ''}`}
            onClick={() => onSelect(t.id)}
            onPointerDown={(e) => onTilePointerDown(t.id, e)}
            aria-label={`domino ${t.a} ${t.b}${playable ? ', playable' : ''}`}
          >
            <Domino v1={t.a} v2={t.b} vertical owner="p" className="dom-hand" />
            <span className="hand-dot" />
          </button>
        )
      })}
    </div>
  )
}
