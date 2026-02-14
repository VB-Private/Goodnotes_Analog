import React, { useRef } from 'react'
import type { Shape } from '../types'

interface ShapeComponentProps {
    shape: Shape
    isSelected: boolean
    onUpdate: (id: string, updates: Partial<Shape>) => void
    onDelete: (id: string) => void
    onSelect: (id: string | null) => void
    scale: number
    pointerEvents?: 'auto' | 'none'
}

const HANDLE_SIZE = 12

export default function ShapeComponent({
    shape,
    isSelected,
    onUpdate,
    onDelete,
    onSelect,
    scale,
    pointerEvents = 'auto'
}: ShapeComponentProps) {
    const isDraggingRef = useRef(false)
    const isResizingRef = useRef<string | null>(null)
    const startPosRef = useRef({ x: 0, y: 0 })
    const startShapeRef = useRef<Shape | null>(null)

    const handlePointerDown = (e: React.PointerEvent, action: 'drag' | string) => {
        e.stopPropagation()
        onSelect(shape.id)
        isDraggingRef.current = action === 'drag'
        isResizingRef.current = action !== 'drag' ? action : null
        startPosRef.current = { x: e.clientX, y: e.clientY }
        startShapeRef.current = { ...shape }
        containerRef.current?.setPointerCapture(e.pointerId)
    }

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDraggingRef.current && !isResizingRef.current) return
        if (!startShapeRef.current) return

        const dx = (e.clientX - startPosRef.current.x) / scale
        const dy = (e.clientY - startPosRef.current.y) / scale

        if (isDraggingRef.current) {
            onUpdate(shape.id, {
                x: startShapeRef.current.x + dx,
                y: startShapeRef.current.y + dy
            })
        } else if (isResizingRef.current) {
            const handle = isResizingRef.current
            const updates: Partial<Shape> = {}
            const s = startShapeRef.current
            const minSize = 20

            if (handle.includes('e')) {
                updates.width = Math.max(minSize, s.width + dx)
            }
            if (handle.includes('w')) {
                const newWidth = Math.max(minSize, s.width - dx)
                updates.width = newWidth
                updates.x = s.x + (s.width - newWidth)
            }
            if (handle.includes('s')) {
                updates.height = Math.max(minSize, s.height + dy)
            }
            if (handle.includes('n')) {
                const newHeight = Math.max(minSize, s.height - dy)
                updates.height = newHeight
                updates.y = s.y + (s.height - newHeight)
            }

            onUpdate(shape.id, updates)
        }
    }

    const handlePointerUp = (e: React.PointerEvent) => {
        isDraggingRef.current = false
        isResizingRef.current = null
            ; (e.target as HTMLElement).releasePointerCapture(e.pointerId)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (isSelected && (e.key === 'Delete' || e.key === 'Backspace')) {
            onDelete(shape.id)
        }
    }

    const style: React.CSSProperties = {
        position: 'absolute',
        left: shape.x,
        top: shape.y,
        width: shape.width,
        height: shape.height,
        cursor: pointerEvents === 'none' ? 'default' : isSelected ? 'move' : 'pointer',
        pointerEvents: pointerEvents,
        touchAction: 'none'
    }

    const containerRef = useRef<HTMLDivElement>(null)

    const handleStyle = (pos: string): React.CSSProperties => {
        const top = pos.includes('n') ? '0%' : pos.includes('s') ? '100%' : '50%'
        const left = pos.includes('w') ? '0%' : pos.includes('e') ? '100%' : '50%'
        return {
            position: 'absolute',
            top,
            left,
            width: HANDLE_SIZE + 4, // Slightly larger hit area
            height: HANDLE_SIZE + 4,
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: 'translate(-50%, -50%)',
            cursor: pos === 'n' || pos === 's' ? 'ns-resize' : pos === 'e' || pos === 'w' ? 'ew-resize' : pos === 'nw' || pos === 'se' ? 'nwse-resize' : 'nesw-resize',
        }
    }

    const handleInnerStyle = {
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        background: '#fff',
        border: '2px solid #007AFF',
        borderRadius: '50%',
        pointerEvents: 'none' as const
    }

    return (
        <div
            ref={containerRef}
            data-shape-id={shape.id}
            style={style}
            onPointerDown={(e) => {
                const target = e.target as HTMLElement
                const handleEl = target.closest('[data-handle]') as HTMLElement
                const action = handleEl ? (handleEl.dataset.handle as string) : 'drag'
                handlePointerDown(e, action)
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            tabIndex={0}
            onKeyDown={handleKeyDown}
        >
            <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${shape.width} ${shape.height}`}
                style={{
                    display: 'block',
                    overflow: 'visible',
                    filter: isSelected ? 'drop-shadow(0 0 4px rgba(0, 122, 255, 0.4))' : 'none'
                }}
            >
                {shape.type === 'rect' && (
                    <rect
                        x={shape.size / 2}
                        y={shape.size / 2}
                        width={Math.max(0, shape.width - shape.size)}
                        height={Math.max(0, shape.height - shape.size)}
                        stroke={shape.color}
                        strokeWidth={shape.size}
                        fill={shape.isFilled ? `${shape.color}40` : 'transparent'}
                        rx={2}
                    />
                )}
                {shape.type === 'circle' && (
                    <ellipse
                        cx={shape.width / 2}
                        cy={shape.height / 2}
                        rx={Math.max(0, shape.width / 2 - shape.size / 2)}
                        ry={Math.max(0, shape.height / 2 - shape.size / 2)}
                        stroke={shape.color}
                        strokeWidth={shape.size}
                        fill={shape.isFilled ? `${shape.color}40` : 'transparent'}
                    />
                )}
                {shape.type === 'triangle' && (
                    <path
                        d={`M ${shape.width / 2} ${shape.size / 2} L ${shape.width - shape.size / 2} ${shape.height - shape.size / 2} L ${shape.size / 2} ${shape.height - shape.size / 2} Z`}
                        stroke={shape.color}
                        strokeWidth={shape.size}
                        fill={shape.isFilled ? `${shape.color}40` : 'transparent'}
                        strokeLinejoin="round"
                    />
                )}
                {isSelected && (
                    <rect
                        x={-2}
                        y={-2}
                        width={shape.width + 4}
                        height={shape.height + 4}
                        fill="none"
                        stroke="#007AFF"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                    />
                )}
            </svg>

            {isSelected && pointerEvents === 'auto' && (
                <>
                    <div style={{ ...handleStyle('nw'), zIndex: 100 }} data-handle="nw"><div style={handleInnerStyle} /></div>
                    <div style={{ ...handleStyle('ne'), zIndex: 100 }} data-handle="ne"><div style={handleInnerStyle} /></div>
                    <div style={{ ...handleStyle('sw'), zIndex: 100 }} data-handle="sw"><div style={handleInnerStyle} /></div>
                    <div style={{ ...handleStyle('se'), zIndex: 100 }} data-handle="se"><div style={handleInnerStyle} /></div>
                    <div style={{ ...handleStyle('n'), zIndex: 100 }} data-handle="n"><div style={handleInnerStyle} /></div>
                    <div style={{ ...handleStyle('s'), zIndex: 100 }} data-handle="s"><div style={handleInnerStyle} /></div>
                    <div style={{ ...handleStyle('e'), zIndex: 100 }} data-handle="e"><div style={handleInnerStyle} /></div>
                    <div style={{ ...handleStyle('w'), zIndex: 100 }} data-handle="w"><div style={handleInnerStyle} /></div>
                </>
            )}
        </div>
    )
}
