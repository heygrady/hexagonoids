import {
  type Component,
  createResource,
  createSignal,
  For,
  Show,
} from 'solid-js'
import { DEFAULT_PLAYER_ID } from '../constants'
import { useAppMode } from './AppModeProvider'
import { BENCHMARK_SEEDS } from './constants'
import { trpc } from './trpc'

interface SeedStats {
  seed: string
  bestScore: number
  avgScore: number
  attempts: number
  bestWave: number
}

async function fetchSeedStats(playerId: string): Promise<SeedStats[]> {
  const result = await trpc.sessions.exportBenchmarks.query({ playerId })
  return BENCHMARK_SEEDS.filter((seed) => seed in result.seeds).map((seed) => {
    const stats = result.seeds[seed] ?? {
      bestScore: 0,
      avgScore: 0,
      attempts: 0,
      bestWave: 0,
    }
    return {
      seed,
      bestScore: stats.bestScore,
      avgScore: stats.avgScore,
      attempts: stats.attempts,
      bestWave: stats.bestWave,
    }
  })
}

export interface SessionBrowserProps {
  onSelectAll: () => void
  onSelectSeed: (seed: string) => void
  onCancel: () => void
}

export const SessionBrowser: Component<SessionBrowserProps> = (props) => {
  const { playerId } = useAppMode()
  const [stats] = createResource(
    () => playerId() || DEFAULT_PLAYER_ID,
    fetchSeedStats
  )
  const [selected, setSelected] = createSignal<string | null>(null)

  function handlePlay() {
    const sel = selected()
    if (sel != null) {
      props.onSelectSeed(sel)
    } else {
      props.onSelectAll()
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: '0',
        'z-index': '200',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        'background-color': 'rgba(0,0,0,0.85)',
      }}
    >
      <div
        style={{
          display: 'flex',
          'flex-direction': 'column',
          gap: '16px',
          'font-family': 'monospace',
          color: 'white',
          'min-width': '360px',
          'max-width': '480px',
        }}
      >
        <div style={{ 'font-size': '18px', 'font-weight': 'bold' }}>
          Session Browser
        </div>

        <Show when={stats.loading}>
          <div style={{ opacity: '0.7' }}>Loading sessions...</div>
        </Show>

        <Show when={stats.error}>
          <div style={{ color: '#ef4444' }}>
            Failed to load sessions: {String(stats.error)}
          </div>
        </Show>

        <Show when={(stats()?.length ?? -1) === 0}>
          <div style={{ opacity: '0.7' }}>
            No recordings found. Record first with Shift+R.
          </div>
        </Show>

        <Show when={(stats()?.length ?? 0) > 0}>
          {/* "Replay All" option */}
          <button
            type="button"
            onClick={() => setSelected(null)}
            style={{
              padding: '8px 12px',
              'border-radius': '4px',
              cursor: 'pointer',
              'font-family': 'monospace',
              'font-size': '14px',
              'text-align': 'left',
              color: 'white',
              'background-color':
                selected() == null
                  ? 'rgba(34,197,94,0.3)'
                  : 'rgba(255,255,255,0.05)',
              border:
                selected() == null
                  ? '1px solid #22c55e'
                  : '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <div style={{ 'font-weight': 'bold' }}>
              Replay All ({stats()?.length ?? 0} seeds)
            </div>
          </button>

          {/* Individual seed list */}
          <div
            style={{
              display: 'flex',
              'flex-direction': 'column',
              gap: '4px',
              'max-height': '240px',
              'overflow-y': 'auto',
            }}
          >
            <For each={stats()}>
              {(entry) => (
                <button
                  type="button"
                  onClick={() => setSelected(entry.seed)}
                  style={{
                    padding: '8px 12px',
                    'border-radius': '4px',
                    cursor: 'pointer',
                    'font-family': 'monospace',
                    color: 'white',
                    'background-color':
                      selected() === entry.seed
                        ? 'rgba(34,197,94,0.3)'
                        : 'rgba(255,255,255,0.05)',
                    border:
                      selected() === entry.seed
                        ? '1px solid #22c55e'
                        : '1px solid rgba(255,255,255,0.15)',
                    display: 'flex',
                    'justify-content': 'space-between',
                    'align-items': 'center',
                    'font-size': '13px',
                  }}
                >
                  <span>{entry.seed}</span>
                  <span style={{ opacity: '0.7' }}>
                    {entry.attempts}x | best: {entry.bestScore} | wave:{' '}
                    {entry.bestWave}
                  </span>
                </button>
              )}
            </For>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handlePlay}
              style={{
                flex: '1',
                padding: '8px 16px',
                'font-size': '14px',
                'font-family': 'monospace',
                'background-color': 'rgba(34,197,94,0.3)',
                border: '1px solid #22c55e',
                'border-radius': '4px',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              Play
            </button>
            <button
              type="button"
              onClick={props.onCancel}
              style={{
                padding: '8px 16px',
                'font-size': '14px',
                'font-family': 'monospace',
                'background-color': 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.3)',
                'border-radius': '4px',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </Show>

        <div style={{ 'font-size': '12px', opacity: '0.5' }}>
          Press Escape to cancel
        </div>
      </div>
    </div>
  )
}
