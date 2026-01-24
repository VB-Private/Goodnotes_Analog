import { useRef, useEffect } from 'react'
import type { PageTemplate } from '../types'

const PAPER_BG = '#fafaf8'
const LINE_COLOR = 'rgba(0,0,0,0.12)'
const GRID_SPACING = 20
const LINE_SPACING = 24

interface PaperProps {
  template: PageTemplate
  width: number
  height: number
}

export default function Paper({ template, width, height }: PaperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = width
    canvas.height = height

    // Background
    ctx.fillStyle = PAPER_BG
    ctx.fillRect(0, 0, width, height)

    if (template === 'squared') {
      ctx.strokeStyle = LINE_COLOR
      ctx.lineWidth = 1
      for (let x = 0; x <= width; x += GRID_SPACING) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      for (let y = 0; y <= height; y += GRID_SPACING) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
    } else if (template === 'lined') {
      ctx.strokeStyle = LINE_COLOR
      ctx.lineWidth = 1
      for (let y = LINE_SPACING; y < height; y += LINE_SPACING) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
    }
  }, [template, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', touchAction: 'none' }}
      aria-hidden
    />
  )
}
