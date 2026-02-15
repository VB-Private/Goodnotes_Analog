import { PAGE_WIDTH, PAGE_HEIGHT } from '../constants'
import type { Stroke, StrokePoint, ToolType, Shape } from '../types'

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
  const { color = '#000', size = 2, tool = 'pen' } = options
  if (points.length < 2) return

  ctx.globalAlpha = 1.0
  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
  } else {
    ctx.globalCompositeOperation = 'source-over'
    if (tool === 'pencil') {
      ctx.globalAlpha = 0.6
    } else if (tool === 'crayon') {
      ctx.globalAlpha = 0.4
    }
  }

  ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  let lastWidth = Math.log(points[0].pressure + 1) * (size * 2)

  if (points.length === 2) {
    ctx.lineWidth = lastWidth
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    ctx.lineTo(points[1].x, points[1].y)
    ctx.stroke()
  } else {
    for (let i = 1; i < points.length; i++) {
      const p = points[i]
      const prev = points[i - 1]

      const targetWidth = Math.log(p.pressure + 1) * (size * 2)
      const currentWidth = (targetWidth * 0.2 + lastWidth * 0.8)
      lastWidth = currentWidth

      ctx.lineWidth = currentWidth

      if (i >= 2) {
        const p2 = points[i - 2]
        const xc = (prev.x + p.x) / 2
        const yc = (prev.y + p.y) / 2
        const prevXc = (p2.x + prev.x) / 2
        const prevYc = (p2.y + prev.y) / 2

        ctx.beginPath()
        ctx.moveTo(prevXc, prevYc)
        ctx.quadraticCurveTo(prev.x, prev.y, xc, yc)
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.moveTo(prev.x, prev.y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }
    }
  }

  // Reset composite operation
  ctx.globalCompositeOperation = 'source-over'
}

export function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  const { type, x, y, width, height, color, strokeWidth } = shape
  ctx.strokeStyle = color
  ctx.lineWidth = strokeWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()

  if (type === 'circle') {
    ctx.ellipse(x + width / 2, y + height / 2, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2)
  } else if (type === 'square') {
    ctx.rect(x, y, width, height)
  } else if (type === 'triangle') {
    ctx.moveTo(x + width / 2, y)
    ctx.lineTo(x + width, y + height)
    ctx.lineTo(x, y + height)
    ctx.closePath()
  }
  ctx.stroke()
}

export function drawAllStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  currentPoints: StrokePoint[] | null,
  currentOptions?: DrawOptions,
  shapes: Shape[] = []
) {
  ctx.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)

  // Draw saved strokes
  for (const s of strokes) {
    drawStrokePath(ctx, s.points, { color: s.color, size: s.size, tool: s.tool })
  }

  // Draw saved shapes
  for (const shape of shapes) {
    drawShape(ctx, shape)
  }

  // Draw current stroke being drawn
  if (currentPoints && currentPoints.length >= 2 && currentOptions) {
    drawStrokePath(ctx, currentPoints, currentOptions)
  }
}
