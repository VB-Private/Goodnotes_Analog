import { useRef, useEffect, useState } from 'react'
import { PAGE_WIDTH, PAGE_HEIGHT } from '../constants'
import type { Page, Stroke, StrokePoint, ToolType, TextField } from '../types'
import { drawAllStrokes, drawStrokePath, getCanvasPoint, DrawOptions, drawSingleStroke } from '../utils/drawing'
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
  const [currentPoints, setCurrentPoints] = useState<StrokePoint[] | null>(null)
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null)

  const currentOptions: DrawOptions = {
    color: activeColor,
    size: activeSize,
    tool: activeTool
  }

  // Draw the static layer (committed strokes)
  useEffect(() => {
    const canvas = staticCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawAllStrokes(ctx, page.strokes, null)
  }, [page.strokes])

  // Draw the active layer (current stroke)
  useEffect(() => {
    const canvas = activeCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
    const previewOptions: DrawOptions = {
      ...currentOptions,
      color: activeTool === 'eraser' ? 'rgba(200, 200, 200, 0.5)' : activeColor,
      forceSourceOver: activeTool === 'eraser'
    }
    if (currentPoints && currentPoints.length >= 2) {
      drawStrokePath(ctx, currentPoints, previewOptions)
    }
  }, [currentPoints, activeColor, activeTool, activeSize])

  function handlePointerDown(evt: React.PointerEvent<HTMLCanvasElement>) {
    // Detect and report input type
    if (onInputTypeChange) {
      onInputTypeChange(evt.pointerType === 'pen' ? 'pen' : 'touch')
    }

    // Prevention of Safari's long-press context menu / magnifying glass
    if (evt.pointerType === 'pen') {
      evt.preventDefault() // This is critical for Apple Pencil
    }

    const canvas = activeCanvasRef.current
    if (!canvas) return

    if (activeTool === 'text') {
      const pt = getCanvasPoint(evt.nativeEvent, canvas)
      const newTextField: TextField = {
        id: crypto.randomUUID(),
        x: pt.x,
        y: pt.y,
        text: '',
        color: activeColor,
        fontSize: activeSize
      }
      setJustCreatedId(newTextField.id)
      onUpdate({
        ...page,
        textFields: [...(page.textFields || []), newTextField]
      })
      return
    }

    ; (evt.target as HTMLCanvasElement).setPointerCapture(evt.pointerId)
    const pt = getCanvasPoint(evt.nativeEvent, canvas)
    setCurrentPoints([pt])
  }

  function handlePointerMove(evt: React.PointerEvent<HTMLCanvasElement>) {
    if (currentPoints === null) return
    const canvas = activeCanvasRef.current
    if (!canvas) return
    const pt = getCanvasPoint(evt.nativeEvent, canvas)
    setCurrentPoints((prev) => (prev ? [...prev, pt] : null))
  }

  function handlePointerUp() {
    if (currentPoints === null || currentPoints.length < 2) {
      setCurrentPoints(null)
      return
    }
    const stroke: Stroke = {
      id: crypto.randomUUID(),
      points: [...currentPoints],
      color: activeColor,
      tool: activeTool,
      size: activeSize
    }

    // IMMIDIATE COMMIT TO STATIC CANVAS (for zero lag)
    const staticCanvas = staticCanvasRef.current
    if (staticCanvas) {
      const ctx = staticCanvas.getContext('2d')
      if (ctx) {
        drawSingleStroke(ctx, stroke)
      }
    }

    setCurrentPoints(null)
    onUpdate({ ...page, strokes: [...page.strokes, stroke] })
  }

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

  function handlePointerCancel() {
    if (currentPoints && currentPoints.length >= 2) {
      const stroke: Stroke = {
        id: crypto.randomUUID(),
        points: [...currentPoints],
        color: activeColor,
        tool: activeTool,
        size: activeSize
      }

      // COMMIT TO STATIC CANVAS
      const staticCanvas = staticCanvasRef.current
      if (staticCanvas) {
        const ctx = staticCanvas.getContext('2d')
        if (ctx) {
          drawSingleStroke(ctx, stroke)
        }
      }

      onUpdate({ ...page, strokes: [...page.strokes, stroke] })
    }
    setCurrentPoints(null)
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
          ref={staticCanvasRef}
          width={PAGE_WIDTH}
          height={PAGE_HEIGHT}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: PAGE_WIDTH,
            height: PAGE_HEIGHT,
            pointerEvents: 'none',
          }}
        />
        <canvas
          ref={activeCanvasRef}
          width={PAGE_WIDTH}
          height={PAGE_HEIGHT}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: PAGE_WIDTH,
            height: PAGE_HEIGHT,
            touchAction: 'none',
            cursor: activeTool === 'text' ? 'text' : 'crosshair',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerCancel}
          onContextMenu={(e) => e.preventDefault()}
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
