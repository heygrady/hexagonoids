import { createSignal, createEffect, on } from 'solid-js'
import type { Component } from 'solid-js'

import type { PlayerToken } from './stores/player/PlayerState.js'

/**
 * A simple hook to track the hover state of an element.
 * Uses onMouseEnter/onMouseLeave which are non-bubbling events.
 * @returns {[() => boolean, (el: HTMLElement | null) => void]} A signal for hover state and a ref function.
 */
function useHover(): [() => boolean, (el: HTMLElement | null) => void] {
  const [isHovered, setIsHovered] = createSignal(false)

  const ref = (el: HTMLElement | null) => {
    if (el == null) return
    el.onmouseenter = () => {
      setIsHovered(true)
    }
    el.onmouseleave = () => {
      setIsHovered(false)
    }
  }

  return [isHovered, ref]
}

export interface CellProps {
  cell: PlayerToken | null
  index: number
  boardSize: number
  player1Emoji: string
  player2Emoji: string
  humanPlayerToken: PlayerToken
  onClick: () => void
}

export const Cell: Component<CellProps> = (props) => {
  const [fadeClass, setFadeClass] = createSignal('bg-blue-100/0')
  const [isHovered, hoverRef] = useHover()

  // Detect when cell content changes from null to a token
  createEffect(
    on(
      () => props.cell,
      (newCell, prevCell) => {
        // Trigger fade when cell changes from empty to filled
        if (prevCell == null && newCell != null) {
          // Apply background color immediately
          setFadeClass('bg-blue-200/100')

          // Remove class after small delay to trigger transition
          requestAnimationFrame(() => {
            setFadeClass('bg-blue-100/0')
          })
        }
      }
    )
  )

  const showGhost = () => props.cell == null && isHovered()

  const emoji = () => {
    // If cell has a piece, show it
    if (props.cell === 'X') return props.player1Emoji
    if (props.cell === 'O') return props.player2Emoji

    // If hovering over empty cell, show ghost piece
    if (showGhost()) {
      return props.humanPlayerToken === 'X'
        ? props.player1Emoji
        : props.player2Emoji
    }

    // Empty cell
    return '\u00A0'
  }

  const borderClass = () => {
    const topBorder = props.index >= props.boardSize ? 'border-t' : ''
    const bottomBorder =
      props.index < props.boardSize * (props.boardSize - 1) ? 'border-b' : ''
    const leftBorder = props.index % props.boardSize !== 0 ? 'border-l' : ''
    const rightBorder =
      (props.index + 1) % props.boardSize !== 0 ? 'border-r' : ''
    return `${topBorder} ${bottomBorder} ${leftBorder} ${rightBorder}`
  }

  return (
    <div
      ref={hoverRef}
      class={`border-gray-400 flex justify-center items-center transition-[background-color] duration-[1.2s] ease-out
               ${props.cell === null ? 'cursor-pointer hover:bg-gray-100' : ''}
               ${borderClass()}
               ${fadeClass()}`}
      style={{
        width: `${100 / props.boardSize}%`,
        height: `${100 / props.boardSize}%`,
      }}
      onClick={props.onClick}
    >
      <span
        class='text-6xl md:text-7xl lg:text-8xl'
        style={{
          opacity: showGhost() ? '0.25' : '1',
        }}
      >
        {emoji()}
      </span>
    </div>
  )
}
