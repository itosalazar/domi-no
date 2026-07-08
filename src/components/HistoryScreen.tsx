import { MODE_LABEL } from '../engine/types'
import { accentById, useStore } from '../state/store'

function fmtDate(ts: number) {
  const d = new Date(ts)
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()} · ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
}

function fmtDur(s: number) {
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}M ${s % 60}S` : `${s}S`
}

export function HistoryScreen({ onBack }: { onBack: () => void }) {
  const { history } = useStore()

  return (
    <div className="screen sub">
      <header className="sub-head">
        <button className="back-btn" onClick={onBack}>
          ← HOME
        </button>
        <h1 className="sub-title">HISTORY</h1>
      </header>

      {history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-pips">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} />
            ))}
          </div>
          <p>NO MATCHES ON RECORD.<br />FINISH A GAME AND IT LANDS HERE.</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((h) => (
            <div key={h.id} className={`history-row hr-${h.result}`}>
              <span className="hr-dot" style={{ background: accentById(h.accent).hex }} />
              <span className="hr-result">{h.result === 'win' ? 'W' : h.result === 'loss' ? 'L' : '='}</span>
              <span className="hr-mode">{MODE_LABEL[h.mode]}</span>
              <span className="hr-score">
                {h.scoreP}–{h.scoreAi}
              </span>
              <span className="hr-meta">
                {h.rounds > 1 ? `${h.rounds}R · ` : ''}
                {fmtDur(h.durationSec)}
              </span>
              <span className="hr-date">{fmtDate(h.date)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
