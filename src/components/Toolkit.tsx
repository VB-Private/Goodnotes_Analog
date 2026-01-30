import React, { useRef } from 'react'
import type { ToolType } from '../types'

interface ToolkitProps {
    activeTool: ToolType
    activeColor: string
    activeSize: number
    onToolChange: (tool: ToolType) => void
    onColorChange: (color: string) => void
    onSizeChange: (size: number) => void
}

const COLORS = [
    '#000000', // Black
    '#2196F3', // Blue
    '#4CAF50', // Green
    '#FFC107', // Yellow
    '#F44336', // Red
]

// SIZES constant removed as we use a slider now

export default function Toolkit({
    activeTool,
    activeColor,
    activeSize,
    onToolChange,
    onColorChange,
    onSizeChange
}: ToolkitProps) {
    const colorInputRef = useRef<HTMLInputElement>(null)

    return (
        <div
            style={{
                position: 'fixed',
                right: 20,
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(12px)',
                borderRadius: 24,
                padding: '20px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                zIndex: 100,
            }}
        >
            {/* Tools Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <ToolButton
                    active={activeTool === 'pen'}
                    onClick={() => onToolChange('pen')}
                    label="Pen"
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                </ToolButton>
                <ToolButton
                    active={activeTool === 'eraser'}
                    onClick={() => onToolChange('eraser')}
                    label="Eraser"
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21H7Z" />
                        <path d="m22 21-5-5" />
                        <path d="m5 11 9 9" />
                    </svg>
                </ToolButton>
                <ToolButton
                    active={activeTool === 'text'}
                    onClick={() => onToolChange('text')}
                    label="Text"
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="4 7 4 4 20 4 20 7" />
                        <line x1="9" y1="20" x2="15" y2="20" />
                        <line x1="12" y1="4" x2="12" y2="20" />
                    </svg>
                </ToolButton>
            </div>

            <div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.08)', margin: '0 4px' }} />

            {/* Width Slider Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15, alignItems: 'center', padding: '10px 0' }}>
                <div
                    style={{
                        width: 32,
                        height: 32,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0,0,0,0.05)',
                        borderRadius: '50%',
                        border: '1px solid rgba(0,0,0,0.1)'
                    }}
                >
                    <div
                        style={{
                            width: Math.max(1, activeSize),
                            height: Math.max(1, activeSize),
                            borderRadius: '50%',
                            backgroundColor: activeTool === 'eraser' ? '#ff9b9b' : activeColor,
                            maxWidth: 24,
                            maxHeight: 24,
                            transition: 'width 0.1s, height 0.1s'
                        }}
                    />
                </div>
                <div style={{ height: 100, display: 'flex', alignItems: 'center' }}>
                    <input
                        type="range"
                        min="1"
                        max="40"
                        step="1"
                        value={activeSize}
                        onChange={(e) => onSizeChange(Number(e.target.value))}
                        style={{
                            WebkitAppearance: 'slider-vertical',
                            width: 8,
                            height: '100%',
                            cursor: 'pointer',
                        } as React.CSSProperties}
                    />
                </div>
                <span style={{ fontSize: 10, fontWeight: 'bold', color: '#666' }}>{activeSize}px</span>
            </div>

            <div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.08)', margin: '0 4px' }} />

            {/* Colors Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {COLORS.map(color => (
                    <button
                        key={color}
                        onClick={() => {
                            onColorChange(color)
                            onToolChange('pen')
                        }}
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            backgroundColor: color,
                            border: '2px solid #fff',
                            outline: activeColor === color && activeTool === 'pen' ? '2px solid #007AFF' : 'none',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            cursor: 'pointer',
                            transition: 'transform 0.2s',
                            transform: activeColor === color && activeTool === 'pen' ? 'scale(1.1)' : 'scale(1)',
                        }}
                        aria-label={`Select ${color}`}
                    />
                ))}

                {/* Color Wheel Functional */}
                <button
                    onClick={() => colorInputRef.current?.click()}
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                        border: '2px solid #fff',
                        outline: !COLORS.includes(activeColor) && activeTool === 'pen' ? '2px solid #007AFF' : 'none',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                        transform: !COLORS.includes(activeColor) && activeTool === 'pen' ? 'scale(1.1)' : 'scale(1)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                    title="Pick a custom color"
                >
                    <input
                        ref={colorInputRef}
                        type="color"
                        value={activeColor}
                        onChange={(e) => {
                            onColorChange(e.target.value)
                            onToolChange('pen')
                        }}
                        style={{
                            position: 'absolute',
                            top: -10,
                            left: -10,
                            width: 50,
                            height: 50,
                            opacity: 0,
                            cursor: 'pointer'
                        }}
                    />
                </button>
            </div>
        </div>
    )
}

function ToolButton({ children, active, onClick, label }: { children: React.ReactNode, active: boolean, onClick: () => void, label: string }) {
    return (
        <button
            onClick={onClick}
            style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? '#007AFF' : 'transparent',
                color: active ? '#fff' : '#333',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
            }}
            title={label}
        >
            {children}
        </button>
    )
}
