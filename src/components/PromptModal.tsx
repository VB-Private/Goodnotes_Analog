import { useState, useEffect, useRef } from 'react'

interface PromptModalProps {
  title: string
  placeholder?: string
  defaultValue?: string
  onSubmit: (value: string) => void
  onCancel: () => void
}

export default function PromptModal({ title, placeholder, defaultValue = '', onSubmit, onCancel }: PromptModalProps) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Auto-focus and select text on mount
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 50)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (value.trim()) {
      onSubmit(value.trim())
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '24px',
          minWidth: 320,
          maxWidth: '90vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0f172a' }}>{title}</h3>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          style={{
            padding: '10px 14px',
            fontSize: 14,
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            outline: 'none',
            color: '#1e293b',
            background: '#f8fafc',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#94a3b8'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              background: '#fff',
              color: '#64748b',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 10,
              border: 'none',
              background: '#0f172a',
              color: '#fff',
              cursor: value.trim() ? 'pointer' : 'not-allowed',
              opacity: value.trim() ? 1 : 0.5,
              transition: 'opacity 0.2s',
            }}
          >
            OK
          </button>
        </div>
      </form>
    </div>
  )
}
