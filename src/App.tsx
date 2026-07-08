import { useState } from 'react'
import type { Mode } from './engine/types'
import { StoreProvider, useStore } from './state/store'
import { Onboarding } from './components/Onboarding'
import { Home } from './components/Home'
import { SetupScreen } from './components/SetupScreen'
import { GameScreen } from './components/GameScreen'
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
  | 'profile'
  | 'stats'
  | 'history'
  | 'settings'
  | 'rules'

function Shell() {
  const { profile } = useStore()
  const [screen, setScreen] = useState<Screen>(profile.onboarded ? 'home' : 'onboarding')
  const [mode, setMode] = useState<Mode>(profile.preferredMode)
  // Remounting the game per launch guarantees a clean match state.
  const [gameKey, setGameKey] = useState(0)

  const startSetup = (m: Mode) => {
    setMode(m)
    setScreen('setup')
  }
  const startGame = () => {
    setGameKey((k) => k + 1)
    setScreen('game')
  }

  switch (screen) {
    case 'onboarding':
      return <Onboarding onDone={() => setScreen('home')} />
    case 'home':
      return <Home onPlay={startSetup} onNav={setScreen} />
    case 'setup':
      return <SetupScreen mode={mode} onStart={startGame} onBack={() => setScreen('home')} />
    case 'game':
      return (
        <GameScreen
          key={gameKey}
          mode={mode}
          onExit={() => setScreen('home')}
          onNewGame={() => setScreen('home')}
        />
      )
    case 'profile':
      return <ProfileScreen onBack={() => setScreen('home')} onHistory={() => setScreen('history')} />
    case 'stats':
      return <StatsScreen onBack={() => setScreen('home')} />
    case 'history':
      return <HistoryScreen onBack={() => setScreen('home')} />
    case 'settings':
      return <SettingsScreen onBack={() => setScreen('home')} />
    case 'rules':
      return <RulesScreen onBack={() => setScreen('home')} />
  }
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
