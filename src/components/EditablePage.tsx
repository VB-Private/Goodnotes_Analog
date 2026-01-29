import { useRef, useEffect, useState } from 'react'
import { PAGE_WIDTH, PAGE_HEIGHT } from '../constants'
import type { Page, Stroke, StrokePoint, ToolType, TextField } from '../types'
import { drawAllStrokes } from '../utils/drawing'
import Paper from './Paper'
import TextFieldComponent from './TextFieldComponent'

interface EditablePageProps {
  page: Page
  scale: number
  activeTool: ToolType
  activeColor: string
  activeSize: number
  onUpdate: (page: Page) => void
  onInputTypeChange?: (type: 'pen' | 'touch' | null) => void
}

export default function EditablePage({
  page,
  scale,
  activeTool,
  activeColor,
  activeSize,
  onUpdate,
  onInputTypeChange
}: EditablePageProps) {
  const strokeCanvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const pointsRef = useRef<StrokePoint[]>([])
  const lastLineWidthRef = useRef<number>(0)
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null)

  // Draw background strokes (saved ones)
  useEffect(() => {
    const canvas = strokeCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear and redraw all saved strokes
    ctx.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
    drawAllStrokes(ctx, page.strokes, null)
  }, [page.strokes, scale])

  // High-performance event listeners
  useEffect(() => {
    const canvas = strokeCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const forceEl = document.getElementById('force')
    const touchesEl = document.getElementById('touches')
    const requestIdleCallback = (window as any).requestIdleCallback || ((fn: any) => setTimeout(fn, 1))

    function getPos(e: TouchEvent | MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      const touch = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : (e as MouseEvent)
      const scaleX = PAGE_WIDTH / rect.width
      const scaleY = PAGE_HEIGHT / rect.height

      let pressure = 0.5
      if ((e as TouchEvent).touches && (e as TouchEvent).touches[0] && typeof (e as any).touches[0].force !== 'undefined') {
        pressure = (e as any).touches[0].force || 0.1
      } else if (e instanceof PointerEvent) {
        pressure = e.pressure || 0.5
      }

      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
        pressure
      }
    }

    function drawSegment(points: StrokePoint[]) {
      if (!ctx) return
      const l = points.length - 1
      if (l < 1) return

      ctx.strokeStyle = activeTool === 'eraser' ? 'rgba(255,255,255,1)' : activeColor
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (activeTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out'
      } else {
        ctx.globalCompositeOperation = 'source-over'
      }

      const point = points[l]
      const prevPoint = points[l - 1]

      // Calculate smoothed lineWidth based on pressure
      // Using user's formula: lineWidth = Math.log(pressure + 1) * 40
      const targetLineWidth = Math.log(point.pressure + 1) * (activeSize * 2)
      const currentLineWidth = (targetLineWidth * 0.2 + lastLineWidthRef.current * 0.8)
      lastLineWidthRef.current = currentLineWidth

      if (points.length >= 3) {
        const p2 = points[l - 2]
        const xc = (prevPoint.x + point.x) / 2
        const yc = (prevPoint.y + point.y) / 2

        ctx.lineWidth = currentLineWidth
        ctx.beginPath()
        const prevXc = (p2.x + prevPoint.x) / 2
        const prevYc = (p2.y + prevPoint.y) / 2
        ctx.moveTo(prevXc, prevYc)
        ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, xc, yc)
        ctx.stroke()
      } else {
        ctx.lineWidth = currentLineWidth
        ctx.beginPath()
        ctx.moveTo(prevPoint.x, prevPoint.y)
        ctx.lineTo(point.x, point.y)
        ctx.stroke()
      }

      ctx.globalCompositeOperation = 'source-over'
    }

    const handleDown = (e: TouchEvent | MouseEvent) => {
      const touch = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : null
      const isPen = (e as any).pointerType === 'pen' || (touch && (touch as any).touchType === 'stylus')
      const isMouse = e instanceof MouseEvent && !(e instanceof PointerEvent && (e as any).pointerType === 'touch')
      const shouldProcess = isPen || isMouse || activeTool === 'text'

      if (onInputTypeChange) {
        onInputTypeChange(isPen || isMouse ? 'pen' : 'touch')
      }

      if (!shouldProcess) return

      if (activeTool === 'text') {
        const pos = getPos(e)
        const newTextField: TextField = {
          id: crypto.randomUUID(),
          x: pos.x,
          y: pos.y,
          text: '',
          color: activeColor,
          fontSize: activeSize
        }
        setJustCreatedId(newTextField.id)
        onUpdate({
          ...page,
          textFields: [...(page.textFields || []), newTextField]
        })
        if (e.cancelable) e.preventDefault()
        return
      }

      const pos = getPos(e)
      isDrawingRef.current = true
      pointsRef.current = [pos]
      lastLineWidthRef.current = Math.log(pos.pressure + 1) * (activeSize * 2)

      if (e.cancelable) e.preventDefault()
    }

    const handleMove = (e: TouchEvent | MouseEvent) => {
      if (!isDrawingRef.current) return
      if (e.cancelable) e.preventDefault()

      const pos = getPos(e)
      pointsRef.current.push(pos)
      drawSegment(pointsRef.current)

      requestIdleCallback(() => {
        if (forceEl) forceEl.textContent = 'force = ' + pos.pressure.toFixed(3)
        const touch = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : null
        if (touchesEl && touch) {
          touchesEl.innerHTML = `type: ${(touch as any).touchType || 'unknown'}`
        }
      })
    }

    const handleUp = () => {
      if (!isDrawingRef.current) return
      isDrawingRef.current = false

      if (pointsRef.current.length >= 2) {
        const stroke: Stroke = {
          id: crypto.randomUUID(),
          points: [...pointsRef.current],
          color: activeColor,
          tool: activeTool,
          size: activeSize
        }
        onUpdate({ ...page, strokes: [...page.strokes, stroke] })
      }
      pointsRef.current = []
    }

    canvas.addEventListener('touchstart', handleDown, { passive: false })
    canvas.addEventListener('touchmove', handleMove, { passive: false })
    canvas.addEventListener('touchend', handleUp)
    canvas.addEventListener('touchcancel', handleUp)

    canvas.addEventListener('mousedown', handleDown)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)

    canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    return () => {
      canvas.removeEventListener('touchstart', handleDown)
      canvas.removeEventListener('touchmove', handleMove)
      canvas.removeEventListener('touchend', handleUp)
      canvas.removeEventListener('touchcancel', handleUp)

      canvas.removeEventListener('mousedown', handleDown)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [activeTool, activeColor, activeSize, page, onUpdate, onInputTypeChange])

  function handleTextFieldUpdate(id: string, text: string) {
    onUpdate({
      ...page,
      textFields: (page.textFields || []).map((tf) => (tf.id === id ? { ...tf, text } : tf))
    })
  }

  function handleTextFieldDelete(id: string) {
    onUpdate({
      ...page,
      textFields: (page.textFields || []).filter((tf) => tf.id !== id)
    })
  }

  return (
    <div
      style={{
        width: PAGE_WIDTH * scale,
        height: PAGE_HEIGHT * scale,
        overflow: 'hidden',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'relative',
        }}
      >
        <Paper template={page.template} width={PAGE_WIDTH} height={PAGE_HEIGHT} />
        <canvas
          ref={strokeCanvasRef}
          width={PAGE_WIDTH}
          height={PAGE_HEIGHT}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: PAGE_WIDTH,
            height: PAGE_HEIGHT,
            touchAction: 'manipulation',
            cursor: activeTool === 'text' ? 'text' : 'crosshair',
          }}
        />
        {(page.textFields || []).map((tf) => (
          <TextFieldComponent
            key={tf.id}
            textField={tf}
            onUpdate={handleTextFieldUpdate}
            onDelete={handleTextFieldDelete}
            onBlur={() => setJustCreatedId(null)}
            autoFocus={tf.id === justCreatedId}
          />
        ))}
      </div>
    </div>
  )
}
