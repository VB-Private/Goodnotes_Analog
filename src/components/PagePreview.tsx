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

                {(page.shapes || []).map((s) => {
                    const fill = (s.isFilled !== false) ? (s.color + '40') : 'none'
                    if (s.type === 'rect') {
                        return (
                            <rect
                                key={s.id}
                                x={s.x}
                                y={s.y}
                                width={s.width}
                                height={s.height}
                                fill={fill}
                                stroke={s.color}
                                strokeWidth={s.size}
                            />
                        )
                    } else if (s.type === 'circle') {
                        return (
                            <ellipse
                                key={s.id}
                                cx={s.x + s.width / 2}
                                cy={s.y + s.height / 2}
                                rx={Math.abs(s.width / 2)}
                                ry={Math.abs(s.height / 2)}
                                fill={fill}
                                stroke={s.color}
                                strokeWidth={s.size}
                            />
                        )
                    } else if (s.type === 'triangle') {
                        const points = `${s.x + s.width / 2},${s.y} ${s.x + s.width},${s.y + s.height} ${s.x},${s.y + s.height}`
                        return (
                            <polygon
                                key={s.id}
                                points={points}
                                fill={fill}
                                stroke={s.color}
                                strokeWidth={s.size}
                            />
                        )
                    }
                    return null
                })}
            </svg>
        </div>
    )
})

export default PagePreview
