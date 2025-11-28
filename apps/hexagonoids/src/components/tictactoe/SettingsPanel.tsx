import { useStore } from '@nanostores/solid'
import { Activation } from '@neat-evolution/core'
import { createMemo, createSignal, onMount, Show } from 'solid-js'

import { useGame } from './hooks/useGame.js'
import { subscribeSettings, useSettings } from './hooks/useSettings.js'
import { clearPopulationFromStorage } from './stores/game/PopulationPersistence.js'
import { clearSettingsFromStorage } from './stores/settings/SettingsPersistence.js'
import {
  AlgorithmType,
  defaultSettingsState,
} from './stores/settings/SettingsStore.js'

const usableActivation = Object.values(Activation).filter(
  (act) => act !== Activation.None && act !== Activation.Softmax
)

// Stepped values for generations per match slider
const GENERATION_STEPS = [5, 10, 50, 100] as const
type GenerationStep = (typeof GENERATION_STEPS)[number]

// Helper to clamp values
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

// Helper to find nearest generation step
const nearestGenerationStep = (value: number): GenerationStep => {
  let nearest = GENERATION_STEPS[0]
  let minDiff = Math.abs(value - nearest)

  for (const step of GENERATION_STEPS) {
    const diff = Math.abs(value - step)
    if (diff < minDiff) {
      minDiff = diff
      nearest = step
    }
  }

  return nearest
}

export function SettingsPanel() {
  const [$game, gameActions] = useGame()
  const game = useStore($game)
  const settings = subscribeSettings()
  const [
    $settings,
    {
      setDraftAlgorithm,
      setDraftActivation,
      setPlayer1Emoji,
      setPlayer2Emoji,
      setGenerationsPerMatch,
      setUseBestOpponent,
      setIsOpen,
      applyDraftSettings,
      cancelDraftSettings,
    },
  ] = useSettings()

  const [savedIndicator, setSavedIndicator] = createSignal(false)
  let savedTimeout: ReturnType<typeof setTimeout> | null = null
  let dialogRef: HTMLDialogElement | undefined

  const showSavedIndicator = () => {
    if (savedTimeout !== null) clearTimeout(savedTimeout)
    setSavedIndicator(true)
    savedTimeout = setTimeout(() => {
      setSavedIndicator(false)
    }, 2000)
  }

  // Check if draft settings differ from committed
  const hasPendingChanges = createMemo(() => {
    const s = settings()
    return (
      s.draft.algorithm !== s.committed.algorithm ||
      s.draft.activation !== s.committed.activation
    )
  })

  const openModal = () => {
    dialogRef?.showModal()
    setIsOpen(true)
  }

  const closeModal = () => {
    // Blur active element to remove focus ring
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    dialogRef?.close()
    setIsOpen(false)
  }

  const handleCancel = () => {
    cancelDraftSettings()
    closeModal()
  }

  const handleApply = async () => {
    applyDraftSettings()
    showSavedIndicator()

    // Set switching status before restart
    $game.setKey('operationStatus', 'switching')

    // Restart the game with new settings
    try {
      await gameActions.restart()
      closeModal()
    } catch (error) {
      console.error('Error restarting game with new settings:', error)
    } finally {
      $game.setKey('operationStatus', undefined)
    }
  }

  const resetToDefaults = async () => {
    await clearSettingsFromStorage()
    $settings.set(defaultSettingsState)
  }

  // State for reset population confirmation
  const [showResetConfirm, setShowResetConfirm] = createSignal(false)

  // Reset current population (clears saved data and restarts fresh)
  const handleResetPopulation = async () => {
    const currentSettings = settings().committed
    // Clear saved population for current algorithm/activation
    await clearPopulationFromStorage(
      currentSettings.algorithm,
      currentSettings.activation
    )

    // Set resetting status before restart
    $game.setKey('operationStatus', 'resetting')

    // Restart to create fresh population (skipSave prevents race condition)
    try {
      await gameActions.restart({ skipSave: true })
      showSavedIndicator()
      setShowResetConfirm(false)
      closeModal()
    } catch (error) {
      console.error('Error resetting population:', error)
      setShowResetConfirm(false)
    } finally {
      $game.setKey('operationStatus', undefined)
    }
  }

  // Handle range slider for generations
  const handleGenerationsChange = (e: Event) => {
    const target = e.currentTarget as HTMLInputElement
    const index = clamp(parseInt(target.value), 0, GENERATION_STEPS.length - 1)
    const value = GENERATION_STEPS[index]
    setGenerationsPerMatch(value)
    showSavedIndicator()
  }

  // Get current slider index
  const generationsSliderIndex = () => {
    const value = settings().committed.generationsPerMatch
    return GENERATION_STEPS.indexOf(nearestGenerationStep(value))
  }

  // Sync dialog open state with settings
  onMount(() => {
    if (settings().isOpen && dialogRef !== undefined) {
      dialogRef.showModal()
    }
  })

  return (
    <>
      <button class='btn btn-ghost btn-circle' onClick={openModal}>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          fill='none'
          viewBox='0 0 24 24'
          class='inline-block w-5 h-5 stroke-current'
        >
          <path
            stroke-linecap='round'
            stroke-linejoin='round'
            stroke-width='2'
            d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
          ></path>
          <path
            stroke-linecap='round'
            stroke-linejoin='round'
            stroke-width='2'
            d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
          ></path>
        </svg>
      </button>

      <dialog ref={dialogRef} class='modal modal-middle'>
        <div class='modal-box w-11/12 max-w-md flex flex-col max-h-[90vh]'>
          {/* Fixed header */}
          <div class='flex justify-between items-center mb-4 flex-shrink-0'>
            <div class='flex items-center gap-2'>
              <h3 class='font-bold text-xl'>Settings</h3>
              <Show when={savedIndicator()}>
                <span class='badge badge-success gap-1'>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    fill='none'
                    viewBox='0 0 24 24'
                    class='inline-block w-4 h-4 stroke-current'
                  >
                    <path
                      stroke-linecap='round'
                      stroke-linejoin='round'
                      stroke-width='2'
                      d='M5 13l4 4L19 7'
                    ></path>
                  </svg>
                  Saved
                </span>
              </Show>
              <Show when={hasPendingChanges()}>
                <span class='badge badge-warning gap-1'>Unsaved changes</span>
              </Show>
            </div>
            <button
              class='btn btn-sm btn-circle btn-ghost'
              onClick={handleCancel}
            >
              ✕
            </button>
          </div>

          {/* Scrollable content */}
          <div class='space-y-4 overflow-y-auto flex-1'>
            {/* Auto-apply settings */}
            <div class='flex gap-2'>
              <div class='form-control w-full'>
                <label class='label'>
                  <span class='label-text'>Player 1 Symbol</span>
                </label>
                <select
                  class='select select-bordered w-full'
                  value={settings().committed.player1Emoji}
                  onChange={(e) => {
                    setPlayer1Emoji(e.currentTarget.value)
                    showSavedIndicator()
                  }}
                >
                  <option value='🦄'>🦄 Unicorn</option>
                  <option value='❌'>❌ Cross</option>
                  <option value='🔥'>🔥 Fire</option>
                  <option value='⚡'>⚡ Lightning</option>
                  <option value='🌟'>🌟 Star</option>
                  <option value='💎'>💎 Gem</option>
                  <option value='🚀'>🚀 Rocket</option>
                  <option value='🦤'>🦤 Dodo</option>
                </select>
              </div>
              <div class='form-control w-full'>
                <label class='label'>
                  <span class='label-text'>Player 2 Symbol</span>
                </label>
                <select
                  class='select select-bordered w-full'
                  value={settings().committed.player2Emoji}
                  onChange={(e) => {
                    setPlayer2Emoji(e.currentTarget.value)
                    showSavedIndicator()
                  }}
                >
                  <option value='🌈'>🌈 Rainbow</option>
                  <option value='⭕'>⭕ Circle</option>
                  <option value='💧'>💧 Water</option>
                  <option value='⛈️'>⛈️ Rain Cloud</option>
                  <option value='🌝'>🌝 Moon</option>
                  <option value='💍'>💍 Ring</option>
                  <option value='💥'>💥 Blast</option>
                  <option value='🤖'>🤖 Robot</option>
                </select>
              </div>
            </div>

            <div class='form-control w-full'>
              <label class='label'>
                <span class='label-text'>Generations per Match</span>
                <span class='label-text-alt font-bold'>
                  {settings().committed.generationsPerMatch}
                </span>
              </label>
              <input
                type='range'
                min='0'
                max={GENERATION_STEPS.length - 1}
                value={generationsSliderIndex()}
                class='range range-primary'
                step='1'
                onInput={handleGenerationsChange}
              />
              <div class='w-full flex justify-between text-xs px-2 mt-2'>
                {GENERATION_STEPS.map((step) => (
                  <span class='text-center'>{step}</span>
                ))}
              </div>
              <label class='label'>
                <span class='label-text-alt'>
                  Training cycles between games
                </span>
              </label>
            </div>

            <div class='form-control'>
              <label class='label cursor-pointer'>
                <span class='label-text'>Use Best Opponent</span>
                <input
                  type='checkbox'
                  class='toggle toggle-primary'
                  checked={settings().committed.useBestOpponent}
                  onChange={(e) => {
                    setUseBestOpponent(e.currentTarget.checked)
                    showSavedIndicator()
                  }}
                />
              </label>
              <label class='label'>
                <span class='label-text-alt'>
                  Play against best genome instead of current opponent
                </span>
              </label>
            </div>

            <div class='divider'>Population Settings</div>

            {/* Population settings - switching changes AI population */}
            <div class='bg-base-200 rounded-box p-4 space-y-4'>
              <div class='form-control w-full'>
                <label class='label'>
                  <span class='label-text'>Algorithm</span>
                </label>
                <select
                  class='select select-bordered'
                  value={settings().draft.algorithm}
                  onChange={(e) => {
                    setDraftAlgorithm(e.currentTarget.value as AlgorithmType)
                  }}
                >
                  {Object.values(AlgorithmType).map((algo) => (
                    <option value={algo}>{algo}</option>
                  ))}
                </select>
              </div>

              <div class='form-control w-full'>
                <label class='label'>
                  <span class='label-text'>Activation Function</span>
                </label>
                <select
                  class='select select-bordered'
                  value={settings().draft.activation}
                  onChange={(e) => {
                    setDraftActivation(e.currentTarget.value as Activation)
                  }}
                >
                  {Object.values(usableActivation).map((act) => (
                    <option value={act}>{act}</option>
                  ))}
                </select>
              </div>

              <Show when={hasPendingChanges()}>
                <div class='alert alert-info'>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    class='stroke-current shrink-0 h-6 w-6'
                    fill='none'
                    viewBox='0 0 24 24'
                  >
                    <path
                      stroke-linecap='round'
                      stroke-linejoin='round'
                      stroke-width='2'
                      d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                    />
                  </svg>
                  <span class='text-sm'>
                    Switching will load a different AI population. Your current
                    progress is saved automatically.
                  </span>
                </div>
              </Show>

              <div class='flex gap-2'>
                <button
                  class='btn btn-primary flex-1'
                  onClick={() => {
                    void handleApply()
                  }}
                  disabled={
                    !hasPendingChanges() || game().operationStatus !== undefined
                  }
                >
                  {game().operationStatus === 'switching' ? (
                    <span class='loading loading-spinner loading-sm' />
                  ) : (
                    'Switch Population'
                  )}
                </button>
                <button
                  class='btn btn-ghost flex-1'
                  onClick={() => {
                    cancelDraftSettings()
                  }}
                  disabled={!hasPendingChanges()}
                >
                  Cancel
                </button>
              </div>

              <div class='divider text-xs opacity-60'>Danger Zone</div>

              <Show
                when={!showResetConfirm()}
                fallback={
                  <div class='flex flex-col gap-2'>
                    <span class='text-sm text-warning'>
                      This will delete all training progress for the current
                      population. Are you sure?
                    </span>
                    <div class='flex gap-2'>
                      <button
                        class='btn btn-error btn-sm flex-1'
                        onClick={() => {
                          void handleResetPopulation()
                        }}
                        disabled={game().operationStatus !== undefined}
                      >
                        {game().operationStatus === 'resetting' ? (
                          <span class='loading loading-spinner loading-sm' />
                        ) : (
                          'Yes, Reset'
                        )}
                      </button>
                      <button
                        class='btn btn-ghost btn-sm flex-1'
                        onClick={() => setShowResetConfirm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                }
              >
                <button
                  class='btn btn-outline btn-warning btn-sm w-full'
                  onClick={() => setShowResetConfirm(true)}
                >
                  Reset Current Population
                </button>
              </Show>
            </div>

            <div class='divider'></div>

            <button
              class='btn btn-outline btn-sm w-full'
              onClick={() => {
                void resetToDefaults()
              }}
            >
              Reset to Defaults
            </button>
          </div>
        </div>

        {/* Backdrop - clicking outside closes modal */}
        <form method='dialog' class='modal-backdrop'>
          <button onClick={handleCancel}>close</button>
        </form>
      </dialog>
    </>
  )
}
