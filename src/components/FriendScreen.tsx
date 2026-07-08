import { useEffect, useRef, useState } from 'react'
import type { Mode } from '../engine/types'
import { MODE_LABEL } from '../engine/types'
import { useStore } from '../state/store'
import { hostRoom, makeRoomCode, roomUrl } from '../net/peer'
import type { HostRoom, Net, OnlineSession } from '../net/peer'
import { OptionToggle } from './SetupScreen'
import { PipFace } from './Tile'
import { sfx } from '../audio/sound'

type Status = 'config' | 'opening' | 'waiting' | 'error'

interface FriendScreenProps {
  onSession: (session: OnlineSession, mode: Mode) => void
  onBack: () => void
}

/** Host lobby: pick the rules, mint an invite link, wait for the friend. */
export function FriendScreen({ onSession, onBack }: FriendScreenProps) {
  const { profile, updateProfile } = useStore()
  const [mode, setMode] = useState<Mode>(profile.preferredMode)
  const [status, setStatus] = useState<Status>('config')
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)
  const roomRef = useRef<HostRoom | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    return () => roomRef.current?.cancel()
  }, [])

  const create = (attempt = 0) => {
    const c = makeRoomCode()
    setCode(c)
    setStatus('opening')
    roomRef.current = hostRoom(c, {
      onReady: () => setStatus('waiting'),
      onGuest: (net: Net) => {
        // Handshake: guest introduces itself, we reply, then hand off to the game.
        net.setOnMessage((msg) => {
          if (msg.t !== 'hello' || startedRef.current) return
          startedRef.current = true
          net.send({
            t: 'welcome',
            name: profile.name,
            avatar: profile.avatar,
            accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
          })
          net.setOnMessage(null)
          onSession(
            {
              isHost: true,
              net,
              opponent: {
                name: String(msg.name ?? ''),
                avatar: String(msg.avatar ?? 'flat'),
                accent: String(msg.accent ?? '#5b6165'),
              },
            },
            mode,
          )
        })
        net.setOnClose(() => {
          if (!startedRef.current) setStatus('error')
        })
      },
      onError: (kind) => {
        if (kind === 'taken' && attempt < 3) create(attempt + 1)
        else setStatus('error')
      },
    })
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl(code))
      setCopied(true)
      sfx.select()
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable — the link is visible to copy manually */
    }
  }

  return (
    <div className="screen sub">
      <header className="sub-head">
        <button
          className="back-btn"
          onClick={() => {
            roomRef.current?.cancel()
            onBack()
          }}
        >
          ← HOME
        </button>
        <h1 className="sub-title">VS FRIEND</h1>
      </header>

      {status === 'config' || status === 'opening' ? (
        <div className="friend-body">
          <div className="panel-kicker">PICK THE RULES</div>
          <div className="friend-modes">
            {(['block', 'draw', 'fives'] as Mode[]).map((m, i) => (
              <button
                key={m}
                className={`friend-mode ${mode === m ? 'friend-mode-on' : ''}`}
                onClick={() => {
                  setMode(m)
                  sfx.select()
                }}
              >
                <span className="mode-pips">
                  <PipFace value={i + 1} color="currentColor" r={11} />
                </span>
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>

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

          <button className="btn-accent btn-start" disabled={status === 'opening'} onClick={() => create()}>
            {status === 'opening' ? 'OPENING ROOM…' : 'CREATE INVITE'}
          </button>
          <p className="friend-note">
            YOU'LL GET A LINK TO SEND. YOUR FRIEND OPENS IT AND THE MATCH STARTS — BOTH OF YOU
            MUST BE ONLINE AT THE SAME TIME.
          </p>
        </div>
      ) : status === 'waiting' ? (
        <div className="friend-body">
          <div className="panel-kicker">ROOM OPEN — SEND THIS LINK</div>
          <div className="friend-code">{code}</div>
          <div className="friend-link">
            <span className="friend-url">{roomUrl(code)}</span>
            <button className="btn-ink" onClick={copy}>
              {copied ? 'COPIED ✓' : 'COPY LINK'}
            </button>
          </div>
          <div className="friend-waiting">
            <span className="ai-pip" />
            <span className="ai-pip" />
            <span className="ai-pip" />
            <span className="friend-waiting-label">WAITING FOR {MODE_LABEL[mode]} OPPONENT</span>
          </div>
          <button
            className="btn-quiet"
            onClick={() => {
              roomRef.current?.cancel()
              startedRef.current = false
              setStatus('config')
            }}
          >
            CANCEL ROOM
          </button>
        </div>
      ) : (
        <div className="friend-body">
          <div className="panel-kicker">CONNECTION</div>
          <h2 className="panel-title">ROOM FAILED</h2>
          <p className="friend-note">COULDN'T REACH THE CONNECTION BROKER. CHECK YOUR NETWORK AND TRY AGAIN.</p>
          <button className="btn-accent" onClick={() => setStatus('config')}>
            TRY AGAIN
          </button>
        </div>
      )}
    </div>
  )
}
