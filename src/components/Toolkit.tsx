import React, { useRef, useState, useEffect } from 'react'
import type { ToolType } from '../types'
import { useVisualViewport } from '../hooks/useVisualViewport'

interface ToolkitProps {
    activeTool: ToolType
    activeColor: string
    activeSize: number
    onToolChange: (tool: ToolType) => void
    onColorChange: (color: string) => void
    onSizeChange: (size: number) => void
    onUndo?: () => void
    onRedo?: () => void
    canUndo?: boolean
    canRedo?: boolean
}

const COLORS = [
    '#000000', // Black
    '#2196F3', // Blue
    '#4CAF50', // Green
    '#FFC107', // Yellow
    '#F44336', // Red
    '#9C27B0', // Purple
    '#FF4081', // Pink
    '#795548', // Brown
]

const PEN_SIZES = [
    { label: 'Extra Small', value: 2 },
    { label: 'Smaller', value: 3 },
    { label: 'Small', value: 5 },
    { label: 'Medium', value: 10 },
    { label: 'Big', value: 15 },
]

const ERASER_SIZES = [
    { label: 'Medium', value: 40 },
    { label: 'Big', value: 70 },
    { label: 'Biggest', value: 140 },
]

export default function Toolkit({
    activeTool,
    activeColor,
    activeSize,
    onToolChange,
    onColorChange,
    onSizeChange,
    onUndo,
    onRedo,
    canUndo,
    canRedo
}: ToolkitProps) {
    const viewport = useVisualViewport()
    const toolkitRef = useRef<HTMLDivElement>(null)
    const colorInputRef = useRef<HTMLInputElement>(null)
    const [openPopup, setOpenPopup] = useState<'pen' | 'eraser' | 'figures' | null>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (openPopup && toolkitRef.current && !toolkitRef.current.contains(event.target as Node)) {
                setOpenPopup(null)
            }
        }
        // Use mousedown to catch clicks before they might trigger other things
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [openPopup])

    const isPenLike = activeTool === 'pen' || activeTool === 'pencil' || activeTool === 'crayon'

    const handleToolClick = (tool: ToolType) => {
        if (tool === 'pen') {
            if (isPenLike) {
                setOpenPopup(openPopup === 'pen' ? null : 'pen')
            } else {
                onToolChange('pen')
                setOpenPopup(null)
            }
        } else if (tool === 'eraser') {
            if (activeTool === 'eraser') {
                setOpenPopup(openPopup === 'eraser' ? null : 'eraser')
            } else {
                onToolChange('eraser')
                setOpenPopup(null)
            }
        } else {
            onToolChange(tool)
            setOpenPopup(null)
        }
    }

    const containerStyle: React.CSSProperties = viewport ? {
        position: 'fixed',
        left: viewport.offsetLeft + (viewport.width / 2),
        top: viewport.offsetTop + 6,
        transform: `translateX(-50%) scale(${1 / viewport.scale})`,
        transformOrigin: 'top center',
        zIndex: 150,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
    } : {
        position: 'fixed',
        left: '50%',
        top: 6,
        transform: 'translateX(-50%)',
        zIndex: 150,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
    }

    const barStyle: React.CSSProperties = {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(20px)',
        borderRadius: 24,
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        pointerEvents: 'auto',
    }

    return (
        <div ref={toolkitRef} style={containerStyle}>
            <div style={barStyle}>
                <ToolButton
                    active={isPenLike}
                    activeColor={activeColor}
                    onClick={() => handleToolClick('pen')}
                    label="Pen Tools"
                >
                    <PenIcon
                        type={activeTool === 'pencil' ? 'pencil' : activeTool === 'crayon' ? 'crayon' : 'pen'}
                        color={activeColor}
                    />
                </ToolButton>

                <ToolButton
                    active={activeTool === 'eraser'}
                    onClick={() => handleToolClick('eraser')}
                    label="Eraser"
                >
                    <EraserIcon />
                </ToolButton>

                <ToolButton
                    active={activeTool === 'text'}
                    onClick={() => handleToolClick('text')}
                    label="Text"
                >
                    <TextIcon />
                </ToolButton>

                <div style={{ width: 1, height: 24, backgroundColor: 'rgba(0,0,0,0.1)', margin: '0 8px' }} />

                <ToolButton
                    active={activeTool === 'laser'}
                    onClick={() => handleToolClick('laser')}
                    label="Laser"
                >
                    <LaserIcon />
                </ToolButton>

                <ToolButton
                    active={activeTool === 'lasso'}
                    onClick={() => handleToolClick('lasso')}
                    label="Lasso"
                >
                    <LassoIcon />
                </ToolButton>

                <ToolButton
                    active={activeTool === 'figures'}
                    onClick={() => handleToolClick('figures')}
                    label="Figures"
                >
                    <ShapesIcon />
                </ToolButton>

                <div style={{ width: 1, height: 24, backgroundColor: 'rgba(0,0,0,0.1)', margin: '0 8px' }} />

                <ToolButton
                    active={false}
                    onClick={onUndo || (() => { })}
                    label="Undo"
                    disabled={!canUndo}
                >
                    <UndoIcon />
                </ToolButton>

                <ToolButton
                    active={false}
                    onClick={onRedo || (() => { })}
                    label="Redo"
                    disabled={!canRedo}
                >
                    <RedoIcon />
                </ToolButton>
            </div>

            {/* Popups */}
            {openPopup === 'pen' && (
                <div
                    style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: 20,
                        padding: 16,
                        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.15)',
                        border: '1px solid rgba(0,0,0,0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                        pointerEvents: 'auto',
                        minWidth: 240,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Tool Sub-types */}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <SubToolButton
                            active={activeTool === 'pen'}
                            activeColor={activeColor}
                            onClick={() => onToolChange('pen')}
                            label="Pen"
                        >
                            <PenIcon type="pen" color={activeColor} />
                        </SubToolButton>
                        <SubToolButton
                            active={activeTool === 'pencil'}
                            activeColor={activeColor}
                            onClick={() => onToolChange('pencil')}
                            label="Pencil"
                        >
                            <PenIcon type="pencil" color={activeColor} />
                        </SubToolButton>
                        <SubToolButton
                            active={activeTool === 'crayon'}
                            activeColor={activeColor}
                            onClick={() => onToolChange('crayon')}
                            label="Crayon"
                        >
                            <PenIcon type="crayon" color={activeColor} />
                        </SubToolButton>
                    </div>

                    <div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />

                    {/* Width Presets */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Size</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {PEN_SIZES.map(size => (
                                <button
                                    key={size.value}
                                    onClick={() => onSizeChange(size.value)}
                                    style={{
                                        flex: 1,
                                        height: 40,
                                        borderRadius: 12,
                                        border: 'none',
                                        backgroundColor: activeSize === size.value ? (activeColor || '#007AFF') : '#f5f5f7',
                                        color: activeSize === size.value ? '#fff' : '#555',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: size.value * 2,
                                            height: size.value * 2,
                                            borderRadius: '50%',
                                            backgroundColor: activeSize === size.value ? '#fff' : '#555',
                                            minWidth: 2,
                                            minHeight: 2,
                                        }}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />

                    {/* Colors */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                        {COLORS.map(color => (
                            <button
                                key={color}
                                onClick={() => onColorChange(color)}
                                style={{
                                    width: '100%',
                                    aspectRatio: '1',
                                    borderRadius: '50%',
                                    backgroundColor: color,
                                    border: activeColor === color ? '3px solid #fff' : '2px solid transparent',
                                    outline: activeColor === color ? '2px solid #007AFF' : 'none',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                }}
                            />
                        ))}
                        <button
                            onClick={() => colorInputRef.current?.click()}
                            style={{
                                width: '100%',
                                aspectRatio: '1',
                                borderRadius: '50%',
                                background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                                border: '2px solid #fff',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                cursor: 'pointer',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            <input
                                ref={colorInputRef}
                                type="color"
                                value={activeColor}
                                onChange={(e) => onColorChange(e.target.value)}
                                style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }}
                            />
                        </button>
                    </div>
                </div>
            )
            }

            {
                openPopup === 'eraser' && (
                    <div
                        style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(20px)',
                            borderRadius: 20,
                            padding: 16,
                            boxShadow: '0 12px 48px rgba(0, 0, 0, 0.15)',
                            border: '1px solid rgba(0,0,0,0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                            pointerEvents: 'auto',
                            minWidth: 200,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Eraser Size</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {ERASER_SIZES.map(size => (
                                    <button
                                        key={size.value}
                                        onClick={() => onSizeChange(size.value)}
                                        style={{
                                            flex: 1,
                                            height: 48,
                                            borderRadius: 12,
                                            border: 'none',
                                            backgroundColor: activeSize === size.value ? '#007AFF' : '#f5f5f7',
                                            color: activeSize === size.value ? '#fff' : '#555',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 4,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: Math.min(24, size.value / 2),
                                                height: Math.min(24, size.value / 2),
                                                borderRadius: 5,
                                                backgroundColor: activeSize === size.value ? '#fff' : '#555',
                                            }}
                                        />
                                        {/* <span style={{ fontSize: 9, fontWeight: 600 }}>{size.label}</span> */}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }


        </div >
    )
}

function ToolButton({ children, active, onClick, label, disabled, activeColor }: { children: React.ReactNode, active: boolean, onClick: () => void, label: string, disabled?: boolean, activeColor?: string }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? (activeColor ? 'rgba(0,0,0,0.05)' : '#E3F2FD') : 'transparent',
                color: active ? (activeColor || '#007AFF') : '#555',
                border: active && activeColor ? `2px solid ${activeColor}` : 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: disabled ? 0.3 : 1,
                boxSizing: 'border-box',
            }}
            title={label}
        >
            {children}
        </button>
    )
}

function SubToolButton({ children, active, onClick, label, activeColor }: { children: React.ReactNode, active: boolean, onClick: () => void, label: string, activeColor?: string }) {
    return (
        <button
            onClick={onClick}
            style={{
                flex: 1,
                padding: '12px 8px',
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                backgroundColor: active ? (activeColor ? `${activeColor}10` : 'rgba(0,122,255,0.06)') : '#f5f5f7',
                color: active ? (activeColor || '#007AFF') : '#555',
                border: active ? `2px solid ${activeColor || '#007AFF'}` : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxSizing: 'border-box',
            }}
        >
            {children}
            <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
        </button>
    )
}

// Icons
function PenIcon({ type, color }: { type: 'pen' | 'pencil' | 'crayon', color?: string }) {
    const strokeColor = color || 'currentColor'
    if (type === 'pencil') {
        return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
        )
    }
    if (type === 'crayon') {
        return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m11 4 7 7-9 9-4 1 1-4 9-9z" />
                <path d="M15 8l4 4" />
                <path d="m8 11 4 4" />
            </svg>
        )
    }
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 11-11 7 7-11 11z" />
            <path d="m5 12-2 10 10-2" />
        </svg>
    )
}

function EraserIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21H7Z" />
            <path d="m22 21-5-5" />
            <path d="m5 11 9 9" />
        </svg>
    )
}

function TextIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 7 4 4 20 4 20 7" />
            <line x1="9" y1="20" x2="15" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
    )
}

function UndoIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
        </svg>
    )
}

function RedoIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
        </svg>
    )
}

function LaserIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
    )
}

function LassoIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 22c-2.5 0-4.5-1-4.5-2.5S4.5 17 7 17s4.5 1 4.5 2.5S9.5 22 7 22z" />
            <path d="M11.5 19.5c3 0 4.5-1.5 4.5-4.5V9c0-3-1.5-4.5-4.5-4.5S7 6 7 9" />
            <path d="M11 5l3-3L17 5" />
        </svg>
    )
}

function ShapesIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7" cy="7" r="5" />
            <rect x="12" y="12" width="10" height="10" rx="2" />
        </svg>
    )
}
