import type { Mode } from '../engine/types'
import { MODE_LABEL } from '../engine/types'
import { useStore } from '../state/store'
import { Domino } from './Tile'
import { sfx } from '../audio/sound'

interface SetupProps {
  mode: Mode
  onStart: () => void
  onBack: () => void
}

function OptionToggle({
  on,
  onChange,
  label,
  sub,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
  sub: string
}) {
  return (
    <button
      className="setting-row option-row"
      onClick={() => {
        onChange(!on)
        sfx.select()
      }}
      role="switch"
      aria-checked={on}
    >
      <span className="option-text">
        <span className="setting-label">{label}</span>
        <span className="option-sub">{sub}</span>
      </span>
      <span className={`toggle ${on ? 'toggle-on' : ''}`}>
        <span className="toggle-pip" />
      </span>
    </button>
  )
}

export function SetupScreen({ mode, onStart, onBack }: SetupProps) {
  const { profile, updateProfile } = useStore()
  const toHundred = mode !== 'fives' && profile.optToHundred
  const drawToPlay = mode === 'block' && profile.optDrawToPlay

  const rules: string[] =
    mode === 'fives'
      ? ['OPEN ENDS DIVISIBLE BY 5 SCORE', 'GOING OUT BANKS OPPONENT PIPS', 'FIRST TO 100 TAKES THE MATCH']
      : [
          mode === 'draw'
            ? '7 TILES EACH · 14 IN THE BONEYARD'
            : drawToPlay
              ? '7 TILES EACH · BONEYARD IN PLAY'
              : '7 TILES EACH · 14 SET ASIDE',
          mode === 'draw' || drawToPlay ? 'NO MOVE? DRAW UNTIL YOU CAN' : 'MATCH AN OPEN END OR PASS',
          toHundred
            ? 'ROUND WINNER BANKS OPPONENT PIPS · FIRST TO 100'
            : 'FIRST OUT WINS · BLOCKED → FEWEST PIPS',
        ]

  return (
    <div className="screen setup">
      <header className="sub-head">
        <button className="back-btn" onClick={onBack}>
          ← HOME
        </button>
      </header>

      <div className="setup-body">
        <div className="panel-kicker">NEW MATCH</div>
        <h1 className="setup-title">{MODE_LABEL[mode]}</h1>

        <ul className="setup-rules">
          {rules.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        {mode !== 'fives' && (
          <div className="setup-options">
            {mode === 'block' && (
              <OptionToggle
                on={profile.optDrawToPlay}
                onChange={(v) => updateProfile({ optDrawToPlay: v })}
                label="DRAW, DON'T PASS"
                sub="NO MOVE? GRAB FROM THE BONEYARD UNTIL YOU CAN PLAY"
              />
            )}
            <OptionToggle
              on={profile.optToHundred}
              onChange={(v) => updateProfile({ optToHundred: v })}
              label="PLAY TO 100"
              sub="ROUND WINNER BANKS OPPONENT'S REMAINING PIPS"
            />
          </div>
        )}

        <div className="setup-vs">
          <div className="setup-side">
            <Domino v1={4} v2={2} vertical owner="p" className="dom-setup" />
            <span>{(profile.name || 'PLAYER').toUpperCase()}</span>
          </div>
          <span className="setup-slash">/</span>
          <div className="setup-side">
            <Domino v1={5} v2={1} vertical owner="ai" className="dom-setup" />
            <span>AI</span>
          </div>
        </div>

        <button className="btn-accent btn-start" onClick={onStart}>
          START
        </button>
      </div>
    </div>
  )
}
