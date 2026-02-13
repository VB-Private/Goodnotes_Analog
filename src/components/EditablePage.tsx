import { useRef, useEffect, useState, useMemo } from 'react'
import { PAGE_WIDTH, PAGE_HEIGHT } from '../constants'
import type { Page, Stroke, StrokePoint, ToolType, TextField, Operation } from '../types'
import { drawAllStrokes, drawStrokePath } from '../utils/drawing'
import { isStrokeInPolygon, getBoundingBox, isPointInBox, splitStroke, isStrokeHitByCircle } from '../utils/geometry'
import { generateCirclePoints } from '../utils/shapeDetection'
import Paper from './Paper'
import TextFieldComponent from './TextFieldComponent'

interface EditablePageProps {
  page: Page
  scale: number
  activeTool: ToolType
  activeColor: string
  activeSize: number
  onUpdate: (page: Page) => void
  onOperation?: (op: Operation) => void
  onInputTypeChange?: (type: 'pen' | 'touch' | null) => void
  width?: number
  height?: number
}

export default function EditablePage({
  page,
  scale,
  activeTool,
  activeColor,
  activeSize,
  onUpdate,
  onOperation,
  onInputTypeChange,
  width: customWidth,
  height: customHeight
}: EditablePageProps) {
  const width = customWidth || PAGE_WIDTH
  const height = customHeight || PAGE_HEIGHT
  const strokeCanvasRef = useRef<HTMLCanvasElement>(null)
  const laserCanvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const pointsRef = useRef<StrokePoint[]>([])
  const lastLineWidthRef = useRef<number>(0)
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const laserStrokesRef = useRef<{ points: StrokePoint[], timestamp: number }[]>([])
  const [selectedStrokeIds, setSelectedStrokeIds] = useState<string[]>([])
  const [selectionBox, setSelectionBox] = useState<{ minX: number, minY: number, maxX: number, maxY: number } | null>(null)
  const isDraggingSelectionRef = useRef(false)
  const dragStartPosRef = useRef<StrokePoint | null>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const holdTimeoutRef = useRef<number | null>(null)
  const isStraightLineModeRef = useRef(false)
  const [erasedStrokeIds, setErasedStrokeIds] = useState<string[]>([])

  const selectedStrokes = useMemo(() =>
    page.strokes.filter(s => selectedStrokeIds.includes(s.id)),
    [page.strokes, selectedStrokeIds]
  )

  useEffect(() => {
    if (selectedStrokes.length > 0) {
      const allPoints = selectedStrokes.flatMap(s => s.points)
      setSelectionBox(getBoundingBox(allPoints))
    } else {
      setSelectionBox(null)
    }
  }, [selectedStrokes])

  // Draw background strokes (saved ones)
  useEffect(() => {
    const canvas = strokeCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, width, height)
    drawAllStrokes(ctx, page.strokes, null)

    // Highlight selected strokes
    if (selectedStrokeIds.length > 0) {
      ctx.save()
      ctx.strokeStyle = '#007AFF'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])

      selectedStrokes.forEach(s => {
        const box = getBoundingBox(s.points)
        ctx.strokeRect(box.minX - 4, box.minY - 4, (box.maxX - box.minX) + 8, (box.maxY - box.minY) + 8)
      })

      if (selectionBox) {
        ctx.strokeStyle = '#007AFF'
        ctx.setLineDash([])
        ctx.lineWidth = 1
        ctx.strokeRect(selectionBox.minX - 8, selectionBox.minY - 8, (selectionBox.maxX - selectionBox.minX) + 16, (selectionBox.maxY - selectionBox.minY) + 16)
      }
      ctx.restore()
    }

    // Highlight strokes marked for deletion by eraser
    if (erasedStrokeIds.length > 0) {
      ctx.save()
      ctx.strokeStyle = '#FF3B30'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      erasedStrokeIds.forEach(id => {
        const s = page.strokes.find(st => st.id === id)
        if (s) {
          const box = getBoundingBox(s.points)
          ctx.strokeRect(box.minX - 4, box.minY - 4, (box.maxX - box.minX) + 8, (box.maxY - box.minY) + 8)
        }
      })
      ctx.restore()
    }
  }, [page.strokes, scale, selectedStrokeIds, selectionBox, selectedStrokes, width, height, erasedStrokeIds])

  // Laser animation loop
  useEffect(() => {
    const canvas = laserCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    let animationFrameId: number

    const render = () => {
      const now = Date.now()

      // Update the red to prune expired strokes
      laserStrokesRef.current = laserStrokesRef.current.filter(s => now - s.timestamp < 2000)
      const activeLaserStrokes = laserStrokesRef.current

      ctx.clearRect(0, 0, width, height)

      activeLaserStrokes.forEach(s => {
        const age = now - s.timestamp
        const opacity = Math.max(0, 1 - age / 2000)

        ctx.strokeStyle = `rgba(255, 0, 0, ${opacity})`
        ctx.shadowBlur = 10 * opacity
        ctx.shadowColor = 'red'
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = 10

        if (s.points.length < 2) return

        ctx.beginPath()
        ctx.moveTo(s.points[0].x, s.points[0].y)
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y)
        }
        ctx.stroke()

        // Reset shadow for next stroke
        ctx.shadowBlur = 0
      })

      // Draw current stroke if active
      if (isDrawingRef.current && activeTool === 'laser' && pointsRef.current.length >= 2) {
        ctx.strokeStyle = 'rgba(255, 0, 0, 1)'
        ctx.shadowBlur = 10
        ctx.shadowColor = 'red'
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = 10

        ctx.beginPath()
        ctx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y)
        for (let i = 1; i < pointsRef.current.length; i++) {
          ctx.lineTo(pointsRef.current[i].x, pointsRef.current[i].y)
        }
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      // Draw lasso path
      if (activeTool === 'lasso' && pointsRef.current.length >= 2) {
        ctx.strokeStyle = '#007AFF'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(pointsRef.current[0].x, pointsRef.current[0].y)
        for (let i = 1; i < pointsRef.current.length; i++) {
          ctx.lineTo(pointsRef.current[i].x, pointsRef.current[i].y)
        }
        if (!isDrawingRef.current) ctx.closePath()
        ctx.stroke()
        ctx.setLineDash([])

        // Fill area slightly
        ctx.fillStyle = 'rgba(0, 122, 255, 0.1)'
        ctx.fill()
      }

      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animationFrameId)
  }, [activeTool])

  // Clear pointsRef when switching tools to avoid cross-tool trails
  useEffect(() => {
    pointsRef.current = []
    isDrawingRef.current = false
    if (activeTool !== 'lasso') {
      setSelectedStrokeIds([])
    }
  }, [activeTool])

  // High-performance event listeners
  useEffect(() => {
    const canvas = strokeCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const forceEl = document.getElementById('force')
    const touchesEl = document.getElementById('touches')
    const requestIdleCallback = (window as any).requestIdleCallback || ((fn: any) => setTimeout(fn, 1))

    function getPos(e: TouchEvent | MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      const touch = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : (e as MouseEvent)
      const scaleX = width / rect.width
      const scaleY = height / rect.height

      let pressure = 0.5
      if ((e as TouchEvent).touches && (e as TouchEvent).touches[0] && typeof (e as any).touches[0].force !== 'undefined') {
        pressure = (e as any).touches[0].force || 0.1
      } else if (e instanceof PointerEvent) {
        pressure = e.pressure || 0.5
      }

      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
        pressure
      }
    }

    function drawSegment(points: StrokePoint[]) {
      if (!ctx) return
      const l = points.length - 1
      if (l < 1) return

      ctx.strokeStyle = activeTool === 'eraser' ? 'rgba(255,255,255,1)' : activeColor
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      ctx.globalAlpha = 1.0
      if (activeTool === 'eraser') {
        // Eraser no longer draws on the canvas
        return
      } else if (activeTool === 'laser') {
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = 'rgba(255, 0, 0, 1)'
        ctx.shadowBlur = 10
        ctx.shadowColor = 'red'
      } else {
        ctx.globalCompositeOperation = 'source-over'
        if (activeTool === 'pencil') {
          ctx.globalAlpha = 0.6
        } else if (activeTool === 'crayon') {
          ctx.globalAlpha = 0.4
        }
      }

      const point = points[l]
      const prevPoint = points[l - 1]

      // Calculate smoothed lineWidth based on pressure
      const targetLineWidth = Math.log(point.pressure + 1) * (activeSize * 2)
      const currentLineWidth = (targetLineWidth * 0.2 + lastLineWidthRef.current * 0.8)
      lastLineWidthRef.current = currentLineWidth

      if (points.length >= 3) {
        const p2 = points[l - 2]
        const xc = (prevPoint.x + point.x) / 2
        const yc = (prevPoint.y + point.y) / 2

        ctx.lineWidth = currentLineWidth
        ctx.beginPath()
        const prevXc = (p2.x + prevPoint.x) / 2
        const prevYc = (p2.y + prevPoint.y) / 2
        ctx.moveTo(prevXc, prevYc)
        ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, xc, yc)
        ctx.stroke()
      } else {
        ctx.lineWidth = currentLineWidth
        ctx.beginPath()
        ctx.moveTo(prevPoint.x, prevPoint.y)
        ctx.lineTo(point.x, point.y)
        ctx.stroke()
      }

      ctx.globalCompositeOperation = 'source-over'
      ctx.shadowBlur = 0
    }

    const handleDown = (e: TouchEvent | MouseEvent) => {
      const touch = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : null
      const isPen = (e as any).pointerType === 'pen' || (touch && (touch as any).touchType === 'stylus')
      const isMouse = e instanceof MouseEvent && !(e instanceof PointerEvent && (e as any).pointerType === 'touch')

      // Restrict drawing tools to Pen/Mouse only
      const isDrawingTool = ['pen', 'pencil', 'crayon', 'figures', 'eraser', 'lasso', 'laser'].includes(activeTool)
      const allowedInput = isPen || isMouse

      const shouldProcess = activeTool === 'text' || (isDrawingTool && allowedInput)

      if (onInputTypeChange) {
        onInputTypeChange(isPen || isMouse ? 'pen' : 'touch')
      }

      if (!shouldProcess) return

      if (activeTool === 'text') {
        const pos = getPos(e)
        const newTextField: TextField = {
          id: crypto.randomUUID(),
          x: pos.x,
          y: pos.y,
          text: '',
          color: activeColor,
          fontSize: activeSize
        }
        setJustCreatedId(newTextField.id)
        onUpdate({
          ...page,
          textFields: [...(page.textFields || []), newTextField]
        })
        if (e.cancelable) e.preventDefault()
        return
      }

      const pos = getPos(e)

      if (activeTool === 'lasso') {
        // Check if clicking inside current selection to drag
        if (selectionBox && isPointInBox(pos, selectionBox, 20)) {
          isDraggingSelectionRef.current = true
          dragStartPosRef.current = pos
          if (e.cancelable) e.preventDefault()
          return
        } else {
          // Start a new lasso selection
          setSelectedStrokeIds([])
        }
      }

      if (cursorRef.current && activeTool === 'eraser') {
        setErasedStrokeIds([])
        const diameter = Math.log(pos.pressure + 1) * (activeSize * 2)
        cursorRef.current.style.display = 'block'
        cursorRef.current.style.width = `${diameter}px`
        cursorRef.current.style.height = `${diameter}px`
        cursorRef.current.style.marginLeft = `${-diameter / 2}px`
        cursorRef.current.style.marginTop = `${-diameter / 2}px`
        cursorRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`
      }

      isDrawingRef.current = true
      pointsRef.current = [pos]
      lastLineWidthRef.current = Math.log(pos.pressure + 1) * (activeSize * 2)

      // Start hold detection for drawing tools
      if (activeTool === 'pen' || activeTool === 'pencil' || activeTool === 'crayon' || activeTool === 'figures') {
        isStraightLineModeRef.current = false

        const timeoutId = window.setTimeout(() => {
          if (isDrawingRef.current && pointsRef.current.length >= 2) {
            isStraightLineModeRef.current = true

            // Snap to straight line
            const startPoint = pointsRef.current[0]
            const endPoint = pointsRef.current[pointsRef.current.length - 1]
            pointsRef.current = [startPoint, endPoint]

            const canvas = strokeCanvasRef.current
            const ctx = canvas?.getContext('2d')
            if (ctx && canvas) {
              ctx.clearRect(0, 0, width, height)
              drawAllStrokes(ctx, page.strokes, pointsRef.current, { color: activeColor, size: activeSize, tool: activeTool })
            }
          }
        }, 1000) // 1 second hold
        holdTimeoutRef.current = timeoutId
      }

      if (e.cancelable) e.preventDefault()
    }

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const pos = getPos(e)
      if (cursorRef.current && activeTool === 'eraser') {
        const diameter = Math.log(pos.pressure + 1) * (activeSize * 2)
        cursorRef.current.style.display = 'block'
        cursorRef.current.style.width = `${diameter}px`
        cursorRef.current.style.height = `${diameter}px`
        cursorRef.current.style.marginLeft = `${-diameter / 2}px`
        cursorRef.current.style.marginTop = `${-diameter / 2}px`
        cursorRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`
      }
    }

    const handlePointerLeave = () => {
      if (cursorRef.current) {
        cursorRef.current.style.display = 'none'
      }
    }

    const handleMove = (e: TouchEvent | MouseEvent) => {
      const pos = getPos(e)

      if (isDraggingSelectionRef.current && dragStartPosRef.current) {
        if (e.cancelable) e.preventDefault()
        const dx = pos.x - dragStartPosRef.current.x
        const dy = pos.y - dragStartPosRef.current.y
        dragOffsetRef.current = { x: dx, y: dy }

        // Visual feedback: clear and redraw everything with offset selected strokes
        if (ctx) {
          ctx.clearRect(0, 0, width, height)
          // Draw unselected strokes
          page.strokes.forEach(s => {
            if (!selectedStrokeIds.includes(s.id)) {
              drawStrokePath(ctx, s.points, { color: s.color, size: s.size, tool: s.tool })
            }
          })
          // Draw selected strokes with offset
          selectedStrokes.forEach(s => {
            const offsetPoints = s.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy }))
            drawStrokePath(ctx, offsetPoints, { color: s.color, size: s.size, tool: s.tool })
          })
        }
        return
      }

      if (!isDrawingRef.current) return
      if (e.cancelable) e.preventDefault()

      if (cursorRef.current && activeTool === 'eraser') {
        const diameter = Math.log(pos.pressure + 1) * (activeSize * 2)
        cursorRef.current.style.width = `${diameter}px`
        cursorRef.current.style.height = `${diameter}px`
        cursorRef.current.style.marginLeft = `${-diameter / 2}px`
        cursorRef.current.style.marginTop = `${-diameter / 2}px`
        cursorRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`
      }

      if (isStraightLineModeRef.current) {
        // Update the end point of the straight line
        if (pointsRef.current.length >= 1) {
          const startPoint = pointsRef.current[0]
          pointsRef.current = [startPoint, pos]

          // Redraw to show the updated line
          if (ctx) {
            ctx.clearRect(0, 0, width, height)
            drawAllStrokes(ctx, page.strokes, pointsRef.current, { color: activeColor, size: activeSize, tool: activeTool })
          }
        }
      } else {
        pointsRef.current.push(pos)
        if (activeTool !== 'laser' && activeTool !== 'lasso' && activeTool !== 'eraser') {
          drawSegment(pointsRef.current)
        }

        if (activeTool === 'eraser') {
          const radius = (Math.log(pos.pressure + 1) * (activeSize * 2)) / 2
          const newlyErased = page.strokes
            .filter(s => !erasedStrokeIds.includes(s.id) && isStrokeHitByCircle(s, pos, radius))
            .map(s => s.id)

          if (newlyErased.length > 0) {
            setErasedStrokeIds(prev => [...prev, ...newlyErased])
          }
        }

        // Reset hold detection on move if not yet snapped
        if (holdTimeoutRef.current) {
          window.clearTimeout(holdTimeoutRef.current)
          holdTimeoutRef.current = null

          // Restart timeout
          if (activeTool === 'pen' || activeTool === 'pencil' || activeTool === 'crayon' || activeTool === 'figures') {
            const timeoutId = window.setTimeout(() => {
              if (isDrawingRef.current && pointsRef.current.length >= 2) {
                isStraightLineModeRef.current = true
                const startPoint = pointsRef.current[0]
                const endPoint = pointsRef.current[pointsRef.current.length - 1]
                pointsRef.current = [startPoint, endPoint]

                const canvas = strokeCanvasRef.current
                const ctx = canvas?.getContext('2d')
                if (ctx && canvas) {
                  ctx.clearRect(0, 0, width, height)
                  drawAllStrokes(ctx, page.strokes, pointsRef.current, { color: activeColor, size: activeSize, tool: activeTool })
                }
              }
            }, 500)
            holdTimeoutRef.current = timeoutId
          }
        }
      }

      requestIdleCallback(() => {
        if (forceEl) forceEl.textContent = 'force = ' + pos.pressure.toFixed(3)
        const touch = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : null
        if (touchesEl && touch) {
          touchesEl.innerHTML = `type: ${(touch as any).touchType || 'unknown'}`
        }
      })
    }

    const handleUp = () => {
      if (isDraggingSelectionRef.current && dragStartPosRef.current) {
        isDraggingSelectionRef.current = false
        const { x: dx, y: dy } = dragOffsetRef.current

        if (dx !== 0 || dy !== 0) {
          const updatedStrokes = page.strokes.map(s => {
            if (selectedStrokeIds.includes(s.id)) {
              return {
                ...s,
                points: s.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy }))
              }
            }
            return s
          })
          if (onOperation) {
            onOperation({ type: 'bulk-update', pageId: page.id, oldStrokes: page.strokes, newStrokes: updatedStrokes })
          } else {
            onUpdate({ ...page, strokes: updatedStrokes })
          }
        }
        dragOffsetRef.current = { x: 0, y: 0 }
        dragStartPosRef.current = null
        return
      }

      if (!isDrawingRef.current) return
      isDrawingRef.current = false
      if (holdTimeoutRef.current) {
        window.clearTimeout(holdTimeoutRef.current)
        holdTimeoutRef.current = null
      }
      isStraightLineModeRef.current = false

      if (pointsRef.current.length >= 2) {
        if (activeTool === 'laser') {
          laserStrokesRef.current.push({ points: [...pointsRef.current], timestamp: Date.now() })
        } else if (activeTool === 'lasso') {
          const lassoPolygon = [...pointsRef.current]

          let hasChanges = false
          const newStrokes: Stroke[] = []
          const newSelectedIds: string[] = []

          for (let i = 0; i < page.strokes.length; i++) {
            const s = page.strokes[i]

            if (s.tool !== 'eraser' && isStrokeInPolygon(s, lassoPolygon)) {
              const relevantErasers = page.strokes.slice(i + 1).filter(e => e.tool === 'eraser')

              if (relevantErasers.length > 0) {
                const fragments = splitStroke(s, relevantErasers)
                if (fragments.length === 1 && fragments[0] === s) {
                  newStrokes.push(s)
                  newSelectedIds.push(s.id)
                } else {
                  hasChanges = true
                  newStrokes.push(...fragments)
                  fragments.forEach(f => newSelectedIds.push(f.id))
                }
              } else {
                newStrokes.push(s)
                newSelectedIds.push(s.id)
              }
            } else {
              newStrokes.push(s)
            }
          }

          if (hasChanges) {
            if (onOperation) {
              onOperation({ type: 'bulk-update', pageId: page.id, oldStrokes: page.strokes, newStrokes })
            } else {
              onUpdate({ ...page, strokes: newStrokes })
            }
            setSelectedStrokeIds(newSelectedIds)
          } else {
            setSelectedStrokeIds(newSelectedIds)
          }
        } else if (activeTool !== 'eraser') {
          let finalPoints = [...pointsRef.current]

          if (activeTool === 'figures') {
            const snappedPoints = generateCirclePoints(pointsRef.current)
            if (snappedPoints) {
              finalPoints = snappedPoints
            }
          }

          const stroke: Stroke = {
            id: crypto.randomUUID(),
            points: finalPoints,
            color: activeColor,
            tool: activeTool === 'figures' ? 'pen' : activeTool,
            size: activeSize
          }
          if (onOperation) {
            onOperation({ type: 'add', pageId: page.id, stroke })
          } else {
            onUpdate({ ...page, strokes: [...page.strokes, stroke] })
          }
        }
      }

      if (activeTool === 'eraser') {
        if (erasedStrokeIds.length > 0) {
          const newStrokes = page.strokes.filter(s => !erasedStrokeIds.includes(s.id))
          if (onOperation) {
            onOperation({
              type: 'bulk-update',
              pageId: page.id,
              oldStrokes: page.strokes,
              newStrokes
            })
          } else {
            onUpdate({ ...page, strokes: newStrokes })
          }
        }
        setErasedStrokeIds([])
      }
      pointsRef.current = []
    }

    canvas.addEventListener('touchstart', handleDown, { passive: false })
    canvas.addEventListener('touchmove', handleMove, { passive: false })
    canvas.addEventListener('touchend', handleUp)
    canvas.addEventListener('touchcancel', handleUp)

    canvas.addEventListener('mousedown', handleDown)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)

    canvas.addEventListener('mousemove', handlePointerMove)
    canvas.addEventListener('mouseleave', handlePointerLeave)

    canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    return () => {
      canvas.removeEventListener('touchstart', handleDown)
      canvas.removeEventListener('touchmove', handleMove)
      canvas.removeEventListener('touchend', handleUp)
      canvas.removeEventListener('touchcancel', handleUp)

      canvas.removeEventListener('mousedown', handleDown)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)

      canvas.removeEventListener('mousemove', handlePointerMove)
      canvas.removeEventListener('mouseleave', handlePointerLeave)
    }
  }, [activeTool, activeColor, activeSize, page, onUpdate, onInputTypeChange, selectedStrokeIds, selectionBox, selectedStrokes, erasedStrokeIds, onOperation, width, height])

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

  return (
    <div
      style={{
        width: width * scale,
        height: height * scale,
        overflow: 'hidden',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          width: width,
          height: height,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'relative',
        }}
      >
        <Paper
          template={page.template}
          width={width}
          height={height}
          pdfFileId={page.pdfFileId}
          pdfPageNumber={page.pdfPageNumber}
        />
        <canvas
          ref={strokeCanvasRef}
          width={width}
          height={height}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: width,
            height: height,
            touchAction: 'manipulation',
            cursor: activeTool === 'text' ? 'text' : activeTool === 'eraser' ? 'none' : activeTool === 'laser' ? 'crosshair' : 'crosshair',
          }}
        />
        <canvas
          ref={laserCanvasRef}
          width={width}
          height={height}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: width,
            height: height,
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />
        {activeTool === 'eraser' && (
          <div
            ref={cursorRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 0, // Set dynamically
              height: 0, // Set dynamically
              border: '2px solid rgba(0,0,0,0.3)',
              borderRadius: '50%',
              pointerEvents: 'none',
              zIndex: 100,
              display: 'none',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.8), inset 0 0 8px rgba(0,0,0,0.1)',
              backdropFilter: 'contrast(1.1) brightness(1.1)', // Subtle magnification look
            }}
          />
        )}
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
