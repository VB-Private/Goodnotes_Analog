import { useState, useEffect, useRef, useCallback } from 'react'
import type { Page } from '../types'
import { getContentBounds } from '../utils/contentBounds'
import type { ZoomPanState } from './useZoomPan'

const ANIMATION_DURATION = 100 // ms
const FIT_PADDING = 0         // px of padding around content
const MAX_FIT_ZOOM = 1         // never zoom in past 100%

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

// ---------------------------------------------------------------------------
// useIsContentOffscreen
// ---------------------------------------------------------------------------
/**
 * Returns true when none of the content bounding box overlaps the visible
 * canvas area (i.e. the content is fully off-screen).
 *
 * Screen transform: screenX = sceneX * zoom + offsetX
 *                   screenY = sceneY * zoom + offsetY
 */
export function useIsContentOffscreen(
  pages: Page[],
  viewport: ZoomPanState,
  canvasWidth: number,
  canvasHeight: number
): boolean {
  const [isOffscreen, setIsOffscreen] = useState(false)

  useEffect(() => {
    if (canvasWidth === 0 || canvasHeight === 0) return

    const bounds = getContentBounds(pages)
    if (!bounds) {
      setIsOffscreen(false)
      return
    }

    const { zoom, offsetX, offsetY } = viewport

    // Convert content rect corners to screen space
    const screenLeft = bounds.minX * zoom + offsetX
    const screenTop = bounds.minY * zoom + offsetY
    const screenRight = bounds.maxX * zoom + offsetX
    const screenBottom = bounds.maxY * zoom + offsetY

    // Check overlap with [0, canvasWidth] x [0, canvasHeight]
    const noOverlap =
      screenRight < 0 ||
      screenLeft > canvasWidth ||
      screenBottom < 0 ||
      screenTop > canvasHeight

    setIsOffscreen(noOverlap)
  }, [pages, viewport, canvasWidth, canvasHeight])

  return isOffscreen
}

// ---------------------------------------------------------------------------
// useFitToContent
// ---------------------------------------------------------------------------
/**
 * Returns a `fitToContent` function that smoothly animates the viewport so
 * all content is centered on screen with FIT_PADDING on each side.
 *
 * @param setViewport - useZoomPan's setViewport(zoom, offsetX, offsetY)
 * @param getViewport - useZoomPan's stable getter for the current ZoomPanState
 */
export function useFitToContent(
  pages: Page[],
  canvasWidth: number,
  canvasHeight: number,
  setViewport: (zoom: number, offsetX: number, offsetY: number) => void,
  getViewport: () => ZoomPanState
) {
  const rafRef = useRef<number | null>(null)

  const fitToContent = useCallback(() => {
    const bounds = getContentBounds(pages)
    if (!bounds) return

    const contentW = bounds.maxX - bounds.minX
    const contentH = bounds.maxY - bounds.minY

    const availableW = canvasWidth - FIT_PADDING * 2
    const availableH = canvasHeight - FIT_PADDING * 2

    // Compute zoom to fit, capped at MAX_FIT_ZOOM
    const scaleX = availableW / contentW
    const scaleY = availableH / contentH
    const targetZoom = Math.min(scaleX, scaleY, MAX_FIT_ZOOM)

    // Center the content in canvas
    const scaledW = contentW * targetZoom
    const scaledH = contentH * targetZoom
    const targetOffsetX = (canvasWidth - scaledW) / 2 - bounds.minX * targetZoom
    const targetOffsetY = (canvasHeight - scaledH) / 2 - bounds.minY * targetZoom

    // Grab current viewport for animation start
    const startVp = getViewport()
    const startZoom = startVp.zoom
    const startOffsetX = startVp.offsetX
    const startOffsetY = startVp.offsetY

    // Cancel any running animation
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }

    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTime
      const t = Math.min(elapsed / ANIMATION_DURATION, 1)
      const ease = easeOutCubic(t)

      const zoom = startZoom + (targetZoom - startZoom) * ease
      const offsetX = startOffsetX + (targetOffsetX - startOffsetX) * ease
      const offsetY = startOffsetY + (targetOffsetY - startOffsetY) * ease

      setViewport(zoom, offsetX, offsetY)

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        rafRef.current = null
      }
    }

    rafRef.current = requestAnimationFrame(animate)
  }, [pages, canvasWidth, canvasHeight, setViewport, getViewport])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return fitToContent
}
