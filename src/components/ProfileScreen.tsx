import { useState } from 'react'
import { ACCENTS, useStore } from '../state/store'
import { MODE_LABEL } from '../engine/types'
import { Domino } from './Tile'
import { FACE_NAMES, PixelFace } from './PixelFace'
import { sfx } from '../audio/sound'

export function ProfileScreen({ onBack, onHistory }: { onBack: () => void; onHistory: () => void }) {
  const { profile, stats, updateProfile } = useStore()
  const [name, setName] = useState(profile.name)
  const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0

  return (
    <div className="screen sub">
      <header className="sub-head">
        <button className="back-btn" onClick={onBack}>
          ← HOME
        </button>
        <h1 className="sub-title">PROFILE</h1>
      </header>

      <div className="profile-body">
        <div className="profile-identity">
          <Domino v1={6} v2={3} vertical owner="p" className="dom-preview" />
          <div className="profile-fields">
            <input
              className="setting-input"
              value={name}
              maxLength={14}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && updateProfile({ name: name.trim() })}
            />
            <div className="setting-swatches">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  className={`swatch swatch-sm ${profile.accent === a.id ? 'swatch-on' : ''}`}
                  style={{ background: a.hex }}
                  onClick={() => {
                    updateProfile({ accent: a.id })
                    sfx.select()
                  }}
                  aria-label={a.name}
                />
              ))}
            </div>
            <div className="profile-pref">
              PREFERRED MODE — <b>{MODE_LABEL[profile.preferredMode]}</b>
            </div>
          </div>
        </div>

        <div className="setting-group">
          <div className="panel-kicker">YOUR FACE</div>
          <div className="avatar-grid">
            {FACE_NAMES.map((f) => (
              <button
                key={f}
                className={`avatar-chip ${profile.avatar === f ? 'avatar-on' : ''}`}
                onClick={() => {
                  updateProfile({ avatar: f })
                  sfx.select()
                }}
                aria-label={`avatar ${f}`}
              >
                <PixelFace face={f} />
              </button>
            ))}
          </div>
        </div>

        <div className="stats-big profile-stats">
          <div className="stat-big">
            <span className="stat-num">{stats.gamesPlayed}</span>
            <span className="stat-label">PLAYED</span>
          </div>
          <div className="stat-big">
            <span className="stat-num">{stats.wins}</span>
            <span className="stat-label">WINS</span>
          </div>
          <div className="stat-big">
            <span className="stat-num">{winRate}%</span>
            <span className="stat-label">WIN RATE</span>
          </div>
          <div className="stat-big">
            <span className="stat-num">{stats.bestStreak}</span>
            <span className="stat-label">BEST STREAK</span>
          </div>
        </div>

        <button className="btn-ink" onClick={onHistory}>
          GAME HISTORY →
        </button>
      </div>
    </div>
  )
}
