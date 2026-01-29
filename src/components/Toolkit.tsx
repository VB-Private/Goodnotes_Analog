import { useRef } from 'react'
import type { ToolType } from '../types'

interface ToolkitProps {
    activeTool: ToolType
    activeColor: string
    activeSize: number
    onToolChange: (tool: ToolType) => void
    onColorChange: (color: string) => void
    onSizeChange: (size: number) => void
    onBack: () => void
    onAddPage: () => void
}

const COLORS = [
    '#000000', // Black
    '#2196F3', // Blue
    '#4CAF50', // Green
    '#FFC107', // Yellow
    '#F44336', // Red
]

export default function Toolkit({
    activeTool,
    activeColor,
    activeSize,
    onToolChange,
    onColorChange,
    onSizeChange,
    onBack,
    onAddPage
}: ToolkitProps) {
    const colorInputRef = useRef<HTMLInputElement>(null)

    return (
        <div
            style={{
                position: 'fixed',
                left: '50%',
                top: 20,
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(28, 28, 30, 0.85)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: 20,
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                zIndex: 1000,
            }}
        >
            {/* Navigation & Actions */}
            <div style={{ display: 'flex', gap: 8, paddingRight: 8, borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                <IconButton onClick={onBack} title="Back">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                </IconButton>
                <IconButton onClick={onAddPage} title="Add Page">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                </IconButton>
            </div>

            {/* Tools Section */}
            <div style={{ display: 'flex', gap: 6 }}>
                <ToolButton
                    active={activeTool === 'pen'}
                    onClick={() => onToolChange('pen')}
                    label="Pen"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                </ToolButton>
                <ToolButton
                    active={activeTool === 'eraser'}
                    onClick={() => onToolChange('eraser')}
                    label="Eraser"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="4 7 4 4 20 4 20 7" />
                        <line x1="9" y1="20" x2="15" y2="20" />
                        <line x1="12" y1="4" x2="12" y2="20" />
                    </svg>
                </ToolButton>
            </div>

            <div style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

            {/* Colors Section */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {COLORS.map(color => (
                    <button
                        key={color}
                        onClick={() => {
                            onColorChange(color)
                            onToolChange('pen')
                        }}
                        style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            backgroundColor: color,
                            border: '1.5px solid rgba(255,255,255,0.2)',
                            outline: activeColor === color && activeTool === 'pen' ? `2px solid #007AFF` : 'none',
                            outlineOffset: '2px',
                            cursor: 'pointer',
                            transition: 'transform 0.1s',
                            transform: activeColor === color && activeTool === 'pen' ? 'scale(1.2)' : 'scale(1)',
                        }}
                        aria-label={`Select ${color}`}
                    />
                ))}

                <button
                    onClick={() => colorInputRef.current?.click()}
                    style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                        border: '1.5px solid rgba(255,255,255,0.2)',
                        outline: !COLORS.includes(activeColor) && activeTool === 'pen' ? '2px solid #007AFF' : 'none',
                        outlineOffset: '2px',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                    title="Custom Color"
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
                            width: 40,
                            height: 40,
                            opacity: 0,
                            cursor: 'pointer'
                        }}
                    />
                </button>
            </div>

            <div style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

            {/* Width Section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 60 }}>
                    <input
                        type="range"
                        min="1"
                        max="40"
                        step="1"
                        value={activeSize}
                        onChange={(e) => onSizeChange(Number(e.target.value))}
                        style={{
                            width: '100%',
                            height: 4,
                            cursor: 'pointer',
                            accentColor: '#007AFF',
                        }}
                    />
                </div>
                <div
                    style={{
                        width: 24,
                        height: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}
                >
                    <div
                        style={{
                            width: Math.min(16, Math.max(1, activeSize / 2)),
                            height: Math.min(16, Math.max(1, activeSize / 2)),
                            borderRadius: '50%',
                            backgroundColor: activeTool === 'eraser' ? '#ff9b9b' : activeColor,
                        }}
                    />
                </div>
            </div>
        </div>
    )
}

function ToolButton({ children, active, onClick, label }: { children: React.ReactNode, active: boolean, onClick: () => void, label: string }) {
    return (
        <button
            onClick={onClick}
            style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? '#007AFF' : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.8)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            title={label}
        >
            {children}
        </button>
    )
}

function IconButton({ children, onClick, title }: { children: React.ReactNode, onClick: () => void, title: string }) {
    return (
        <button
            onClick={onClick}
            style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                color: 'rgba(255,255,255,0.8)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            title={title}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
            {children}
        </button>
    )
}
