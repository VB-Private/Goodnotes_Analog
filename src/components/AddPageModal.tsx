import type { PageTemplate } from '../types'
import { useVisualViewport } from '../hooks/useVisualViewport'

interface AddPageModalProps {
  onClose: () => void
  onSelect: (template: PageTemplate) => void
}

const TEMPLATES: { value: PageTemplate; label: string }[] = [
  { value: 'blank', label: 'Blank' },
  { value: 'squared', label: 'Squared' },
  { value: 'lined', label: 'Lined' },
]

export default function AddPageModal({ onClose, onSelect }: AddPageModalProps) {
  const viewport = useVisualViewport()

  const scale = viewport ? 1 / viewport.scale : 1
  const top = viewport ? viewport.offsetTop : 0
  const left = viewport ? viewport.offsetLeft : 0
  const width = viewport ? viewport.width : '100vw'
  const height = viewport ? viewport.height : '100vh'

  return (
    <div
      style={{
        position: 'fixed',
        top,
        left,
        width,
        height,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        transition: 'all 0.05s linear',
      }}
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="button"
      tabIndex={0}
    >
      <div
        style={{
          background: '#fff',
          padding: 24,
          borderRadius: 12,
          minWidth: 280,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add page"
      >
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Choose template</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {TEMPLATES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(value)}
              style={{ padding: 12, cursor: 'pointer' }}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} style={{ marginTop: 16 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
