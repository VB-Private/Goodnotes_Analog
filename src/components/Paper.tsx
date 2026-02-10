import { useRef, useEffect } from 'react'
import type { PageTemplate } from '../types'
import { getPDFFile } from '../storage/db'
import * as pdfjsLib from 'pdfjs-dist'
import '../utils/pdf' // Import to ensure worker is set up

const PAPER_BG = '#fafaf8'
const LINE_COLOR = 'rgba(0,0,0,0.12)'
const GRID_SPACING = 20
const LINE_SPACING = 24

interface PaperProps {
  template: PageTemplate
  width: number
  height: number
  pdfFileId?: string
  pdfPageNumber?: number
}

export default function Paper({ template, width, height, pdfFileId, pdfPageNumber }: PaperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let activeRenderTask: any = null
    let isCancelled = false

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = width
    canvas.height = height

    const startRendering = async () => {
      // Clear background first
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
      } else if (template === 'pdf' && pdfFileId && pdfPageNumber) {
        try {
          const pdfFile = await getPDFFile(pdfFileId)
          if (!pdfFile || isCancelled) return

          const arrayBuffer = await pdfFile.blob.arrayBuffer()
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
          const pdf = await loadingTask.promise
          if (isCancelled) return

          const page = await pdf.getPage(pdfPageNumber)
          if (isCancelled) return

          const viewport = page.getViewport({ scale: 1 })
          const scale = Math.min(width / viewport.width, height / viewport.height)
          const scaledViewport = page.getViewport({ scale })

          const offsetX = (width - scaledViewport.width) / 2
          const offsetY = (height - scaledViewport.height) / 2

          const renderContext: any = {
            canvasContext: ctx,
            viewport: scaledViewport,
            transform: [1, 0, 0, 1, offsetX, offsetY]
          }

          activeRenderTask = page.render(renderContext)
          await activeRenderTask.promise
        } catch (error: any) {
          if (error.name === 'RenderingCancelledException') return
          console.error('[Paper] Error rendering PDF page:', error)
          ctx.fillStyle = '#fecaca'
          ctx.fillRect(0, 0, width, height)
        }
      }
    }

    startRendering()

    return () => {
      isCancelled = true
      if (activeRenderTask) {
        activeRenderTask.cancel()
      }
    }
  }, [template, width, height, pdfFileId, pdfPageNumber])

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
