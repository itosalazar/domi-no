import { useEffect, useRef, useState } from 'react'
import type { Mode } from '../engine/types'
import type { Match } from '../engine/types'
import { swapPerspective } from '../engine/engine'
import { joinRoom } from '../net/peer'
import type { Net, OnlineSession } from '../net/peer'
import { useStore } from '../state/store'

type Status = 'connecting' | 'waiting' | 'not-found' | 'error'

interface JoinScreenProps {
  code: string
  onSession: (session: OnlineSession, mode: Mode) => void
  onCancel: () => void
}

/** Guest side of an invite link: connect, introduce ourselves, wait for the deal. */
export function JoinScreen({ code, onSession, onCancel }: JoinScreenProps) {
  const { profile } = useStore()
  const [status, setStatus] = useState<Status>('connecting')
  const [hostName, setHostName] = useState('')
  const startedRef = useRef(false)

  useEffect(() => {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    let opponent = { name: '', avatar: 'flat', accent: '#5b6165' }

    const attempt = joinRoom(code, {
      onConnected: (net: Net) => {
        setStatus('waiting')
        net.send({ t: 'hello', name: profile.name, avatar: profile.avatar, accent })
        net.setOnMessage((msg) => {
          if (msg.t === 'welcome') {
            opponent = {
              name: String(msg.name ?? ''),
              avatar: String(msg.avatar ?? 'flat'),
              accent: String(msg.accent ?? '#5b6165'),
            }
            setHostName(String(msg.name ?? '').toUpperCase())
          }
          if (msg.t === 'state' && !startedRef.current) {
            startedRef.current = true
            net.setOnMessage(null)
            const initialMatch = swapPerspective(msg.match as Match)
            onSession({ isHost: false, net, opponent, initialMatch }, initialMatch.mode)
          }
        })
        net.setOnClose(() => {
          if (!startedRef.current) setStatus('error')
        })
      },
      onError: (kind) => setStatus(kind === 'not-found' ? 'not-found' : 'error'),
    })
    return () => attempt.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  return (
    <div className="screen sub">
      <header className="sub-head">
        <button className="back-btn" onClick={onCancel}>
          ← HOME
        </button>
        <h1 className="sub-title">JOINING</h1>
      </header>

      <div className="friend-body">
        <div className="panel-kicker">ROOM</div>
        <div className="friend-code">{code.toUpperCase()}</div>

        {status === 'connecting' && (
          <div className="friend-waiting">
            <span className="ai-pip" />
            <span className="ai-pip" />
            <span className="ai-pip" />
            <span className="friend-waiting-label">CONNECTING</span>
          </div>
        )}
        {status === 'waiting' && (
          <div className="friend-waiting">
            <span className="ai-pip" />
            <span className="ai-pip" />
            <span className="ai-pip" />
            <span className="friend-waiting-label">
              {hostName ? `CONNECTED TO ${hostName} — DEALING` : 'CONNECTED — DEALING'}
            </span>
          </div>
        )}
        {status === 'not-found' && (
          <>
            <p className="friend-note">
              ROOM NOT FOUND. THE LINK MAY HAVE EXPIRED, OR YOUR FRIEND CLOSED THE PAGE — ASK
              THEM TO CREATE A FRESH INVITE.
            </p>
            <button className="btn-accent" onClick={onCancel}>
              HOME
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="friend-note">CONNECTION FAILED. CHECK YOUR NETWORK AND TRY THE LINK AGAIN.</p>
            <button className="btn-accent" onClick={onCancel}>
              HOME
            </button>
          </>
        )}
      </div>
    </div>
  )
}
