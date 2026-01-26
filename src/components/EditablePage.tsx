import { useRef, useEffect, useState } from 'react'
import { PAGE_WIDTH, PAGE_HEIGHT } from '../constants'
import type { Page, Stroke, StrokePoint, ToolType } from '../types'
import { drawAllStrokes, getCanvasPoint, DrawOptions } from '../utils/drawing'
import Paper from './Paper'

interface EditablePageProps {
  page: Page
  scale: number
  activeTool: ToolType
  activeColor: string
  activeSize: number
  onUpdate: (page: Page) => void
}

export default function EditablePage({
  page,
  scale,
  activeTool,
  activeColor,
  activeSize,
  onUpdate
}: EditablePageProps) {
  const strokeCanvasRef = useRef<HTMLCanvasElement>(null)
  const [currentPoints, setCurrentPoints] = useState<StrokePoint[] | null>(null)

  const currentOptions: DrawOptions = {
    color: activeColor,
    size: activeSize,
    tool: activeTool
  }

  useEffect(() => {
    const canvas = strokeCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawAllStrokes(ctx, page.strokes, currentPoints, currentOptions)
  }, [page.strokes, currentPoints, activeColor, activeTool, activeSize])

  function handlePointerDown(evt: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = strokeCanvasRef.current
    if (!canvas) return
      ; (evt.target as HTMLCanvasElement).setPointerCapture(evt.pointerId)
    const pt = getCanvasPoint(evt.nativeEvent, canvas)
    setCurrentPoints([pt])
  }

  function handlePointerMove(evt: React.PointerEvent<HTMLCanvasElement>) {
    if (currentPoints === null) return
    const canvas = strokeCanvasRef.current
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
    setCurrentPoints(null)
    onUpdate({ ...page, strokes: [...page.strokes, stroke] })
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
          ref={strokeCanvasRef}
          width={PAGE_WIDTH}
          height={PAGE_HEIGHT}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: PAGE_WIDTH,
            height: PAGE_HEIGHT,
            touchAction: 'none',
            cursor: 'crosshair',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerCancel}
        />
      </div>
    </div>
  )
}
