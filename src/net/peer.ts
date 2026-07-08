import Peer from 'peerjs'
import type { DataConnection } from 'peerjs'
import type { Match } from '../engine/types'

/**
 * Thin PeerJS wrapper for 1v1 invite rooms.
 * The host claims the peer id `domino-<CODE>`; the guest connects to it.
 * Messages are plain JSON objects with a `t` discriminator.
 */

export interface NetMsg {
  t: string
  [k: string]: unknown
}

export interface Net {
  send: (m: NetMsg) => void
  /** Assigning a handler flushes any messages queued while unset. */
  setOnMessage: (fn: ((m: NetMsg) => void) | null) => void
  setOnClose: (fn: (() => void) | null) => void
  destroy: () => void
}

export interface OnlineSession {
  isHost: boolean
  net: Net
  opponent: { name: string; avatar: string; accent: string }
  /** Guest only: the first match state, already perspective-swapped. */
  initialMatch?: Match
}

// Dev-only: expose the Peer constructor so a scripted test guest can connect.
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__PeerCtor = Peer
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function makeRoomCode(): string {
  let code = ''
  for (let i = 0; i < 5; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return code
}

export const roomUrl = (code: string) => `${location.origin}${location.pathname}?room=${code}`

function wrapConnection(peer: Peer, conn: DataConnection): Net {
  let onMessage: ((m: NetMsg) => void) | null = null
  let onClose: (() => void) | null = null
  const queue: NetMsg[] = []

  conn.on('data', (data) => {
    const msg = data as NetMsg
    if (onMessage) onMessage(msg)
    else queue.push(msg)
  })
  const closed = () => onClose?.()
  conn.on('close', closed)
  conn.on('error', closed)
  peer.on('disconnected', () => {
    // try to come back through the broker; data channel itself stays up
    try {
      peer.reconnect()
    } catch {
      /* already destroyed */
    }
  })

  return {
    send: (m) => {
      try {
        conn.send(m)
      } catch {
        /* connection gone — close handler will fire */
      }
    },
    setOnMessage: (fn) => {
      onMessage = fn
      if (fn) while (queue.length) fn(queue.shift()!)
    },
    setOnClose: (fn) => {
      onClose = fn
    },
    destroy: () => {
      onMessage = null
      onClose = null
      try {
        conn.close()
      } catch {}
      try {
        peer.destroy()
      } catch {}
    },
  }
}

export interface HostRoom {
  cancel: () => void
}

/** Open a room and wait for one guest. */
export function hostRoom(
  code: string,
  cb: {
    onReady: () => void
    onGuest: (net: Net) => void
    onError: (kind: 'taken' | 'network') => void
  },
): HostRoom {
  const peer = new Peer(`domino-${code}`)
  let handed = false
  peer.on('open', () => cb.onReady())
  peer.on('connection', (conn) => {
    if (handed) {
      conn.close()
      return
    }
    handed = true
    conn.on('open', () => cb.onGuest(wrapConnection(peer, conn)))
  })
  peer.on('error', (err: Error & { type?: string }) => {
    if (handed) return
    cb.onError(err.type === 'unavailable-id' ? 'taken' : 'network')
  })
  return {
    cancel: () => {
      if (!handed) {
        try {
          peer.destroy()
        } catch {}
      }
    },
  }
}

/** Join an existing room by code. */
export function joinRoom(
  code: string,
  cb: {
    onConnected: (net: Net) => void
    onError: (kind: 'not-found' | 'network') => void
  },
): { cancel: () => void } {
  const peer = new Peer()
  let handed = false
  peer.on('open', () => {
    const conn = peer.connect(`domino-${code.toUpperCase()}`, { reliable: true })
    conn.on('open', () => {
      handed = true
      cb.onConnected(wrapConnection(peer, conn))
    })
  })
  peer.on('error', (err: Error & { type?: string }) => {
    if (handed) return
    cb.onError(err.type === 'peer-unavailable' ? 'not-found' : 'network')
  })
  return {
    cancel: () => {
      if (!handed) {
        try {
          peer.destroy()
        } catch {}
      }
    },
  }
}
