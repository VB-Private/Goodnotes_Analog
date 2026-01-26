import getStroke from 'perfect-freehand'
import { PAGE_WIDTH, PAGE_HEIGHT } from '../constants'
import type { Stroke, StrokePoint, ToolType } from '../types'

export function getCanvasPoint(
  evt: { clientX: number; clientY: number; pressure?: number },
  canvas: HTMLCanvasElement
): { x: number; y: number; pressure: number } {
  const rect = canvas.getBoundingClientRect()
  const scaleX = PAGE_WIDTH / rect.width
  const scaleY = PAGE_HEIGHT / rect.height
  return {
    x: (evt.clientX - rect.left) * scaleX,
    y: (evt.clientY - rect.top) * scaleY,
    pressure: typeof evt.pressure === 'number' ? evt.pressure : 0.5,
  }
}

export interface DrawOptions {
  color?: string
  size?: number
  tool?: ToolType
}

export function drawStrokePath(
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  options: DrawOptions = {}
) {
  const { color = '#000', size = 1, tool = 'pen' } = options
  if (points.length < 2) return

  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
  } else {
    ctx.globalCompositeOperation = 'source-over'
  }

  const outline = getStroke(points, {
    size,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: true
  })

  if (outline.length < 2) return
  const path = new Path2D()
  path.moveTo(outline[0][0], outline[0][1])
  for (let i = 1; i < outline.length; i++) {
    path.lineTo(outline[i][0], outline[i][1])
  }
  path.closePath()

  ctx.fillStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color
  ctx.fill(path)

  // Reset composite operation
  ctx.globalCompositeOperation = 'source-over'
}

export function drawAllStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  currentPoints: StrokePoint[] | null,
  currentOptions?: DrawOptions
) {
  ctx.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)

  // We need to use a temporary canvas for erasure to work correctly if we want it to "cut through" all strokes
  // But since we clear and redraw everything, we can just use destination-out on the main canvas

  for (const s of strokes) {
    drawStrokePath(ctx, s.points, { color: s.color, size: s.size, tool: s.tool })
  }

  if (currentPoints && currentPoints.length >= 2 && currentOptions) {
    drawStrokePath(ctx, currentPoints, currentOptions)
  }
}
