import { useEffect, useRef, useState } from 'react'
import type { Mode } from './engine/types'
import { StoreProvider, useStore } from './state/store'
import type { OnlineSession } from './net/peer'
import { Onboarding } from './components/Onboarding'
import { Home } from './components/Home'
import { SetupScreen } from './components/SetupScreen'
import { GameScreen } from './components/GameScreen'
import { FriendScreen } from './components/FriendScreen'
import { JoinScreen } from './components/JoinScreen'
import { ProfileScreen } from './components/ProfileScreen'
import { StatsScreen } from './components/StatsScreen'
import { HistoryScreen } from './components/HistoryScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { RulesScreen } from './components/RulesScreen'

type Screen =
  | 'onboarding'
  | 'home'
  | 'setup'
  | 'game'
  | 'friend'
  | 'join'
  | 'profile'
  | 'stats'
  | 'history'
  | 'settings'
  | 'rules'

function Shell() {
  const { profile } = useStore()
  // An invite link (?room=CODE) routes straight into the join flow.
  const roomParam = useRef<string | null>(
    new URLSearchParams(window.location.search).get('room'),
  ).current
  const [screen, setScreen] = useState<Screen>(
    profile.onboarded ? (roomParam ? 'join' : 'home') : 'onboarding',
  )
  const [mode, setMode] = useState<Mode>(profile.preferredMode)
  const [session, setSession] = useState<OnlineSession | null>(null)
  // Remounting the game per launch guarantees a clean match state.
  const [gameKey, setGameKey] = useState(0)

  useEffect(() => {
    if (roomParam) window.history.replaceState(null, '', window.location.pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const endOnline = () => {
    if (session) {
      session.net.send({ t: 'leave' })
      session.net.destroy()
      setSession(null)
    }
  }

  const goHome = () => {
    endOnline()
    setScreen('home')
  }

  const startSetup = (m: Mode) => {
    setMode(m)
    setScreen('setup')
  }

  const startGame = () => {
    setGameKey((k) => k + 1)
    setScreen('game')
  }

  const startOnline = (s: OnlineSession, m: Mode) => {
    setSession(s)
    setMode(m)
    setGameKey((k) => k + 1)
    setScreen('game')
  }

  switch (screen) {
    case 'onboarding':
      return <Onboarding onDone={() => setScreen(roomParam ? 'join' : 'home')} />
    case 'home':
      return <Home onPlay={startSetup} onNav={setScreen} />
    case 'setup':
      return <SetupScreen mode={mode} onStart={startGame} onBack={goHome} />
    case 'friend':
      return <FriendScreen onSession={startOnline} onBack={goHome} />
    case 'join':
      if (!roomParam) return <Home onPlay={startSetup} onNav={setScreen} />
      return <JoinScreen code={roomParam} onSession={startOnline} onCancel={goHome} />
    case 'game':
      return <GameScreen key={gameKey} mode={mode} online={session} onExit={goHome} onNewGame={goHome} />
    case 'profile':
      return <ProfileScreen onBack={goHome} onHistory={() => setScreen('history')} />
    case 'stats':
      return <StatsScreen onBack={goHome} />
    case 'history':
      return <HistoryScreen onBack={goHome} />
    case 'settings':
      return <SettingsScreen onBack={goHome} />
    case 'rules':
      return <RulesScreen onBack={goHome} />
  }
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
