import React from 'react'
import type { Page, Stroke } from '../types'
import { PAGE_WIDTH, PAGE_HEIGHT } from '../constants'

interface PagePreviewProps {
    page: Page
    width: number
    height: number
}

function getPathData(stroke: Stroke) {
    if (stroke.points.length < 2) return ''
    const points = stroke.points

    // Simplified path for thumbnails - just straight lines for speed
    // Using toFixed(1) to reduce SVG string size
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
    for (let i = 1; i < points.length; i++) {
        d += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`
    }
    return d
}

const PAPER_BG = '#fafaf8'

const PagePreview = React.memo(({ page, width, height }: PagePreviewProps) => {

    return (
        <div style={{
            width,
            height,
            background: PAPER_BG,
            borderRadius: '4px',
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid #e2e8f0',
            flexShrink: 0,
            backgroundColor: page.template === 'pdf' ? '#f1f5f9' : PAPER_BG
        }}>

            <svg
                viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`}
                style={{
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    pointerEvents: 'none'
                }}
                shapeRendering="optimizeSpeed"
            >
                {page.shapes?.map((shape) => {
                    if (shape.type === 'circle') {
                        return (
                            <ellipse
                                key={shape.id}
                                cx={shape.x + shape.width / 2}
                                cy={shape.y + shape.height / 2}
                                rx={Math.abs(shape.width / 2)}
                                ry={Math.abs(shape.height / 2)}
                                fill={shape.fillColor || "none"}
                                fillOpacity={shape.fillColor ? 0.25 : undefined}
                                stroke={shape.color}
                                strokeWidth={shape.strokeWidth}
                            />
                        )
                    }
                    if (shape.type === 'square') {
                        return (
                            <rect
                                key={shape.id}
                                x={shape.x}
                                y={shape.y}
                                width={shape.width}
                                height={shape.height}
                                fill={shape.fillColor || "none"}
                                fillOpacity={shape.fillColor ? 0.25 : undefined}
                                stroke={shape.color}
                                strokeWidth={shape.strokeWidth}
                            />
                        )
                    }
                    if (shape.type === 'triangle') {
                        const p1 = `${shape.x + shape.width / 2},${shape.y}`
                        const p2 = `${shape.x + shape.width},${shape.y + shape.height}`
                        const p3 = `${shape.x},${shape.y + shape.height}`
                        return (
                            <polygon
                                key={shape.id}
                                points={`${p1} ${p2} ${p3}`}
                                fill={shape.fillColor || "none"}
                                fillOpacity={shape.fillColor ? 0.25 : undefined}
                                stroke={shape.color}
                                strokeWidth={shape.strokeWidth}
                            />
                        )
                    }
                    return null
                })}
                {page.strokes.map((s) => (
                    <path
                        key={s.id}
                        d={getPathData(s)}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={s.size}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={s.tool === 'pencil' ? 0.6 : s.tool === 'crayon' ? 0.4 : 1}
                    />
                ))}
            </svg>
        </div>
    )
})

export default PagePreview
