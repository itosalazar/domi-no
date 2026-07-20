import { useState } from 'react'
import { ACCENTS, useStore } from '../state/store'
import { sfx } from '../audio/sound'

const YEAR = new Date().getFullYear()

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button className="setting-row" onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="setting-label">{label}</span>
      <span className={`toggle ${on ? 'toggle-on' : ''}`}>
        <span className="toggle-pip" />
      </span>
    </button>
  )
}

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { profile, settings, updateProfile, updateSettings, resetStats } = useStore()
  const [name, setName] = useState(profile.name)
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="screen sub">
      <header className="sub-head">
        <button className="back-btn" onClick={onBack}>
          ← HOME
        </button>
        <h1 className="sub-title">SETTINGS</h1>
      </header>

      <div className="settings-body">
        <div className="setting-group">
          <div className="panel-kicker">PLAYER</div>
          <input
            className="setting-input"
            value={name}
            maxLength={14}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && updateProfile({ name: name.trim() })}
            placeholder="NAME"
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
        </div>

        <div className="setting-group">
          <div className="panel-kicker">FEEDBACK</div>
          <Toggle on={settings.sound} onChange={(v) => updateSettings({ sound: v })} label="SOUND" />
          <Toggle on={settings.haptics} onChange={(v) => updateSettings({ haptics: v })} label="HAPTICS" />
          <Toggle
            on={settings.reducedMotion}
            onChange={(v) => updateSettings({ reducedMotion: v })}
            label="REDUCED MOTION"
          />
        </div>

        <div className="setting-group">
          <div className="panel-kicker">DATA</div>
          {!confirmReset ? (
            <button className="btn-quiet danger" onClick={() => setConfirmReset(true)}>
              RESET STATISTICS + HISTORY
            </button>
          ) : (
            <div className="reset-confirm">
              <span>ERASE EVERYTHING?</span>
              <button
                className="btn-ink"
                onClick={() => {
                  resetStats()
                  setConfirmReset(false)
                }}
              >
                YES, ERASE
              </button>
              <button className="btn-quiet" onClick={() => setConfirmReset(false)}>
                KEEP
              </button>
            </div>
          )}
        </div>

        <div className="setting-group">
          <div className="panel-kicker">CREDITS</div>
          <div className="credits">
            <span className="credits-name">ITO SALAZAR</span>
            <a
              className="credits-link"
              href="https://www.itosalazar.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              www.itosalazar.com
            </a>
            <span className="credits-copy">© {YEAR} ITO SALAZAR · ALL RIGHTS RESERVED</span>
          </div>
        </div>
      </div>
    </div>
  )
}
