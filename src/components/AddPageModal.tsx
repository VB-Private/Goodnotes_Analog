import type { PageTemplate } from '../types'

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
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
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
