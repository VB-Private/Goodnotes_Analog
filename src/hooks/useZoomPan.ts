import { useRef, useEffect, useCallback, useState } from 'react'
import { screenToCanvas } from '../utils/screenToCanvas'

export interface ZoomPanState {
  zoom: number
  offsetX: number
  offsetY: number
}

const MIN_ZOOM = 0.25
const MAX_ZOOM = 4

export function useZoomPan() {
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null)
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainerEl(node)
  }, [])

  const [state, setState] = useState<ZoomPanState>({ zoom: 1, offsetX: 0, offsetY: 0 })

  // Keep state in a ref just for simple access, but pure state updates must use functional setState
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  // ── Wheel zoom (ctrl+wheel = pinch-to-zoom on trackpads) ──
  useEffect(() => {
    const el = containerEl
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      // ctrl+wheel → zoom; plain wheel → pan vertically/horizontally
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        
        setState(prev => {
          const rect = el.getBoundingClientRect()
          const cursorX = e.clientX - rect.left
          const cursorY = e.clientY - rect.top

          // Clamp deltaY to prevent massive jumps from standard mouse wheels (100 -> ~20 max)
          // Trackpads give small deltas natively, so this mostly protects against scroll wheels.
          const clampedDelta = Math.max(-20, Math.min(20, e.deltaY))
          const factor = Math.pow(0.98, clampedDelta)
          const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * factor))

          // If zoom hasn't changed (hit limits), don't update offsets
          if (newZoom === prev.zoom) return prev

          // Screen-space anchoring
          const canvasX = (cursorX - prev.offsetX) / prev.zoom
          const canvasY = (cursorY - prev.offsetY) / prev.zoom
          
          const newOffsetX = cursorX - canvasX * newZoom
          const newOffsetY = cursorY - canvasY * newZoom

          return { zoom: newZoom, offsetX: newOffsetX, offsetY: newOffsetY }
        })
      } else {
        // Plain scroll → pan
        e.preventDefault()
        setState(prev => ({
          ...prev,
          offsetX: prev.offsetX - e.deltaX,
          offsetY: prev.offsetY - e.deltaY,
        }))
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [containerEl])

  // ── Touch: pinch-to-zoom + two-finger pan ──
  useEffect(() => {
    const el = containerEl
    if (!el) return

    let baseState: ZoomPanState | null = null
    let baseTouchDist = 0
    let baseTouchMid = { x: 0, y: 0 }

    function getTouchDist(t1: Touch, t2: Touch) {
      return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
    }

    function getTouchMid(t1: Touch, t2: Touch) {
      return {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      }
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        baseState = stateRef.current
        baseTouchDist = getTouchDist(e.touches[0], e.touches[1])
        baseTouchMid = getTouchMid(e.touches[0], e.touches[1])
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && baseState) {
        e.preventDefault()
        const rect = el.getBoundingClientRect()
        const dist = getTouchDist(e.touches[0], e.touches[1])
        const mid = getTouchMid(e.touches[0], e.touches[1])

        const factor = dist / baseTouchDist
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, baseState.zoom * factor))

        // Anchor zoom to the base pinch midpoint
        const cursorX = baseTouchMid.x - rect.left
        const cursorY = baseTouchMid.y - rect.top

        const canvasX = (cursorX - baseState.offsetX) / baseState.zoom
        const canvasY = (cursorY - baseState.offsetY) / baseState.zoom

        let newOffsetX = cursorX - canvasX * newZoom
        let newOffsetY = cursorY - canvasY * newZoom

        // Add the panning movement relative to the base midpoint
        const dx = mid.x - baseTouchMid.x
        const dy = mid.y - baseTouchMid.y
        newOffsetX += dx
        newOffsetY += dy

        setState({ zoom: newZoom, offsetX: newOffsetX, offsetY: newOffsetY })
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Re-baseline if fingers lift but two are still down
        baseState = stateRef.current
        baseTouchDist = getTouchDist(e.touches[0], e.touches[1])
        baseTouchMid = getTouchMid(e.touches[0], e.touches[1])
      } else {
        baseState = null
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [containerEl])

  // ── Middle-mouse-button pan ──
  useEffect(() => {
    const el = containerEl
    if (!el) return

    let isPanning = false
    let lastX = 0
    let lastY = 0

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault()
        isPanning = true
        lastX = e.clientX
        lastY = e.clientY
        el.style.cursor = 'grabbing'
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isPanning) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      
      setState(prev => ({
        ...prev,
        offsetX: prev.offsetX + dx,
        offsetY: prev.offsetY + dy
      }))
    }

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 1 && isPanning) {
        isPanning = false
        el.style.cursor = ''
      }
    }

    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [containerEl])

  const getScreenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      const el = containerEl
      if (!el) return { x: screenX, y: screenY }
      const rect = el.getBoundingClientRect()
      return screenToCanvas(screenX, screenY, rect, state.zoom, state.offsetX, state.offsetY)
    },
    [containerEl, state.zoom, state.offsetX, state.offsetY]
  )

  return {
    zoom: state.zoom,
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    containerRef,
    screenToCanvas: getScreenToCanvas,
  }
}
