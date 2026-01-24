import { useRef, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import getStroke from 'perfect-freehand'
import { getPage, updatePage } from '../storage/db'
import type { Page, Stroke, StrokePoint } from '../types'
import Paper from '../components/Paper'

const PAGE_WIDTH = 794
const PAGE_HEIGHT = 1123

function getCanvasPoint(
  evt: React.PointerEvent | PointerEvent,
  canvas: HTMLCanvasElement
): { x: number; y: number; pressure: number } {
  const rect = canvas.getBoundingClientRect()
  const scaleX = PAGE_WIDTH / rect.width
  const scaleY = PAGE_HEIGHT / rect.height
  const x = (evt.clientX - rect.left) * scaleX
  const y = (evt.clientY - rect.top) * scaleY
  const pressure = typeof evt.pressure === 'number' ? evt.pressure : 0.5
  return { x, y, pressure }
}

function drawStrokePath(
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

function drawAllStrokes(
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

export default function PageCanvas() {
  const { notebookId, pageId } = useParams<{ notebookId: string; pageId: string }>()
  const navigate = useNavigate()
  const [page, setPage] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPoints, setCurrentPoints] = useState<StrokePoint[] | null>(null)
  const [scale, setScale] = useState(1)
  const strokeCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!pageId) return
    getPage(pageId).then((p) => {
      setPage(p ?? null)
      setLoading(false)
    })
  }, [pageId])

  useEffect(() => {
    function updateScale() {
      const s = Math.min(
        1,
        (window.innerWidth - 32) / PAGE_WIDTH,
        (window.innerHeight - 120) / PAGE_HEIGHT
      )
      setScale(Math.max(0.1, s))
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  useEffect(() => {
    const canvas = strokeCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawAllStrokes(ctx, page?.strokes ?? [], currentPoints)
  }, [page?.strokes, currentPoints])

  function handlePointerDown(evt: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = strokeCanvasRef.current
    if (!canvas) return
    ;(evt.target as HTMLCanvasElement).setPointerCapture(evt.pointerId)
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

  function handlePointerUp(evt: React.PointerEvent<HTMLCanvasElement>) {
    if (currentPoints === null || currentPoints.length < 2) {
      setCurrentPoints(null)
      return
    }
    const stroke: Stroke = { points: [...currentPoints] }
    setCurrentPoints(null)
    if (!page) return
    const updated: Page = { ...page, strokes: [...page.strokes, stroke] }
    setPage(updated)
    updatePage(updated)
  }

  function handlePointerCancel(evt: React.PointerEvent<HTMLCanvasElement>) {
    if (currentPoints && currentPoints.length >= 2) {
      const stroke: Stroke = { points: [...currentPoints] }
      if (page) {
        const updated: Page = { ...page, strokes: [...page.strokes, stroke] }
        setPage(updated)
        updatePage(updated)
      }
    }
    setCurrentPoints(null)
  }

  if (loading || !page) return <div>Loading…</div>

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" onClick={() => navigate(`/notebook/${notebookId}`)}>
          Back
        </button>
      </div>
      <div
        style={{
          width: PAGE_WIDTH * scale,
          height: PAGE_HEIGHT * scale,
          flex: '0 0 auto',
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
    </div>
  )
}
