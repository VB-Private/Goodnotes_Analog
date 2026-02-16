import { useRef, useEffect, useState, useMemo } from 'react'
import { PAGE_WIDTH, PAGE_HEIGHT } from '../constants'
import type { Page, Stroke, StrokePoint, ToolType, TextField, Shape, ShapeType, Operation } from '../types'
import { drawAllStrokes, drawStrokePath } from '../utils/drawing'
import { isStrokeInPolygon, getBoundingBox, isPointInBox, splitStroke, isStrokeHitByCircle } from '../utils/geometry'
import Paper from './Paper'
import TextFieldComponent from './TextFieldComponent'

interface EditablePageProps {
  page: Page
  scale: number
  activeTool: ToolType
  activeColor: string
  activeSize: number
  selectedShapeType?: ShapeType
  onUpdate: (page: Page) => void
  onOperation?: (op: Operation) => void
  onToolChange?: (tool: ToolType) => void
  onInputTypeChange?: (type: 'pen' | 'touch' | null) => void
  isShapeFilled?: boolean
  width?: number
  height?: number
}

export default function EditablePage({
  page,
  scale,
  activeTool,
  activeColor,
  activeSize,
  selectedShapeType = 'circle',
  isShapeFilled = true,
  onUpdate,
  onOperation,
  onToolChange,
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
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null)
  const [activeHandle, setActiveHandle] = useState<'tl' | 'tr' | 'bl' | 'br' | 'move' | null>(null)
  const oldShapesRef = useRef<Shape[]>([])

  // Store latest state in a ref to avoid re-binding event listeners frequently
  const stateRef = useRef({ page, activeTool, activeColor, activeSize, selectedShapeType, isShapeFilled, selectedShapeId, activeHandle, selectedStrokeIds, selectionBox, erasedStrokeIds, onUpdate, onOperation, onToolChange, onInputTypeChange })
  useEffect(() => {
    stateRef.current = { page, activeTool, activeColor, activeSize, selectedShapeType, isShapeFilled, selectedShapeId, activeHandle, selectedStrokeIds, selectionBox, erasedStrokeIds, onUpdate, onOperation, onToolChange, onInputTypeChange }
  }, [page, activeTool, activeColor, activeSize, selectedShapeType, isShapeFilled, selectedShapeId, activeHandle, selectedStrokeIds, selectionBox, erasedStrokeIds, onUpdate, onOperation, onToolChange, onInputTypeChange])

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
    drawAllStrokes(ctx, page.strokes, null, undefined, page.shapes || [])

    // Highlight selected shape
    if (selectedShapeId) {
      const shape = page.shapes?.find(s => s.id === selectedShapeId)
      if (shape) {
        ctx.save()
        ctx.strokeStyle = '#007AFF'
        ctx.lineWidth = 1
        ctx.setLineDash([5, 5])
        ctx.strokeRect(shape.x - 4, shape.y - 4, shape.width + 8, shape.height + 8)

        // Draw resize handles
        ctx.fillStyle = '#fff'
        ctx.strokeStyle = '#007AFF'
        ctx.setLineDash([])
        ctx.lineWidth = 2
        const handleSize = 8 / scale
        const handles = [
          { x: shape.x, y: shape.y }, // Top-left
          { x: shape.x + shape.width, y: shape.y }, // Top-right
          { x: shape.x, y: shape.y + shape.height }, // Bottom-left
          { x: shape.x + shape.width, y: shape.y + shape.height } // Bottom-right
        ]
        handles.forEach(h => {
          ctx.beginPath()
          ctx.arc(h.x, h.y, handleSize / 2, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        })

        // Draw delete handle (small X)
        const deleteX = shape.x + shape.width + 20
        const deleteY = shape.y - 20
        const deleteSize = 20 / scale

        ctx.beginPath()
        ctx.fillStyle = '#FF3B30'
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.arc(deleteX, deleteY, deleteSize / 2, 0, Math.PI * 2)
        ctx.fill()

        // Draw X
        const xLen = (deleteSize / 2) * 0.5
        ctx.beginPath()
        ctx.moveTo(deleteX - xLen, deleteY - xLen)
        ctx.lineTo(deleteX + xLen, deleteY + xLen)
        ctx.moveTo(deleteX + xLen, deleteY - xLen)
        ctx.lineTo(deleteX - xLen, deleteY + xLen)
        ctx.stroke()

        ctx.restore()
      }
    }

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
  }, [page.strokes, page.shapes, scale, selectedStrokeIds, selectionBox, selectedStrokes, width, height, erasedStrokeIds, selectedShapeId])

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
      if (isDrawingRef.current && (activeTool === 'laser' || activeTool === 'crayon' || activeTool === 'pen') && pointsRef.current.length >= 2) {
        if (activeTool === 'laser') {
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
        } else if (activeTool === 'crayon' || activeTool === 'pen') {
          // Live drawing on overlay to avoid clearing the main canvas
          drawStrokePath(ctx, pointsRef.current, {
            color: stateRef.current.activeColor,
            size: stateRef.current.activeSize,
            tool: activeTool
          })
        }
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

      // Draw lasso dragging preview
      if (isDraggingSelectionRef.current && dragOffsetRef.current) {
        const { x: dx, y: dy } = dragOffsetRef.current
        const currentSelectedStrokes = stateRef.current.page.strokes.filter(s => stateRef.current.selectedStrokeIds.includes(s.id))
        currentSelectedStrokes.forEach(s => {
          const offsetPoints = s.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy }))
          drawStrokePath(ctx, offsetPoints, { color: s.color, size: s.size, tool: s.tool })
        })
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

      // Round to 1 decimal place to reduce storage size
      const round = (n: number) => Math.round(n * 10) / 10

      return {
        x: round((touch.clientX - rect.left) * scaleX),
        y: round((touch.clientY - rect.top) * scaleY)
      }
    }



    const handleDown = (e: TouchEvent | MouseEvent) => {
      const touch = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : null
      const isPen = (e as any).pointerType === 'pen' || (touch && (touch as any).touchType === 'stylus')
      const isMouse = e instanceof MouseEvent && !(e instanceof PointerEvent && (e as any).pointerType === 'touch')

      // Restrict drawing tools to Pen/Mouse only
      const isDrawingTool = ['pen', 'crayon', 'eraser', 'lasso', 'laser'].includes(stateRef.current.activeTool)
      const allowedInput = isPen || isMouse

      const shouldProcess = stateRef.current.activeTool === 'text' || stateRef.current.activeTool === 'figures' || stateRef.current.activeTool === 'select' || (isDrawingTool && allowedInput)

      if (stateRef.current.onInputTypeChange) {
        stateRef.current.onInputTypeChange(isPen || isMouse ? 'pen' : 'touch')
      }

      if (!shouldProcess) return

      if (stateRef.current.activeTool === 'figures') {
        const pos = getPos(e)
        const newShape: Shape = {
          id: crypto.randomUUID(),
          type: stateRef.current.selectedShapeType,
          x: pos.x - 50,
          y: pos.y - 50,
          width: 100,
          height: 100,
          color: stateRef.current.activeColor,
          fillColor: stateRef.current.isShapeFilled ? stateRef.current.activeColor : undefined,
          strokeWidth: stateRef.current.activeSize
        }
        stateRef.current.onUpdate({
          ...stateRef.current.page,
          shapes: [...(stateRef.current.page.shapes || []), newShape]
        })
        if (stateRef.current.onToolChange) stateRef.current.onToolChange('select')
        setSelectedShapeId(newShape.id)
        if (e.cancelable) e.preventDefault()
        return
      }

      if (stateRef.current.activeTool === 'select') {
        const pos = getPos(e)
        // 1. Check handles of the ALREADY selected shape first
        if (stateRef.current.selectedShapeId) {
          const shape = stateRef.current.page.shapes?.find(s => s.id === stateRef.current.selectedShapeId)
          if (shape) {
            const handleSize = 25 / scale // hit area
            const handles = {
              tl: { x: shape.x, y: shape.y },
              tr: { x: shape.x + shape.width, y: shape.y },
              bl: { x: shape.x, y: shape.y + shape.height },
              br: { x: shape.x + shape.width, y: shape.y + shape.height }
            }
            for (const [id, h] of Object.entries(handles)) {
              if (Math.hypot(pos.x - h.x, pos.y - h.y) < handleSize / 2) {
                setActiveHandle(id as any)
                oldShapesRef.current = [...(page.shapes || [])]
                isDrawingRef.current = true
                if (e.cancelable) e.preventDefault()
                return
              }
            }

            // Check for delete handle
            const deleteX = shape.x + shape.width + 20
            const deleteY = shape.y - 20
            const deleteSize = 30 / scale // hit area

            if (Math.hypot(pos.x - deleteX, pos.y - deleteY) < deleteSize / 2) {
              const newShapes = (stateRef.current.page.shapes || []).filter(s => s.id !== shape.id)

              if (stateRef.current.onOperation) {
                stateRef.current.onOperation({
                  type: 'bulk-update',
                  pageId: stateRef.current.page.id,
                  oldStrokes: stateRef.current.page.strokes,
                  newStrokes: stateRef.current.page.strokes,
                  oldShapes: stateRef.current.page.shapes || [],
                  newShapes
                })
              } else {
                stateRef.current.onUpdate({ ...stateRef.current.page, shapes: newShapes })
              }

              setSelectedShapeId(null)
              if (e.cancelable) e.preventDefault()
              return
            }
          }
        }

        // 2. Hit test for ANY shape (including selecting a new one or moving the current one)
        const hitShape = [...(stateRef.current.page.shapes || [])].reverse().find(s =>
          pos.x >= s.x - 5 && pos.x <= s.x + s.width + 5 &&
          pos.y >= s.y - 5 && pos.y <= s.y + s.height + 5
        )

        if (hitShape) {
          if (stateRef.current.selectedShapeId !== hitShape.id) {
            setSelectedShapeId(hitShape.id)
          }
          // Start move drag immediately
          setActiveHandle('move')
          oldShapesRef.current = [...(stateRef.current.page.shapes || [])]
          dragStartPosRef.current = pos
          dragOffsetRef.current = { x: pos.x - hitShape.x, y: pos.y - hitShape.y }
          isDrawingRef.current = true
        } else {
          setSelectedShapeId(null)
          setActiveHandle(null)
        }
        if (e.cancelable) e.preventDefault()
        return
      }

      if (stateRef.current.activeTool === 'text') {
        const pos = getPos(e)
        const newTextField: TextField = {
          id: crypto.randomUUID(),
          x: pos.x,
          y: pos.y,
          text: '',
          color: stateRef.current.activeColor,
          fontSize: stateRef.current.activeSize
        }
        setJustCreatedId(newTextField.id)
        stateRef.current.onUpdate({
          ...stateRef.current.page,
          textFields: [...(stateRef.current.page.textFields || []), newTextField]
        })
        if (e.cancelable) e.preventDefault()
        return
      }

      const pos = getPos(e)

      if (stateRef.current.activeTool === 'lasso') {
        // Check if clicking inside current selection to drag
        if (stateRef.current.selectionBox && isPointInBox(pos, stateRef.current.selectionBox, 20)) {
          isDraggingSelectionRef.current = true
          dragStartPosRef.current = pos

          // Redraw main canvas without selected strokes to avoid flickering during move
          const canvas = strokeCanvasRef.current
          const ctx = canvas?.getContext('2d')
          if (ctx) {
            ctx.clearRect(0, 0, width, height)
            const unselectedStrokes = stateRef.current.page.strokes.filter(s => !stateRef.current.selectedStrokeIds.includes(s.id))
            drawAllStrokes(ctx, unselectedStrokes, null, undefined, stateRef.current.page.shapes || [])
          }

          if (e.cancelable) e.preventDefault()
          return
        } else {
          // Start a new lasso selection
          setSelectedStrokeIds([])
        }
      }

      if (cursorRef.current && stateRef.current.activeTool === 'eraser') {
        setErasedStrokeIds([])
        const diameter = stateRef.current.activeSize
        cursorRef.current.style.display = 'block'
        cursorRef.current.style.width = `${diameter}px`
        cursorRef.current.style.height = `${diameter}px`
        cursorRef.current.style.marginLeft = `${-diameter / 2}px`
        cursorRef.current.style.marginTop = `${-diameter / 2}px`
        cursorRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`
      }

      isDrawingRef.current = true
      pointsRef.current = [pos]
      lastLineWidthRef.current = activeSize

      // Start hold detection for drawing tools
      if (activeTool === 'pen' || activeTool === 'crayon') {
        isStraightLineModeRef.current = false

        const timeoutId = window.setTimeout(() => {
          if (isDrawingRef.current && pointsRef.current.length >= 2) {
            isStraightLineModeRef.current = true

            // Snap to straight line
            const startPoint = pointsRef.current[0]
            const endPoint = pointsRef.current[pointsRef.current.length - 1]
            pointsRef.current = [startPoint, endPoint]
          }
        }, 1000) // 1 second hold
        holdTimeoutRef.current = timeoutId
      }

      if (e.cancelable) e.preventDefault()
    }

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const pos = getPos(e)
      const canvas = strokeCanvasRef.current

      // Eraser cursor logic
      if (cursorRef.current && stateRef.current.activeTool === 'eraser') {
        const diameter = stateRef.current.activeSize
        cursorRef.current.style.display = 'block'
        cursorRef.current.style.width = `${diameter}px`
        cursorRef.current.style.height = `${diameter}px`
        cursorRef.current.style.marginLeft = `${-diameter / 2}px`
        cursorRef.current.style.marginTop = `${-diameter / 2}px`
        cursorRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`
      }

      if (!canvas) return

      // Dynamic cursor for Select Tool
      if (stateRef.current.activeTool === 'select') {
        let cursor = 'default'

        // 1. Check selected shape handles/delete button
        if (stateRef.current.selectedShapeId) {
          const shape = stateRef.current.page.shapes?.find(s => s.id === stateRef.current.selectedShapeId)
          if (shape) {
            // Check delete handle
            const deleteX = shape.x + shape.width + 20
            const deleteY = shape.y - 20
            const deleteSize = 30 / scale
            if (Math.hypot(pos.x - deleteX, pos.y - deleteY) < deleteSize / 2) {
              cursor = 'pointer'
            } else {
              // Check resize handles
              const handleSize = 25 / scale
              const handles = {
                tl: { x: shape.x, y: shape.y },
                tr: { x: shape.x + shape.width, y: shape.y },
                bl: { x: shape.x, y: shape.y + shape.height },
                br: { x: shape.x + shape.width, y: shape.y + shape.height }
              }
              for (const [id, h] of Object.entries(handles)) {
                if (Math.hypot(pos.x - h.x, pos.y - h.y) < handleSize / 2) {
                  if (id === 'tl' || id === 'br') cursor = 'nwse-resize'
                  else if (id === 'tr' || id === 'bl') cursor = 'nesw-resize'
                  break
                }
              }

              // Check inside shape for move
              if (cursor === 'default') {
                if (pos.x >= shape.x && pos.x <= shape.x + shape.width && pos.y >= shape.y && pos.y <= shape.y + shape.height) {
                  cursor = 'move'
                }
              }
            }
          }
        }

        // 2. Check unselected shapes
        if (cursor === 'default') {
          const hitShape = [...(stateRef.current.page.shapes || [])].reverse().find(s =>
            pos.x >= s.x - 5 && pos.x <= s.x + s.width + 5 &&
            pos.y >= s.y - 5 && pos.y <= s.y + s.height + 5
          )
          if (hitShape) cursor = 'move'
        }

        canvas.style.cursor = cursor
      } else {
        // Revert to tool defaults if not select
        const tool = stateRef.current.activeTool
        if (tool === 'text') canvas.style.cursor = 'text'
        else if (tool === 'eraser') canvas.style.cursor = 'none'
        else canvas.style.cursor = 'crosshair'
      }
    }

    const handlePointerLeave = () => {
      if (cursorRef.current) {
        cursorRef.current.style.display = 'none'
      }
    }

    const handleMove = (e: TouchEvent | MouseEvent) => {
      const pos = getPos(e)

      if (stateRef.current.activeTool === 'select' && stateRef.current.selectedShapeId && stateRef.current.activeHandle) {
        const updatedShapes = stateRef.current.page.shapes.map(s => {
          if (s.id !== stateRef.current.selectedShapeId) return s
          let { x, y, width, height } = s
          if (stateRef.current.activeHandle === 'move') {
            x = pos.x - dragOffsetRef.current.x
            y = pos.y - dragOffsetRef.current.y
          } else {
            if (stateRef.current.activeHandle === 'tl') {
              width = width + (x - pos.x)
              height = height + (y - pos.y)
              x = pos.x
              y = pos.y
            } else if (stateRef.current.activeHandle === 'tr') {
              width = pos.x - x
              height = height + (y - pos.y)
              y = pos.y
            } else if (stateRef.current.activeHandle === 'bl') {
              width = width + (x - pos.x)
              x = pos.x
              height = pos.y - y
            } else if (stateRef.current.activeHandle === 'br') {
              width = pos.x - x
              height = pos.y - y
            }
          }
          return { ...s, x, y, width, height }
        })
        stateRef.current.onUpdate({ ...stateRef.current.page, shapes: updatedShapes })
        if (e.cancelable) e.preventDefault()
        return
      }

      if (isDraggingSelectionRef.current && dragStartPosRef.current) {
        if (e.cancelable) e.preventDefault()
        const dx = pos.x - dragStartPosRef.current.x
        const dy = pos.y - dragStartPosRef.current.y
        dragOffsetRef.current = { x: dx, y: dy }
        return
      }

      if (!isDrawingRef.current) return
      if (e.cancelable) e.preventDefault()

      if (cursorRef.current && stateRef.current.activeTool === 'eraser') {
        const diameter = stateRef.current.activeSize
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
        }
      } else {
        pointsRef.current.push(pos)



        if (stateRef.current.activeTool === 'eraser') {
          const radius = stateRef.current.activeSize / 2
          const newlyErased = stateRef.current.page.strokes
            .filter(s => !stateRef.current.erasedStrokeIds.includes(s.id) && isStrokeHitByCircle(s, pos, radius))
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
          if (stateRef.current.activeTool === 'pen' || stateRef.current.activeTool === 'crayon') {
            const timeoutId = window.setTimeout(() => {
              if (isDrawingRef.current && pointsRef.current.length >= 2) {
                isStraightLineModeRef.current = true
                const startPoint = pointsRef.current[0]
                const endPoint = pointsRef.current[pointsRef.current.length - 1]
                pointsRef.current = [startPoint, endPoint]
              }
            }, 500)
            holdTimeoutRef.current = timeoutId
          }
        }
      }

      requestIdleCallback(() => {
        if (forceEl) forceEl.textContent = 'force = N/A'
        const touch = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : null
        if (touchesEl && touch) {
          touchesEl.innerHTML = `type: ${(touch as any).touchType || 'unknown'}`
        }
      })
    }

    const handleUp = () => {
      if (stateRef.current.activeTool === 'select') {
        if (stateRef.current.selectedShapeId && stateRef.current.activeHandle) {
          if (stateRef.current.onOperation && JSON.stringify(oldShapesRef.current) !== JSON.stringify(stateRef.current.page.shapes)) {
            stateRef.current.onOperation({
              type: 'bulk-update',
              pageId: stateRef.current.page.id,
              oldStrokes: stateRef.current.page.strokes,
              newStrokes: stateRef.current.page.strokes,
              oldShapes: oldShapesRef.current,
              newShapes: stateRef.current.page.shapes
            })
          }
        }
        setActiveHandle(null)
        isDrawingRef.current = false
        return
      }

      if (isDraggingSelectionRef.current && dragStartPosRef.current) {
        isDraggingSelectionRef.current = false
        const { x: dx, y: dy } = dragOffsetRef.current

        if (dx !== 0 || dy !== 0) {
          const updatedStrokes = stateRef.current.page.strokes.map(s => {
            if (stateRef.current.selectedStrokeIds.includes(s.id)) {
              return {
                ...s,
                points: s.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy }))
              }
            }
            return s
          })
          if (stateRef.current.onOperation) {
            stateRef.current.onOperation({ type: 'bulk-update', pageId: stateRef.current.page.id, oldStrokes: stateRef.current.page.strokes, newStrokes: updatedStrokes })
          } else {
            stateRef.current.onUpdate({ ...stateRef.current.page, strokes: updatedStrokes })
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
        if (stateRef.current.activeTool === 'laser') {
          laserStrokesRef.current.push({ points: [...pointsRef.current], timestamp: Date.now() })
        } else if (stateRef.current.activeTool === 'lasso') {
          const lassoPolygon = [...pointsRef.current]

          let hasChanges = false
          const newStrokes: Stroke[] = []
          const newSelectedIds: string[] = []

          for (let i = 0; i < stateRef.current.page.strokes.length; i++) {
            const s = stateRef.current.page.strokes[i]

            if (s.tool !== 'eraser' && isStrokeInPolygon(s, lassoPolygon)) {
              const relevantErasers = stateRef.current.page.strokes.slice(i + 1).filter(e => e.tool === 'eraser')

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
            if (stateRef.current.onOperation) {
              stateRef.current.onOperation({ type: 'bulk-update', pageId: stateRef.current.page.id, oldStrokes: stateRef.current.page.strokes, newStrokes })
            } else {
              stateRef.current.onUpdate({ ...stateRef.current.page, strokes: newStrokes })
            }
            setSelectedStrokeIds(newSelectedIds)
          } else {
            setSelectedStrokeIds(newSelectedIds)
          }
        } else if (stateRef.current.activeTool !== 'eraser') {
          const stroke: Stroke = {
            id: crypto.randomUUID(),
            points: [...pointsRef.current],
            color: stateRef.current.activeColor,
            tool: stateRef.current.activeTool,
            size: stateRef.current.activeSize
          }
          if (stateRef.current.onOperation) {
            stateRef.current.onOperation({ type: 'add', pageId: stateRef.current.page.id, stroke })
          } else {
            stateRef.current.onUpdate({ ...stateRef.current.page, strokes: [...stateRef.current.page.strokes, stroke] })
          }
        }
      }

      if (stateRef.current.activeTool === 'eraser') {
        if (stateRef.current.erasedStrokeIds.length > 0) {
          const newStrokes = stateRef.current.page.strokes.filter(s => !stateRef.current.erasedStrokeIds.includes(s.id))
          if (stateRef.current.onOperation) {
            stateRef.current.onOperation({
              type: 'bulk-update',
              pageId: stateRef.current.page.id,
              oldStrokes: stateRef.current.page.strokes,
              newStrokes
            })
          } else {
            stateRef.current.onUpdate({ ...stateRef.current.page, strokes: newStrokes })
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
  }, [activeTool, width, height])

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
            cursor: activeTool === 'select' ? 'default' : activeTool === 'text' ? 'text' : activeTool === 'eraser' ? 'none' : activeTool === 'laser' ? 'crosshair' : 'crosshair',
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
