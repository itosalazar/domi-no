import { useStore } from '../state/store'

export function StatsScreen({ onBack }: { onBack: () => void }) {
  const { stats } = useStore()
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0
  const avgScore = stats.fivesMatches > 0 ? Math.round(stats.totalPoints / stats.fivesMatches) : 0

  const big = [
    { n: stats.gamesPlayed, l: 'PLAYED' },
    { n: stats.wins, l: 'WINS' },
    { n: stats.losses, l: 'LOSSES' },
    { n: `${winRate}%`, l: 'WIN RATE' },
  ]
  const small = [
    { n: stats.currentStreak, l: 'STREAK' },
    { n: stats.bestStreak, l: 'BEST STREAK' },
    { n: stats.blockWins, l: 'BLOCK WINS' },
    { n: stats.drawWins, l: 'DRAW WINS' },
    { n: stats.fivesWins, l: 'FIVES WINS' },
    { n: stats.totalPoints, l: 'FIVES POINTS' },
    { n: avgScore, l: 'AVG SCORE' },
    { n: stats.dominoesPlayed, l: 'TILES PLAYED' },
    { n: stats.tilesDrawn, l: 'TILES DRAWN' },
    { n: stats.passes, l: 'PASSES' },
    { n: stats.roundsPlayed, l: 'ROUNDS' },
    { n: stats.matchesCompleted, l: 'MATCHES' },
  ]

  return (
    <div className="screen sub">
      <header className="sub-head">
        <button className="back-btn" onClick={onBack}>
          ← HOME
        </button>
        <h1 className="sub-title">STATS</h1>
      </header>

      {stats.gamesPlayed === 0 ? (
        <div className="empty-state">
          <div className="empty-pips">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} />
            ))}
          </div>
          <p>NOTHING COUNTED YET.<br />EVERY NUMBER HERE COMES FROM REAL PLAY.</p>
        </div>
      ) : (
        <>
          <div className="stats-big">
            {big.map((s) => (
              <div key={s.l} className="stat-big">
                <span className="stat-num">{s.n}</span>
                <span className="stat-label">{s.l}</span>
              </div>
            ))}
          </div>
          <div className="stats-grid">
            {small.map((s) => (
              <div key={s.l} className="stat-cell">
                <span className="stat-num-sm">{s.n}</span>
                <span className="stat-label">{s.l}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
