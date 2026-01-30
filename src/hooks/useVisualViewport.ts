import { useState, useEffect } from 'react'

export interface ViewportState {
    width: number
    height: number
    scale: number
    offsetTop: number
    offsetLeft: number
}

export function useVisualViewport() {
    const [viewport, setViewport] = useState<ViewportState | null>(null)

    useEffect(() => {
        if (!window.visualViewport) return

        let rafId: number
        let lastState: ViewportState | null = null

        function update() {
            const vv = window.visualViewport
            if (!vv) return

            // Check if anything actually changed before triggering a React update
            if (
                !lastState ||
                lastState.width !== vv.width ||
                lastState.height !== vv.height ||
                lastState.scale !== vv.scale ||
                lastState.offsetTop !== vv.offsetTop ||
                lastState.offsetLeft !== vv.offsetLeft
            ) {
                const newState = {
                    width: vv.width,
                    height: vv.height,
                    scale: vv.scale,
                    offsetTop: vv.offsetTop,
                    offsetLeft: vv.offsetLeft,
                }
                lastState = newState
                setViewport(newState)
            }

            rafId = requestAnimationFrame(update)
        }

        rafId = requestAnimationFrame(update)

        return () => {
            cancelAnimationFrame(rafId)
        }
    }, [])

    return viewport
}
