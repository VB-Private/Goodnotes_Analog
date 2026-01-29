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
  forceSourceOver?: boolean
}

export function drawStrokePath(
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  options: DrawOptions = {}
) {
  const { color = '#000', size = 1, tool = 'pen' } = options
  if (points.length < 2) return

  ctx.save()
  if (tool === 'eraser' && !options.forceSourceOver) {
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

  if (outline.length < 2) {
    ctx.restore()
    return
  }

  const path = new Path2D()
  path.moveTo(outline[0][0], outline[0][1])
  for (let i = 1; i < outline.length; i++) {
    path.lineTo(outline[i][0], outline[i][1])
  }
  path.closePath()

  ctx.fillStyle = (tool === 'eraser' && !options.forceSourceOver) ? 'rgba(0,0,0,1)' : color
  ctx.beginPath() // Reset current path state
  ctx.fill(path)
  ctx.restore()
}

export function drawAllStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  currentPoints: StrokePoint[] | null,
  currentOptions?: DrawOptions
) {
  ctx.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)

  for (const s of strokes) {
    drawStrokePath(ctx, s.points, { color: s.color, size: s.size, tool: s.tool })
  }

  if (currentPoints && currentPoints.length >= 2 && currentOptions) {
    drawStrokePath(ctx, currentPoints, currentOptions)
  }
}

/**
 * Draws a single stroke onto the provided context without clearing.
 * Useful for the "committing" phase of layered drawing.
 */
export function drawSingleStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke
) {
  drawStrokePath(ctx, stroke.points, {
    color: stroke.color,
    size: stroke.size,
    tool: stroke.tool
  })
}
