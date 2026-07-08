import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Match, Mode, Seat } from '../engine/types'
import { matchDurationSec } from '../engine/engine'
import { setSoundEnabled } from '../audio/sound'

// ---------------------------------------------------------------- accents

export interface Accent {
  id: string
  name: string
  hex: string
}

export const ACCENTS: Accent[] = [
  { id: 'vermilion', name: 'VERMILION', hex: '#E8501F' },
  { id: 'cobalt', name: 'COBALT', hex: '#2B4BD7' },
  { id: 'signal', name: 'SIGNAL', hex: '#E8A013' },
  { id: 'leaf', name: 'LEAF', hex: '#0F9D62' },
  { id: 'magenta', name: 'MAGENTA', hex: '#D6266E' },
  { id: 'ultraviolet', name: 'ULTRAVIOLET', hex: '#6A3FD8' },
]

export const accentById = (id: string) => ACCENTS.find((a) => a.id === id) ?? ACCENTS[0]

// ---------------------------------------------------------------- shapes

export interface Profile {
  name: string
  accent: string
  /** Pixel-face avatar id (see PixelFace FACES). */
  avatar: string
  preferredMode: Mode
  onboarded: boolean
  /** Match options for block/draw: first-to-100 scoring, draw-instead-of-pass. */
  optToHundred: boolean
  optDrawToPlay: boolean
}

export interface Settings {
  sound: boolean
  haptics: boolean
  reducedMotion: boolean
}

export interface Stats {
  gamesPlayed: number
  wins: number
  losses: number
  ties: number
  currentStreak: number
  bestStreak: number
  blockWins: number
  drawWins: number
  fivesWins: number
  totalPoints: number
  fivesMatches: number
  dominoesPlayed: number
  passes: number
  tilesDrawn: number
  matchesCompleted: number
  roundsPlayed: number
}

export interface HistoryEntry {
  id: string
  date: number
  mode: Mode
  result: 'win' | 'loss' | 'tie'
  scoreP: number
  scoreAi: number
  rounds: number
  durationSec: number
  accent: string
}

const ZERO_STATS: Stats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  ties: 0,
  currentStreak: 0,
  bestStreak: 0,
  blockWins: 0,
  drawWins: 0,
  fivesWins: 0,
  totalPoints: 0,
  fivesMatches: 0,
  dominoesPlayed: 0,
  passes: 0,
  tilesDrawn: 0,
  matchesCompleted: 0,
  roundsPlayed: 0,
}

const DEFAULT_PROFILE: Profile = {
  name: '',
  accent: 'vermilion',
  avatar: 'grin',
  preferredMode: 'block',
  onboarded: false,
  optToHundred: false,
  optDrawToPlay: false,
}
const DEFAULT_SETTINGS: Settings = { sound: true, haptics: true, reducedMotion: false }

// ---------------------------------------------------------------- storage

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...JSON.parse(raw) }
  } catch {
    return fallback
  }
}

function loadArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable — play session-only */
  }
}

// ---------------------------------------------------------------- context

interface Store {
  profile: Profile
  settings: Settings
  stats: Stats
  history: HistoryEntry[]
  accent: Accent
  updateProfile: (patch: Partial<Profile>) => void
  updateSettings: (patch: Partial<Settings>) => void
  resetStats: () => void
  recordMatch: (match: Match) => void
  haptic: (ms?: number) => void
}

const StoreCtx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(() => load('domino.profile', DEFAULT_PROFILE))
  const [settings, setSettings] = useState<Settings>(() => load('domino.settings', DEFAULT_SETTINGS))
  const [stats, setStats] = useState<Stats>(() => load('domino.stats', ZERO_STATS))
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadArray('domino.history'))

  useEffect(() => save('domino.profile', profile), [profile])
  useEffect(() => save('domino.settings', settings), [settings])
  useEffect(() => save('domino.stats', stats), [stats])
  useEffect(() => save('domino.history', history), [history])

  const accent = accentById(profile.accent)

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent.hex)
  }, [accent.hex])

  useEffect(() => {
    document.documentElement.classList.toggle('rm', settings.reducedMotion)
  }, [settings.reducedMotion])

  useEffect(() => {
    setSoundEnabled(settings.sound)
  }, [settings.sound])

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setProfile((p) => ({ ...p, ...patch }))
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }))
  }, [])

  const resetStats = useCallback(() => {
    setStats(ZERO_STATS)
    setHistory([])
  }, [])

  const haptic = useCallback(
    (ms = 10) => {
      if (!settings.haptics) return
      try {
        navigator.vibrate?.(ms)
      } catch {
        /* unsupported */
      }
    },
    [settings.haptics],
  )

  const recordMatch = useCallback(
    (match: Match) => {
      if (!match.over) return
      const result: HistoryEntry['result'] =
        match.winner === 'p' ? 'win' : match.winner === 'ai' ? 'loss' : 'tie'

      setStats((s) => {
        const win = result === 'win'
        const loss = result === 'loss'
        const streak = win ? Math.max(0, s.currentStreak) + 1 : loss ? Math.min(0, s.currentStreak) - 1 : 0
        return {
          ...s,
          gamesPlayed: s.gamesPlayed + 1,
          matchesCompleted: s.matchesCompleted + 1,
          wins: s.wins + (win ? 1 : 0),
          losses: s.losses + (loss ? 1 : 0),
          ties: s.ties + (result === 'tie' ? 1 : 0),
          currentStreak: streak,
          bestStreak: Math.max(s.bestStreak, streak),
          blockWins: s.blockWins + (win && match.mode === 'block' ? 1 : 0),
          drawWins: s.drawWins + (win && match.mode === 'draw' ? 1 : 0),
          fivesWins: s.fivesWins + (win && match.mode === 'fives' ? 1 : 0),
          totalPoints: s.totalPoints + (match.mode === 'fives' ? match.scores.p : 0),
          fivesMatches: s.fivesMatches + (match.mode === 'fives' ? 1 : 0),
          dominoesPlayed: s.dominoesPlayed + match.counts.placed.p,
          passes: s.passes + match.counts.passes.p,
          tilesDrawn: s.tilesDrawn + match.counts.drawn.p,
          roundsPlayed: s.roundsPlayed + match.counts.rounds,
        }
      })

      setHistory((h) =>
        [
          {
            id: match.id,
            date: Date.now(),
            mode: match.mode,
            result,
            scoreP: match.scores.p,
            scoreAi: match.scores.ai,
            rounds: match.counts.rounds,
            durationSec: matchDurationSec(match),
            accent: profile.accent,
          },
          ...h,
        ].slice(0, 100),
      )
    },
    [profile.accent],
  )

  const value = useMemo<Store>(
    () => ({
      profile,
      settings,
      stats,
      history,
      accent,
      updateProfile,
      updateSettings,
      resetStats,
      recordMatch,
      haptic,
    }),
    [profile, settings, stats, history, accent, updateProfile, updateSettings, resetStats, recordMatch, haptic],
  )

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore outside provider')
  return ctx
}
