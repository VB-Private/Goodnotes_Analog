import React, { useState, useRef } from 'react'
import type { Figure } from '../types'

interface FigureComponentProps {
    figure: Figure
    scale: number
    isSelected: boolean
    onUpdate: (figure: Figure) => void
    onDelete: (id: string) => void
    onClick: (e: React.MouseEvent) => void
}

export default function FigureComponent({
    figure,
    scale,
    isSelected,
    onUpdate,
    onDelete,
    onClick
}: FigureComponentProps) {
    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState(false)
    const startPosRef = useRef({ x: 0, y: 0 })
    const startDimRef = useRef({ x: 0, y: 0, w: 0, h: 0 })

    const handlePointerDown = (e: React.PointerEvent, mode: 'move' | 'resize') => {
        e.stopPropagation()
        startPosRef.current = { x: e.clientX, y: e.clientY }
        startDimRef.current = { x: figure.x, y: figure.y, w: figure.width, h: figure.height }

        if (mode === 'move') {
            setIsDragging(true)
        } else {
            setIsResizing(true)
        }

        (e.target as Element).setPointerCapture(e.pointerId)
    }

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging && !isResizing) return

        const dx = (e.clientX - startPosRef.current.x) / scale
        const dy = (e.clientY - startPosRef.current.y) / scale

        if (isDragging) {
            onUpdate({
                ...figure,
                x: startDimRef.current.x + dx,
                y: startDimRef.current.y + dy
            })
        } else if (isResizing) {
            // For circle, we use the larger of dx/dy to maintainAspect or just map to width/height
            // Let's allow elliptical scaling for now, but radius will be based on average or one
            onUpdate({
                ...figure,
                width: Math.max(20, startDimRef.current.w + dx * 2),
                height: Math.max(20, startDimRef.current.h + dy * 2)
            })
        }
    }

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false)
        setIsResizing(false)
            ; (e.target as Element).releasePointerCapture(e.pointerId)
    }

    return (
        <div
            style={{
                position: 'absolute',
                left: figure.x - figure.width / 2,
                top: figure.y - figure.height / 2,
                width: figure.width,
                height: figure.height,
                cursor: isDragging ? 'grabbing' : isResizing ? 'nwse-resize' : 'grab',
                zIndex: isSelected ? 10 : 1,
                pointerEvents: 'auto',
            }}
            onClick={onClick}
            onPointerDown={(e) => handlePointerDown(e, 'move')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        >
            <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${figure.width} ${figure.height}`}
                style={{ overflow: 'visible' }}
            >
                {figure.type === 'circle' && (
                    <ellipse
                        cx={figure.width / 2}
                        cy={figure.height / 2}
                        rx={figure.width / 2}
                        ry={figure.height / 2}
                        stroke={figure.color}
                        strokeWidth={figure.strokeWidth}
                        fill="transparent"
                    />
                )}
            </svg>

            {isSelected && (
                <>
                    {/* Resize Handle */}
                    <div
                        onPointerDown={(e) => handlePointerDown(e, 'resize')}
                        style={{
                            position: 'absolute',
                            right: -5,
                            bottom: -5,
                            width: 20,
                            height: 20,
                            backgroundColor: '#007AFF',
                            borderRadius: '50%',
                            border: '2px solid white',
                            cursor: 'nwse-resize',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        }}
                    />
                    {/* Delete Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onDelete(figure.id)
                        }}
                        style={{
                            position: 'absolute',
                            top: -15,
                            right: -15,
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            backgroundColor: '#ff4d4d',
                            color: 'white',
                            border: '2px solid white',
                            fontSize: 14,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        }}
                    >
                        ×
                    </button>
                    {/* Selection Border */}
                    <div
                        style={{
                            position: 'absolute',
                            inset: -4,
                            border: '2px dashed #007AFF',
                            borderRadius: figure.type === 'circle' ? '50%' : 4,
                            pointerEvents: 'none',
                        }}
                    />
                </>
            )}
        </div>
    )
}
