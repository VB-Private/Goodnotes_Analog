import getStroke from 'perfect-freehand'
import { PAGE_WIDTH, PAGE_HEIGHT } from '../constants'
import type { Stroke, StrokePoint } from '../types'

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

export function drawStrokePath(
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  color = '#000'
) {
  if (points.length < 2) return
  const outline = getStroke(points, { simulatePressure: false })
  if (outline.length < 2) return
  const path = new Path2D()
  path.moveTo(outline[0][0], outline[0][1])
  for (let i = 1; i < outline.length; i++) {
    path.lineTo(outline[i][0], outline[i][1])
  }
  path.closePath()
  ctx.fillStyle = color
  ctx.fill(path)
}

export function drawAllStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  currentPoints: StrokePoint[] | null
) {
  ctx.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
  for (const s of strokes) {
    drawStrokePath(ctx, s.points)
  }
  if (currentPoints && currentPoints.length >= 2) {
    drawStrokePath(ctx, currentPoints)
  }
}
