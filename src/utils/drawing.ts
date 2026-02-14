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

export function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape
) {
  ctx.save()
  ctx.strokeStyle = shape.color
  ctx.lineWidth = shape.size
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  if (shape.type === 'rect') {
    if (shape.isFilled) {
      ctx.fillStyle = `${shape.color}40`
      ctx.fillRect(shape.x, shape.y, shape.width, shape.height)
    }
    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height)
  } else if (shape.type === 'circle') {
    ctx.beginPath()
    ctx.ellipse(
      shape.x + shape.width / 2,
      shape.y + shape.height / 2,
      Math.abs(shape.width / 2),
      Math.abs(shape.height / 2),
      0, 0, 2 * Math.PI
    )
    if (shape.isFilled) {
      ctx.fillStyle = `${shape.color}40`
      ctx.fill()
    }
    ctx.stroke()
  } else if (shape.type === 'triangle') {
    ctx.beginPath()
    ctx.moveTo(shape.x + shape.width / 2, shape.y)
    ctx.lineTo(shape.x + shape.width, shape.y + shape.height)
    ctx.lineTo(shape.x, shape.y + shape.height)
    ctx.closePath()
    if (shape.isFilled) {
      ctx.fillStyle = `${shape.color}40`
      ctx.fill()
    }
    ctx.stroke()
  }
  ctx.restore()
}

export function drawAllStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  currentPoints: StrokePoint[] | null,
  currentOptions?: DrawOptions,
  shapes: Shape[] = []
) {
  ctx.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)

  for (const s of strokes) {
    drawStrokePath(ctx, s.points, { color: s.color, size: s.size, tool: s.tool })
  }

  for (const shape of shapes) {
    drawShape(ctx, shape)
  }

  if (currentPoints && currentPoints.length >= 2 && currentOptions) {
    drawStrokePath(ctx, currentPoints, currentOptions)
  }
}
