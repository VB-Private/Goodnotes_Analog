import { useRef, useEffect, useState } from 'react'
import { PAGE_WIDTH, PAGE_HEIGHT } from '../constants'
import type { Page, Stroke, ToolType, TextField } from '../types'
import { drawAllStrokes, drawSingleStroke } from '../utils/drawing'
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
  const staticCanvasRef = useRef<HTMLCanvasElement>(null)
  const activeCanvasRef = useRef<HTMLCanvasElement>(null)

  // High-performance buffers (outside React)
  const buffer = useRef<number[]>([]) // [x, y, p, x, y, p, ...]
  const fullStrokeBuffer = useRef<number[]>([])
  const lastPoint = useRef<{ x: number, y: number } | null>(null)
  const isDrawing = useRef(false)
  const rafId = useRef<number>(0)
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null)

  // Sync props to ref for the loop to access
  const propsRef = useRef({ activeColor, activeSize, activeTool, page, onUpdate, scale })
  useEffect(() => {
    propsRef.current = { activeColor, activeSize, activeTool, page, onUpdate, scale }
  }, [activeColor, activeSize, activeTool, page, onUpdate, scale])

  // Static layer redraw
  useEffect(() => {
    const ctx = staticCanvasRef.current?.getContext('2d')
    if (ctx) drawAllStrokes(ctx, page.strokes, null)
  }, [page.strokes])

  useEffect(() => {
    const canvas = activeCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { desynchronized: true })
    if (!ctx) return

    const render = () => {
      const { activeColor: color, activeSize: size, activeTool: tool } = propsRef.current

      if (buffer.current.length > 0) {
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = tool === 'eraser' ? 'rgba(200, 200, 200, 0.5)' : color

        let i = 0
        while (i < buffer.current.length) {
          const x = buffer.current[i++]
          const y = buffer.current[i++]
          const p = buffer.current[i++]

          if (lastPoint.current) {
            // Match perfect-freehand thinning (0.5 default)
            // formula: size * (0.5 + 0.5 * pressure)
            ctx.lineWidth = size * (0.5 + 0.5 * p)
            ctx.beginPath()
            ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
            ctx.lineTo(x, y)
            ctx.stroke()
          }
          lastPoint.current = { x, y }
        }
        buffer.current = []
      }
      rafId.current = requestAnimationFrame(render)
    }

    const onDown = (e: PointerEvent) => {
      const { scale: s, activeTool: tool, activeColor: c, activeSize: sz, onUpdate: update, page: pg } = propsRef.current

      if (tool === 'text') {
        const rect = canvas.getBoundingClientRect()
        const x = (e.clientX - rect.left) / s
        const y = (e.clientY - rect.top) / s
        const newTextField: TextField = {
          id: crypto.randomUUID(),
          x, y,
          text: '',
          color: c,
          fontSize: sz
        }
        setJustCreatedId(newTextField.id)
        update({ ...pg, textFields: [...(pg.textFields || []), newTextField] })
        return
      }

      e.preventDefault()
      canvas.setPointerCapture(e.pointerId)
      if (onInputTypeChange) onInputTypeChange(e.pointerType === 'pen' ? 'pen' : 'touch')

      isDrawing.current = true
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) / s
      const y = (e.clientY - rect.top) / s
      const p = e.pressure

      buffer.current.push(x, y, p)
      fullStrokeBuffer.current = [x, y, p]
      lastPoint.current = null
    }

    const onMove = (e: PointerEvent) => {
      if (!isDrawing.current) return
      const { scale: s } = propsRef.current
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) / s
      const y = (e.clientY - rect.top) / s
      const p = e.pressure

      buffer.current.push(x, y, p)
      fullStrokeBuffer.current.push(x, y, p)
    }

    const onUp = () => {
      if (!isDrawing.current) return
      isDrawing.current = false

      const { activeColor: c, activeSize: s, activeTool: t, onUpdate: update, page: pg } = propsRef.current

      const pts = []
      for (let i = 0; i < fullStrokeBuffer.current.length; i += 3) {
        pts.push({
          x: fullStrokeBuffer.current[i],
          y: fullStrokeBuffer.current[i + 1],
          pressure: fullStrokeBuffer.current[i + 2]
        })
      }

      if (pts.length >= 2) {
        const stroke: Stroke = { id: crypto.randomUUID(), points: pts, color: c, tool: t, size: s }
        const sCtx = staticCanvasRef.current?.getContext('2d')
        if (sCtx) drawSingleStroke(sCtx, stroke)
        update({ ...pg, strokes: [...pg.strokes, stroke] })
      }

      ctx.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
      fullStrokeBuffer.current = []
      lastPoint.current = null
    }

    canvas.addEventListener('pointerdown', onDown, { passive: false })
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

    rafId.current = requestAnimationFrame(render)

    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      cancelAnimationFrame(rafId.current)
    }
  }, [onInputTypeChange])

  return (
    <div style={{ width: PAGE_WIDTH * scale, height: PAGE_HEIGHT * scale, overflow: 'hidden', margin: '0 auto' }}>
      <div style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'relative' }}>
        <Paper template={page.template} width={PAGE_WIDTH} height={PAGE_HEIGHT} />
        <canvas ref={staticCanvasRef} width={PAGE_WIDTH} height={PAGE_HEIGHT} style={{ position: 'absolute', left: 0, top: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, pointerEvents: 'none' }} />
        <canvas ref={activeCanvasRef} width={PAGE_WIDTH} height={PAGE_HEIGHT} style={{ position: 'absolute', left: 0, top: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, touchAction: 'none', cursor: activeTool === 'text' ? 'text' : 'crosshair' }} />
        {(page.textFields || []).map((tf) => (
          <TextFieldComponent
            key={tf.id}
            textField={tf}
            onUpdate={(id, text) => onUpdate({ ...page, textFields: page.textFields.map(f => f.id === id ? { ...f, text } : f) })}
            onDelete={id => onUpdate({ ...page, textFields: page.textFields.filter(f => f.id !== id) })}
            onBlur={() => setJustCreatedId(null)}
            autoFocus={tf.id === justCreatedId}
          />
        ))}
      </div>
    </div>
  )
}
