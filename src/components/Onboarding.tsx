import { useState } from 'react'
import { ACCENTS, useStore } from '../state/store'
import { Domino } from './Tile'
import { sfx } from '../audio/sound'

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { profile, updateProfile } = useStore()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(profile.name)

  const canNext = step === 0 ? name.trim().length > 0 : true

  const next = () => {
    if (!canNext) return
    sfx.select()
    if (step === 0) updateProfile({ name: name.trim().slice(0, 14) })
    if (step === 2) {
      updateProfile({ onboarded: true })
      onDone()
      return
    }
    setStep(step + 1)
  }

  return (
    <div className="screen onboarding">
      <div className="ob-step-num">{`0${step + 1}`}</div>

      {step === 0 && (
        <div className="ob-body">
          <div className="panel-kicker">NEW PLAYER</div>
          <h1 className="ob-title">WHAT'S<br />YOUR NAME</h1>
          <input
            className="ob-input"
            value={name}
            autoFocus
            maxLength={14}
            placeholder="TYPE IT"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && next()}
          />
        </div>
      )}

      {step === 1 && (
        <div className="ob-body">
          <div className="panel-kicker">IDENTITY</div>
          <h1 className="ob-title">PICK YOUR<br />COLOR</h1>
          <div className="ob-swatches">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                className={`swatch ${profile.accent === a.id ? 'swatch-on' : ''}`}
                style={{ background: a.hex }}
                onClick={() => {
                  updateProfile({ accent: a.id })
                  sfx.select()
                }}
                aria-label={a.name}
              />
            ))}
          </div>
          <div className="ob-swatch-name">
            {ACCENTS.find((a) => a.id === profile.accent)?.name}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="ob-body">
          <div className="panel-kicker">YOUR MARK</div>
          <h1 className="ob-title">{(name || 'PLAYER').toUpperCase()}</h1>
          <div className="ob-preview">
            <Domino v1={6} v2={3} vertical owner="p" className="dom-preview" />
          </div>
          <p className="ob-note">
            WHITE TILES · BLACK PIPS · YOUR COLOR AT THE PIVOT.
            <br />
            THE AI PLAYS THE BLACK TILES.
          </p>
        </div>
      )}

      <div className="ob-footer">
        <div className="ob-progress">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`ob-dot ${i <= step ? 'on' : ''}`} />
          ))}
        </div>
        <button className="btn-accent" disabled={!canNext} onClick={next}>
          {step === 2 ? 'ENTER' : 'NEXT'}
        </button>
      </div>
    </div>
  )
}
