import React, { useEffect, useRef } from 'react'
import type { TextField } from '../types'

interface TextFieldComponentProps {
    textField: TextField
    onUpdate: (id: string, text: string) => void
    onDelete: (id: string) => void
    onBlur: () => void
    autoFocus?: boolean
}

export default function TextFieldComponent({
    textField,
    onUpdate,
    onDelete,
    onBlur,
    autoFocus = false
}: TextFieldComponentProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (autoFocus && textareaRef.current) {
            const el = textareaRef.current
            const timeoutId = setTimeout(() => {
                el.focus()
            }, 50) // Small delay to ensure DOM is ready and event propagation is done
            return () => clearTimeout(timeoutId)
        }
    }, [autoFocus])

    useEffect(() => {
        // Auto-resize textarea
        const textarea = textareaRef.current
        if (textarea) {
            textarea.style.height = 'auto'
            textarea.style.height = `${textarea.scrollHeight}px`
        }
    }, [textField.text])

    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        onUpdate(textField.id, e.target.value)
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Escape') {
            onBlur()
        }
    }

    function handleBlur() {
        if (textField.text.trim() === '') {
            onDelete(textField.id)
        } else {
            onBlur()
        }
    }

    return (
        <div
            style={{
                position: 'absolute',
                left: textField.x,
                top: textField.y,
                zIndex: 5,
                pointerEvents: 'auto',
            }}
        >
            <textarea
                ref={textareaRef}
                value={textField.text}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                placeholder="Type here..."
                style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    border: '2px solid #007AFF', // Solid blue border for now
                    color: textField.color,
                    fontSize: textField.fontSize,
                    fontFamily: 'inherit',
                    padding: '8px 12px',
                    margin: 0,
                    resize: 'none',
                    overflow: 'hidden',
                    minWidth: 150,
                    minHeight: '40px',
                    outline: 'none',
                    display: 'block',
                    lineHeight: 1.2,
                    borderRadius: 8,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    transition: 'all 0.2s',
                    position: 'relative'
                }}
                onPointerDown={(e) => {
                    // Prevent canvas from stealing focus or creating another field
                    e.stopPropagation()
                }}
                onMouseMove={(e) => {
                    e.stopPropagation()
                }}
            />
            <button
                onClick={() => onDelete(textField.id)}
                style={{
                    position: 'absolute',
                    top: -10,
                    right: -10,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    backgroundColor: '#ff4d4d',
                    color: 'white',
                    border: 'none',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    padding: 0,
                    lineHeight: 1,
                }}
                className="delete-button"
                title="Delete text"
            >
                ×
            </button>
            <style>
                {`
                    div:hover .delete-button {
                        opacity: 1;
                    }
                    textarea:focus {
                        border-color: #007AFF !important;
                        background-color: rgba(255, 255, 255, 0.8) !important;
                        border-style: solid !important;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    }
                    textarea:not(:focus):not(:placeholder-shown) {
                        border-color: transparent;
                    }
                `}
            </style>
        </div>
    )
}
