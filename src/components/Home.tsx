import type { Mode } from '../engine/types'
import { useStore } from '../state/store'
import { sfx } from '../audio/sound'
import { PipFace } from './Tile'
import { PixelFace } from './PixelFace'

const MODES: { mode: Mode; pips: number; label: string; sub: string }[] = [
  { mode: 'block', pips: 1, label: 'BLOCK', sub: 'NO DRAWING · PURE POSITION' },
  { mode: 'draw', pips: 2, label: 'DRAW', sub: 'BONEYARD OPEN · KEEP MOVING' },
  { mode: 'fives', pips: 3, label: 'ALL FIVES', sub: 'ENDS ÷ 5 SCORE · FIRST TO 100' },
]

interface HomeProps {
  onPlay: (mode: Mode) => void
  onNav: (screen: 'profile' | 'stats' | 'history' | 'settings' | 'rules' | 'friend') => void
}

export function Home({ onPlay, onNav }: HomeProps) {
  const { profile, stats, updateProfile } = useStore()
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : null

  return (
    <div className="screen home">
      <header className="home-head">
        <div className="home-brand">
          <span className="brand-pip" />
          DOMI–NO
        </div>
        <button className="home-profile" onClick={() => onNav('profile')}>
          {(profile.name || 'PLAYER').toUpperCase()}
          <span className="home-profile-face">
            <PixelFace face={profile.avatar} />
          </span>
        </button>
      </header>

      <div className="home-hero">
        <div className="home-hello">
          <div className="panel-kicker">VERSUS AI · DOUBLE SIX</div>
          <h1 className="home-title">
            PLAY
            <br />
            DOMINOES
          </h1>
          {winRate !== null ? (
            <div className="home-statline">
              {stats.gamesPlayed} PLAYED · {winRate}% WON ·{' '}
              {stats.currentStreak > 0 ? `W${stats.currentStreak} STREAK` : stats.currentStreak < 0 ? `L${-stats.currentStreak} STREAK` : 'EVEN'}
            </div>
          ) : (
            <div className="home-statline">FIRST MATCH AWAITS</div>
          )}
        </div>

        <nav className="home-modes">
          {MODES.map((m) => (
            <button
              key={m.mode}
              className={`mode-row ${profile.preferredMode === m.mode ? 'mode-preferred' : ''}`}
              onClick={() => {
                updateProfile({ preferredMode: m.mode })
                sfx.select()
                onPlay(m.mode)
              }}
            >
              <span className={`mode-pips ${profile.preferredMode === m.mode ? 'mode-pips-on' : ''}`}>
                <PipFace value={m.pips} color="currentColor" r={11} />
              </span>
              <span className="mode-label">{m.label}</span>
              <span className="mode-sub">{m.sub}</span>
              <span className="mode-go">→</span>
            </button>
          ))}
          <button
            className="mode-row"
            onClick={() => {
              sfx.select()
              onNav('friend')
            }}
          >
            <span className="mode-pips mode-pips-friend">
              <PixelFace face="devil" />
            </span>
            <span className="mode-label">VS FRIEND</span>
            <span className="mode-sub">INVITE LINK · LIVE 1V1</span>
            <span className="mode-go">→</span>
          </button>
        </nav>
      </div>

      <footer className="home-foot">
        <button onClick={() => onNav('stats')}>STATS</button>
        <button onClick={() => onNav('history')}>HISTORY</button>
        <button onClick={() => onNav('rules')}>RULES</button>
        <button onClick={() => onNav('settings')}>SETTINGS</button>
      </footer>
    </div>
  )
}
