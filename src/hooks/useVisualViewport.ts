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

        function update() {
            const vv = window.visualViewport
            if (!vv) return

            setViewport({
                width: vv.width,
                height: vv.height,
                scale: vv.scale,
                offsetTop: vv.offsetTop,
                offsetLeft: vv.offsetLeft,
            })
        }

        window.visualViewport.addEventListener('resize', update)
        window.visualViewport.addEventListener('scroll', update)

        // Initial update
        update()

        return () => {
            window.visualViewport?.removeEventListener('resize', update)
            window.visualViewport?.removeEventListener('scroll', update)
        }
    }, [])

    return viewport
}
